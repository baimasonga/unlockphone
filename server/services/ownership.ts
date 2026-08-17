import { randomBytes } from 'node:crypto';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { extname, resolve } from 'node:path';
import type Database from 'better-sqlite3';
import { db } from '../db/index.js';
import { config } from '../config.js';
import { ApiError } from '../lib/errors.js';
import { lookupTac } from './catalog.js';
import { validateImei, maskEmail, maskImei, IMEI_ERROR_MESSAGES } from '../../shared/imei.js';
import {
  authorityForLock,
  buildSubmissionPackage,
  canTransitionCase,
  CASE_STATUS_LABELS,
  LOCK_TYPE_LABELS,
  type CaseStatus,
  type LockType,
} from '../../shared/ownership.js';

const ALPHABET = 'ACDEFGHJKLMNPQRTUVWXY34679';

export function generateCaseReference(): string {
  const bytes = randomBytes(8);
  let body = '';
  for (let i = 0; i < 8; i++) body += ALPHABET[bytes[i] % ALPHABET.length];
  return `OC-${body.slice(0, 4)}-${body.slice(4)}`;
}

export interface CaseRow {
  id: number;
  reference: string;
  user_id: number | null;
  email: string;
  full_name: string;
  imei: string;
  device_model: string | null;
  brand_slug: string | null;
  lock_type: LockType;
  purchase_info: string;
  status: CaseStatus;
  authority_key: string | null;
  package: string | null;
  created_at: string;
  updated_at: string;
}

export interface CaseFileRow {
  id: number;
  case_id: number;
  filename: string;
  content_type: string;
  byte_size: number;
  storage_path: string;
  created_at: string;
}

export interface CreateCaseInput {
  email: string;
  fullName: string;
  imei: string;
  lockType: LockType;
  purchaseInfo: string;
  deviceModel?: string | null;
  userId?: number | null;
}

export function createCase(input: CreateCaseInput, database: Database.Database = db): CaseRow {
  const imei = validateImei(input.imei);
  if (!imei.valid) throw ApiError.badRequest(IMEI_ERROR_MESSAGES[imei.error!]);

  if (!input.fullName.trim()) {
    throw ApiError.badRequest('Enter the full name the device was purchased under.');
  }
  if (input.purchaseInfo.trim().length < 10) {
    throw ApiError.badRequest(
      'Tell us where and roughly when you bought the device — this is what proves ownership.',
    );
  }

  const tacMatch = imei.tac ? lookupTac(imei.tac, database) : null;
  const brandSlug = tacMatch?.brand_slug ?? null;

  // An iCloud case on a non-Apple device (or FRP on an Apple device) is almost
  // always a mistake; catch it here rather than after a support round-trip.
  if (input.lockType === 'icloud_activation' && brandSlug && brandSlug !== 'apple') {
    throw ApiError.badRequest(
      'iCloud Activation Lock only applies to Apple devices. Pick the lock type that matches your phone.',
    );
  }
  if (input.lockType === 'google_frp' && brandSlug === 'apple') {
    throw ApiError.badRequest(
      'Google FRP does not apply to Apple devices. For an iPhone, choose iCloud Activation Lock or screen lock.',
    );
  }

  const authority = authorityForLock(input.lockType, brandSlug);
  const reference = generateCaseReference();

  const result = database
    .prepare(
      `INSERT INTO ownership_cases
         (reference, user_id, email, full_name, imei, device_model, brand_slug,
          lock_type, purchase_info, status, authority_key)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'submitted', ?)`,
    )
    .run(
      reference,
      input.userId ?? null,
      input.email.trim().toLowerCase(),
      input.fullName.trim(),
      imei.normalised,
      input.deviceModel?.trim() || tacMatch?.model || null,
      brandSlug,
      input.lockType,
      input.purchaseInfo.trim(),
      authority.key,
    );

  const caseId = Number(result.lastInsertRowid);
  recordCaseEvent(
    caseId,
    'submitted',
    `Case received. We will verify ownership before contacting ${authority.name}.`,
    'system',
    database,
  );
  return getCaseById(caseId, database);
}

export function recordCaseEvent(
  caseId: number,
  status: CaseStatus,
  message: string,
  actor: string,
  database: Database.Database = db,
): void {
  database
    .prepare(
      'INSERT INTO ownership_case_events (case_id, status, message, actor) VALUES (?, ?, ?, ?)',
    )
    .run(caseId, status, message, actor);
}

export function getCaseById(id: number, database: Database.Database = db): CaseRow {
  const row = database.prepare('SELECT * FROM ownership_cases WHERE id = ?').get(id) as
    | CaseRow
    | undefined;
  if (!row) throw ApiError.notFound('Case not found.');
  return row;
}

export function findCaseByReference(
  reference: string,
  database: Database.Database = db,
): CaseRow | null {
  const row = database
    .prepare('SELECT * FROM ownership_cases WHERE reference = ?')
    .get(reference.trim().toUpperCase()) as CaseRow | undefined;
  return row ?? null;
}

export function listCaseFiles(caseId: number, database: Database.Database = db): CaseFileRow[] {
  return database
    .prepare('SELECT * FROM ownership_case_files WHERE case_id = ? ORDER BY id')
    .all(caseId) as CaseFileRow[];
}

/** Persists an uploaded proof file to disk and links it to the case. */
export function attachProof(
  caseRef: string,
  file: { filename: string; contentType: string; bytes: Buffer },
  database: Database.Database = db,
): CaseFileRow {
  const record = findCaseByReference(caseRef, database);
  if (!record) throw ApiError.notFound('Case not found.');
  if (record.status !== 'submitted' && record.status !== 'needs_more_info') {
    throw ApiError.conflict('This case is no longer accepting uploads.');
  }
  if (file.bytes.length === 0) throw ApiError.badRequest('The uploaded file is empty.');
  if (file.bytes.length > config.maxProofBytes) {
    throw ApiError.badRequest('That file is too large. Keep proof under 8 MB.');
  }

  const allowed = ['image/jpeg', 'image/png', 'image/heic', 'image/webp', 'application/pdf'];
  if (!allowed.includes(file.contentType)) {
    throw ApiError.badRequest('Upload a photo or PDF of your proof of purchase.');
  }

  const dir = resolve(process.cwd(), config.uploadsDir);
  mkdirSync(dir, { recursive: true });

  const safeExt = (extname(file.filename) || mimeToExt(file.contentType)).slice(0, 5);
  const storedName = `${record.reference}-${randomBytes(6).toString('hex')}${safeExt}`;
  const storagePath = resolve(dir, storedName);
  writeFileSync(storagePath, file.bytes);

  const result = database
    .prepare(
      `INSERT INTO ownership_case_files (case_id, filename, content_type, byte_size, storage_path)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(
      record.id,
      sanitiseName(file.filename),
      file.contentType,
      file.bytes.length,
      storagePath,
    );

  return database
    .prepare('SELECT * FROM ownership_case_files WHERE id = ?')
    .get(Number(result.lastInsertRowid)) as CaseFileRow;
}

function mimeToExt(mime: string): string {
  return (
    {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/heic': '.heic',
      'image/webp': '.webp',
      'application/pdf': '.pdf',
    }[mime] ?? '.bin'
  );
}

function sanitiseName(name: string): string {
  return name.replace(/[^\w.\- ]+/g, '').slice(0, 120) || 'proof';
}

/**
 * Moves a case through review. On `verified` the submission package is built
 * and stored; on terminal states nothing can move again.
 */
export function transitionCase(
  caseRef: string,
  to: CaseStatus,
  message: string,
  actor: string,
  database: Database.Database = db,
): CaseRow {
  const record = findCaseByReference(caseRef, database);
  if (!record) throw ApiError.notFound('Case not found.');
  if (record.status === to) return record;
  if (!canTransitionCase(record.status, to)) {
    throw ApiError.conflict(
      `Cannot move case ${record.reference} from ${CASE_STATUS_LABELS[record.status]} to ${CASE_STATUS_LABELS[to]}.`,
    );
  }

  let packageText = record.package;
  if (to === 'verified') {
    const files = listCaseFiles(record.id, database);
    packageText = buildSubmissionPackage({
      reference: record.reference,
      lockType: record.lock_type,
      fullName: record.full_name,
      email: record.email,
      imei: record.imei,
      deviceModel: record.device_model,
      purchaseInfo: record.purchase_info,
      brandSlug: record.brand_slug,
      proofFilenames: files.map((f) => f.filename),
    });
  }

  database
    .prepare(
      `UPDATE ownership_cases SET status = ?, package = COALESCE(?, package),
                                  updated_at = datetime('now')
       WHERE id = ?`,
    )
    .run(to, packageText, record.id);

  recordCaseEvent(record.id, to, message, actor, database);
  return getCaseById(record.id, database);
}

/** Customer-facing shape: masks PII, hides internal package until verified. */
export function toPublicCase(record: CaseRow, database: Database.Database = db) {
  const events = database
    .prepare(
      'SELECT status, message, created_at FROM ownership_case_events WHERE case_id = ? ORDER BY id',
    )
    .all(record.id) as Array<{ status: string; message: string; created_at: string }>;
  const files = listCaseFiles(record.id, database);
  const authority = authorityForLock(record.lock_type, record.brand_slug);

  return {
    reference: record.reference,
    email_masked: maskEmail(record.email),
    imei_masked: maskImei(record.imei),
    device_model: record.device_model,
    lock_type: record.lock_type,
    lock_label: LOCK_TYPE_LABELS[record.lock_type],
    status: record.status,
    status_label: CASE_STATUS_LABELS[record.status],
    authority: { name: authority.name, channel: authority.channel, url: authority.url },
    // The package is an internal artefact; the customer sees that it exists
    // and where it is going, not the raw text.
    has_package: Boolean(record.package),
    proof_count: files.length,
    created_at: record.created_at,
    events,
  };
}

export function listCasesForUser(userId: number, database: Database.Database = db) {
  const rows = database
    .prepare('SELECT * FROM ownership_cases WHERE user_id = ? ORDER BY id DESC')
    .all(userId) as CaseRow[];
  return rows.map((row) => toPublicCase(row, database));
}

/** Admin shape: full detail including the generated package and raw PII. */
export function toAdminCase(record: CaseRow, database: Database.Database = db) {
  const files = listCaseFiles(record.id, database);
  return {
    ...toPublicCase(record, database),
    email: record.email,
    full_name: record.full_name,
    imei: record.imei,
    purchase_info: record.purchase_info,
    package: record.package,
    files: files.map((f) => ({
      id: f.id,
      filename: f.filename,
      content_type: f.content_type,
      byte_size: f.byte_size,
    })),
  };
}

export function fileForCase(
  caseRef: string,
  fileId: number,
  database: Database.Database = db,
): CaseFileRow {
  const record = findCaseByReference(caseRef, database);
  if (!record) throw ApiError.notFound('Case not found.');
  const file = database
    .prepare('SELECT * FROM ownership_case_files WHERE id = ? AND case_id = ?')
    .get(fileId, record.id) as CaseFileRow | undefined;
  if (!file || !existsSync(file.storage_path)) throw ApiError.notFound('File not found.');
  return file;
}
