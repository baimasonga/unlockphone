import { Router, raw } from 'express';
import { z } from 'zod';
import { ApiError, asyncRoute } from '../lib/errors.js';
import { rateLimit } from '../lib/rate-limit.js';
import { requireAuth } from '../lib/auth.js';
import { config } from '../config.js';
import {
  attachProof,
  createCase,
  findCaseByReference,
  listCasesForUser,
  toPublicCase,
} from '../services/ownership.js';

export const ownershipRouter = Router();

const createSchema = z.object({
  email: z.string().email('We need a valid email to reach you about the case.'),
  full_name: z.string().min(1, 'Enter the name the device was bought under.'),
  imei: z.string().min(1),
  lock_type: z.enum(['screen_lock', 'google_frp', 'icloud_activation']),
  purchase_info: z.string().min(10, 'Add a little detail about where and when you bought it.'),
  device_model: z.string().max(120).optional().nullable(),
});

/** File a case. Proof files are uploaded separately once the reference exists. */
ownershipRouter.post(
  '/',
  rateLimit({ windowMs: 60 * 60_000, max: 15 }),
  asyncRoute(async (req, res) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) throw ApiError.badRequest(parsed.error.issues[0].message);

    const record = createCase({
      email: parsed.data.email,
      fullName: parsed.data.full_name,
      imei: parsed.data.imei,
      lockType: parsed.data.lock_type,
      purchaseInfo: parsed.data.purchase_info,
      deviceModel: parsed.data.device_model ?? null,
      userId: req.user?.id ?? null,
    });

    res.status(201).json({ case: toPublicCase(record) });
  }),
);

/**
 * Proof upload. Takes the raw file body (image or PDF) rather than base64 in
 * JSON, so the global 100 KB JSON limit is untouched and receipts up to 8 MB
 * go through. The filename rides in a header.
 */
ownershipRouter.post(
  '/:reference/proof',
  rateLimit({ windowMs: 60_000, max: 20 }),
  raw({
    type: ['image/*', 'application/pdf'],
    limit: config.maxProofBytes,
  }),
  asyncRoute(async (req, res) => {
    const body = req.body;
    if (!Buffer.isBuffer(body) || body.length === 0) {
      throw ApiError.badRequest('Attach a photo or PDF of your proof of purchase.');
    }
    const filename =
      (typeof req.headers['x-filename'] === 'string' && req.headers['x-filename']) ||
      'proof';
    const contentType = req.headers['content-type'] ?? 'application/octet-stream';

    const file = attachProof(req.params.reference, {
      filename,
      contentType,
      bytes: body,
    });

    res.status(201).json({
      file: { id: file.id, filename: file.filename, byte_size: file.byte_size },
    });
  }),
);

/** Track a case: reference plus the email it was filed under. */
ownershipRouter.post(
  '/track',
  rateLimit({ windowMs: 60_000, max: 20 }),
  asyncRoute(async (req, res) => {
    const parsed = z
      .object({ reference: z.string().min(1), email: z.string().email() })
      .safeParse(req.body);
    if (!parsed.success) {
      throw ApiError.badRequest('Enter both your case reference and the email you used.');
    }
    const record = findCaseByReference(parsed.data.reference);
    if (!record || record.email !== parsed.data.email.trim().toLowerCase()) {
      throw ApiError.notFound('No case matches that reference and email.');
    }
    res.json({ case: toPublicCase(record) });
  }),
);

ownershipRouter.get('/mine', requireAuth, (req, res) => {
  res.json({ cases: listCasesForUser(req.user!.id) });
});
