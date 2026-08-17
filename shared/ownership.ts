/**
 * Proof-of-ownership case handling.
 *
 * The only lawful way a screen lock, Google FRP lock, or iCloud Activation
 * Lock comes off a device is for the owner to prove ownership to the party
 * that holds the lock (Apple, Google, or the carrier). This models that
 * process: a customer files a case with proof of purchase, staff verify it,
 * and the system produces the package to submit through official channels.
 *
 * Nothing here bypasses a lock. It routes a verified owner to the right
 * authority and packages their evidence.
 */

export type LockType = 'screen_lock' | 'google_frp' | 'icloud_activation';

export type CaseStatus =
  | 'submitted'
  | 'reviewing'
  | 'needs_more_info'
  | 'verified'
  | 'submitted_to_authority'
  | 'resolved'
  | 'rejected';

export const CASE_TERMINAL: readonly CaseStatus[] = ['resolved', 'rejected'];

/**
 * Legal case transitions. A case can be rejected from any active state (fraud,
 * insufficient proof), but once resolved or rejected it never moves again.
 */
export const CASE_TRANSITIONS: Record<CaseStatus, readonly CaseStatus[]> = {
  submitted: ['reviewing', 'rejected'],
  reviewing: ['needs_more_info', 'verified', 'rejected'],
  needs_more_info: ['reviewing', 'verified', 'rejected'],
  verified: ['submitted_to_authority', 'rejected'],
  submitted_to_authority: ['resolved', 'rejected'],
  resolved: [],
  rejected: [],
};

export function canTransitionCase(from: CaseStatus, to: CaseStatus): boolean {
  return CASE_TRANSITIONS[from].includes(to);
}

export const CASE_STATUS_LABELS: Record<CaseStatus, string> = {
  submitted: 'Received',
  reviewing: 'Under review',
  needs_more_info: 'More information needed',
  verified: 'Ownership verified',
  submitted_to_authority: 'Submitted to manufacturer',
  resolved: 'Resolved',
  rejected: 'Could not verify',
};

export const LOCK_TYPE_LABELS: Record<LockType, string> = {
  screen_lock: 'Screen lock / forgotten passcode',
  google_frp: 'Google FRP (Factory Reset Protection)',
  icloud_activation: 'iCloud Activation Lock',
};

export interface Authority {
  key: 'apple' | 'google' | 'carrier' | 'manufacturer';
  name: string;
  channel: string;
  url: string;
}

/**
 * Which authority actually clears a given lock. This is where a verified
 * owner is sent — these are the official first-party recovery routes.
 */
export function authorityForLock(lock: LockType, brandSlug?: string | null): Authority {
  if (lock === 'icloud_activation') {
    return {
      key: 'apple',
      name: 'Apple',
      channel: 'Apple Support — Activation Lock removal with proof of purchase',
      url: 'https://support.apple.com/activation-lock',
    };
  }
  if (lock === 'google_frp') {
    return {
      key: 'google',
      name: 'Google',
      channel: 'Google Account recovery / device certification',
      url: 'https://support.google.com/android/answer/9459346',
    };
  }
  // Screen lock: Apple devices go to Apple, everything else to the maker.
  if (brandSlug === 'apple') {
    return {
      key: 'apple',
      name: 'Apple',
      channel: 'Apple Support — device passcode recovery',
      url: 'https://support.apple.com/en-us/HT204306',
    };
  }
  return {
    key: 'manufacturer',
    name: 'the device manufacturer',
    channel: 'Manufacturer service centre with proof of purchase',
    url: '',
  };
}

export interface CasePackageInput {
  reference: string;
  lockType: LockType;
  fullName: string;
  email: string;
  imei: string;
  deviceModel: string | null;
  purchaseInfo: string;
  brandSlug?: string | null;
  proofFilenames: string[];
}

/**
 * The deliverable, produced once ownership is verified: a ready-to-send
 * submission the owner (or our team on their behalf) files with the authority.
 */
export function buildSubmissionPackage(input: CasePackageInput): string {
  const authority = authorityForLock(input.lockType, input.brandSlug);
  const proofList = input.proofFilenames.length
    ? input.proofFilenames.map((f) => `    - ${f}`).join('\n')
    : '    - (none attached)';

  return [
    `OWNERSHIP VERIFICATION PACKAGE`,
    `Case ${input.reference}`,
    ``,
    `Submit to: ${authority.name}`,
    `Channel:   ${authority.channel}`,
    authority.url ? `Link:      ${authority.url}` : `Link:      (via manufacturer service centre)`,
    ``,
    `Lock type: ${LOCK_TYPE_LABELS[input.lockType]}`,
    `Device:    ${input.deviceModel ?? 'Unknown model'}`,
    `IMEI:      ${input.imei}`,
    ``,
    `Owner:     ${input.fullName}`,
    `Contact:   ${input.email}`,
    ``,
    `Purchase evidence provided by owner:`,
    `  ${input.purchaseInfo}`,
    `  Attachments:`,
    proofList,
    ``,
    `Verified by UnlockWave support. This request is made by the verified`,
    `owner of the device and asks ${authority.name} to remove the lock through`,
    `their official owner-recovery process. No bypass has been attempted.`,
  ].join('\n');
}
