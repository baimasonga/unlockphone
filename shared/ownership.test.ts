import { describe, expect, it } from 'vitest';
import {
  authorityForLock,
  buildSubmissionPackage,
  canTransitionCase,
  CASE_TERMINAL,
  CASE_TRANSITIONS,
  type CaseStatus,
} from './ownership';

describe('case state machine', () => {
  it('walks a verified case through to resolution', () => {
    expect(canTransitionCase('submitted', 'reviewing')).toBe(true);
    expect(canTransitionCase('reviewing', 'verified')).toBe(true);
    expect(canTransitionCase('verified', 'submitted_to_authority')).toBe(true);
    expect(canTransitionCase('submitted_to_authority', 'resolved')).toBe(true);
  });

  it('lets any active state be rejected', () => {
    for (const from of [
      'submitted',
      'reviewing',
      'needs_more_info',
      'verified',
      'submitted_to_authority',
    ] as CaseStatus[]) {
      expect(canTransitionCase(from, 'rejected')).toBe(true);
    }
  });

  it('never moves a resolved or rejected case again', () => {
    for (const terminal of CASE_TERMINAL) {
      expect(CASE_TRANSITIONS[terminal]).toHaveLength(0);
    }
  });

  it('cannot verify a case straight from submitted without review', () => {
    expect(canTransitionCase('submitted', 'verified')).toBe(false);
    expect(canTransitionCase('submitted', 'submitted_to_authority')).toBe(false);
  });

  it('cannot submit to the authority before ownership is verified', () => {
    expect(canTransitionCase('reviewing', 'submitted_to_authority')).toBe(false);
  });
});

describe('authorityForLock', () => {
  it('routes each lock type to the party that actually clears it', () => {
    expect(authorityForLock('icloud_activation').key).toBe('apple');
    expect(authorityForLock('google_frp').key).toBe('google');
  });

  it('sends an Apple screen lock to Apple and others to the maker', () => {
    expect(authorityForLock('screen_lock', 'apple').key).toBe('apple');
    expect(authorityForLock('screen_lock', 'samsung').key).toBe('manufacturer');
    expect(authorityForLock('screen_lock', null).key).toBe('manufacturer');
  });
});

describe('buildSubmissionPackage', () => {
  const base = {
    reference: 'OC-TEST-0001',
    fullName: 'Jane Doe',
    email: 'jane@example.com',
    imei: '353261110000701',
    deviceModel: 'iPhone 13 Pro',
    purchaseInfo: 'Apple Store SF, March 2024',
    brandSlug: 'apple',
    proofFilenames: ['receipt.pdf'],
  };

  it('addresses the package to the correct authority', () => {
    const pkg = buildSubmissionPackage({ ...base, lockType: 'icloud_activation' });
    expect(pkg).toContain('Submit to: Apple');
    expect(pkg).toContain('OC-TEST-0001');
    expect(pkg).toContain('353261110000701');
  });

  it('lists attached proof, and says so when there is none', () => {
    expect(buildSubmissionPackage({ ...base, lockType: 'screen_lock' })).toContain(
      'receipt.pdf',
    );
    const empty = buildSubmissionPackage({
      ...base,
      lockType: 'screen_lock',
      proofFilenames: [],
    });
    expect(empty).toContain('(none attached)');
  });

  it('states plainly that no bypass was attempted', () => {
    const pkg = buildSubmissionPackage({ ...base, lockType: 'icloud_activation' });
    expect(pkg).toContain('No bypass has been attempted');
  });
});
