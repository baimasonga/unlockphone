import type Database from 'better-sqlite3';
import { beforeEach, describe, expect, it } from 'vitest';
import { createTestDb } from '../db/index.js';
import { seed } from '../db/seed.js';
import {
  createCase,
  findCaseByReference,
  generateCaseReference,
  toAdminCase,
  toPublicCase,
  transitionCase,
} from './ownership.js';
import { ApiError } from '../lib/errors.js';

// 353261110000701 has TAC 35326111 → iPhone in the seed, an Apple device.
const APPLE_IMEI = '353261110000701';
// 35204910 → Galaxy S24 Ultra in the seed, a Samsung (Android) device.
const ANDROID_IMEI = '352049100000000';

let database: Database.Database;

function newCase(overrides: Partial<Parameters<typeof createCase>[0]> = {}) {
  return createCase(
    {
      email: 'owner@example.com',
      fullName: 'Jane Doe',
      imei: APPLE_IMEI,
      lockType: 'icloud_activation',
      purchaseInfo: 'Bought new from the Apple Store, receipt in my name.',
      ...overrides,
    },
    database,
  );
}

beforeEach(() => {
  database = createTestDb();
  seed(database);
});

describe('generateCaseReference', () => {
  it('uses the OC prefix and an unambiguous alphabet', () => {
    expect(generateCaseReference()).toMatch(
      /^OC-[ACDEFGHJKLMNPQRTUVWXY34679]{4}-[ACDEFGHJKLMNPQRTUVWXY34679]{4}$/,
    );
  });
});

describe('createCase', () => {
  it('files a case and routes it to the right authority', () => {
    const record = newCase();
    expect(record.status).toBe('submitted');
    expect(record.authority_key).toBe('apple');
    expect(toPublicCase(record, database).authority.name).toBe('Apple');
  });

  it('rejects an iCloud claim on a non-Apple device', () => {
    expect(() =>
      newCase({ imei: ANDROID_IMEI, lockType: 'icloud_activation' }),
    ).toThrow(/iCloud Activation Lock only applies to Apple/);
  });

  it('rejects an FRP claim on an Apple device', () => {
    expect(() => newCase({ lockType: 'google_frp' })).toThrow(/Google FRP does not apply/);
  });

  it('demands real proof-of-purchase detail', () => {
    expect(() => newCase({ purchaseInfo: 'mine' })).toThrow(ApiError);
  });

  it('rejects a malformed IMEI', () => {
    expect(() => newCase({ imei: '12345' })).toThrow(ApiError);
  });
});

describe('transitionCase', () => {
  it('builds the submission package exactly when a case is verified', () => {
    const record = newCase();
    transitionCase(record.reference, 'reviewing', 'Reviewing.', 'admin@example.com', database);

    const beforeVerify = findCaseByReference(record.reference, database)!;
    expect(beforeVerify.package).toBeNull();

    const verified = transitionCase(
      record.reference,
      'verified',
      'Verified.',
      'admin@example.com',
      database,
    );
    expect(verified.package).toContain('Submit to: Apple');
    expect(verified.package).toContain(record.reference);
  });

  it('refuses to skip review and jump straight to verified', () => {
    const record = newCase();
    expect(() =>
      transitionCase(record.reference, 'verified', 'no', 'admin@example.com', database),
    ).toThrow(/Cannot move case/);
  });

  it('cannot reopen a rejected case', () => {
    const record = newCase();
    transitionCase(record.reference, 'rejected', 'Insufficient proof.', 'admin', database);
    expect(() =>
      transitionCase(record.reference, 'reviewing', 'reopen', 'admin', database),
    ).toThrow(/Cannot move case/);
  });
});

describe('toPublicCase vs toAdminCase', () => {
  it('masks PII and hides raw package from the customer view', () => {
    const record = newCase();
    const publicView = toPublicCase(record, database);
    expect(publicView.email_masked).not.toBe('owner@example.com');
    expect(publicView.imei_masked).not.toBe(APPLE_IMEI);
    expect(publicView).not.toHaveProperty('purchase_info');
    // has_package is a boolean flag, never the raw text.
    expect(publicView.has_package).toBe(false);
  });

  it('gives admins the full record including raw IMEI and package', () => {
    const record = newCase();
    transitionCase(record.reference, 'reviewing', 'r', 'a', database);
    transitionCase(record.reference, 'verified', 'v', 'a', database);
    const adminView = toAdminCase(findCaseByReference(record.reference, database)!, database);
    expect(adminView.imei).toBe(APPLE_IMEI);
    expect(adminView.email).toBe('owner@example.com');
    expect(adminView.package).toContain('OWNERSHIP VERIFICATION PACKAGE');
  });
});
