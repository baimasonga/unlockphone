/**
 * Pre-purchase / pre-order device status report.
 *
 * This is a *reporting* surface: it tells you what state a device is in so a
 * buyer does not pay for a locked or blacklisted handset, and so an unlock
 * order that could never succeed is refused before any money changes hands.
 * It never removes or bypasses anything.
 */

export type BlacklistStatus = 'clean' | 'blacklisted' | 'unknown';
export type LockFlag = 'on' | 'off' | 'not_applicable';
export type SimLockStatus = 'locked' | 'unlocked' | 'unknown';

export interface DeviceStatusReport {
  imei: string;
  tac: string;
  brand_slug: string | null;
  model: string | null;
  /** Reported lost/stolen on the shared industry blacklist (e.g. GSMA). */
  blacklist: BlacklistStatus;
  lost_stolen: boolean;
  /** Locked to a carrier — the thing our unlock service can actually fix. */
  sim_lock: SimLockStatus;
  carrier: string | null;
  /** Apple Activation Lock (Find My). Owner-only removal. */
  icloud_lock: LockFlag;
  /** Google Factory Reset Protection. Owner-only removal. */
  frp_lock: LockFlag;
  checked_at: string;
  /** Whether a carrier unlock order would be accepted for this device. */
  can_carrier_unlock: boolean;
  /** Plain-language summary shown to the customer. */
  headline: string;
  /** Ordered, human-readable findings. */
  findings: Array<{
    label: string;
    value: string;
    tone: 'good' | 'bad' | 'warn' | 'neutral';
    detail?: string;
  }>;
  /** Next step we recommend, and where it points in the app. */
  recommendation: {
    message: string;
    action?: 'carrier_unlock' | 'ownership_case' | 'none';
  };
}

/** True when the device must not be accepted for a carrier-unlock order. */
export function blocksCarrierUnlock(report: DeviceStatusReport): boolean {
  return report.blacklist === 'blacklisted' || report.lost_stolen;
}
