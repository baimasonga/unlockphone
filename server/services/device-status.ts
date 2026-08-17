import type Database from 'better-sqlite3';
import { db } from '../db/index.js';
import { config } from '../config.js';
import { lookupTac } from './catalog.js';
import { ApiError } from '../lib/errors.js';
import { validateImei, IMEI_ERROR_MESSAGES } from '../../shared/imei.js';
import {
  blocksCarrierUnlock,
  type DeviceStatusReport,
} from '../../shared/device-status.js';

/**
 * Provider abstraction, same shape as the unlock supplier: a mock that runs
 * offline, and room for a real IMEI-intelligence API behind the same call.
 */
export interface DeviceStatusProvider {
  readonly name: string;
  check(imei: string): Promise<DeviceStatusReport>;
}

const CARRIERS = ['AT&T', 'T-Mobile', 'Verizon', 'EE', 'Vodafone', 'Rogers'];

/**
 * Deterministic simulator. The two digits before the IMEI check digit act as
 * a reserved marker so every state is reproducible in tests and demos:
 *
 *   ..66x  reported lost/stolen (blacklisted)
 *   ..70x  iCloud Activation Lock ON  (treated as an Apple device)
 *   ..77x  Google FRP lock ON         (treated as an Android device)
 *   else   clean, carrier-locked, unlockable
 *
 * A real provider would return the same report shape from live blacklist and
 * lock databases.
 */
export class MockDeviceStatusProvider implements DeviceStatusProvider {
  readonly name = 'mock';

  async check(imei: string): Promise<DeviceStatusReport> {
    const tac = imei.slice(0, 8);
    const marker = imei.substring(12, 14);
    const tacMatch = lookupTac(tac);
    const isApple = tacMatch?.brand_slug === 'apple';

    // Stable pseudo-random carrier so repeat checks agree.
    const carrier = CARRIERS[Number(imei.slice(8, 12)) % CARRIERS.length];

    const blacklisted = marker === '66';
    const icloud = marker === '70';
    const frp = marker === '77';

    const report: DeviceStatusReport = {
      imei,
      tac,
      brand_slug: tacMatch?.brand_slug ?? (icloud ? 'apple' : null),
      model: tacMatch?.model ?? null,
      blacklist: blacklisted ? 'blacklisted' : 'clean',
      lost_stolen: blacklisted,
      sim_lock: 'locked',
      carrier,
      icloud_lock: icloud ? 'on' : isApple ? 'off' : 'not_applicable',
      frp_lock: frp ? 'on' : isApple ? 'not_applicable' : 'off',
      checked_at: new Date().toISOString(),
      can_carrier_unlock: !blacklisted,
      headline: '',
      findings: [],
      recommendation: { message: '', action: 'none' },
    };

    report.findings = buildFindings(report);
    Object.assign(report, summarise(report));
    return report;
  }
}

function buildFindings(report: DeviceStatusReport): DeviceStatusReport['findings'] {
  const findings: DeviceStatusReport['findings'] = [];

  findings.push(
    report.blacklist === 'blacklisted'
      ? {
          label: 'Blacklist status',
          value: 'Reported lost or stolen',
          tone: 'bad',
          detail:
            'This IMEI is on the shared industry blacklist. Networks will refuse to activate or unlock it.',
        }
      : {
          label: 'Blacklist status',
          value: 'Clean',
          tone: 'good',
          detail: 'Not reported lost or stolen on the shared industry blacklist.',
        },
  );

  findings.push({
    label: 'Carrier lock',
    value: report.sim_lock === 'locked' ? `Locked to ${report.carrier}` : 'Unlocked',
    tone: report.sim_lock === 'locked' ? 'warn' : 'good',
    detail:
      report.sim_lock === 'locked'
        ? 'This is the restriction our carrier-unlock service removes.'
        : 'Already accepts any network SIM.',
  });

  if (report.icloud_lock !== 'not_applicable') {
    findings.push(
      report.icloud_lock === 'on'
        ? {
            label: 'iCloud Activation Lock',
            value: 'ON',
            tone: 'bad',
            detail:
              'Tied to the previous owner’s Apple ID. Only that owner or Apple (with proof of purchase) can remove it — a carrier unlock will not.',
          }
        : {
            label: 'iCloud Activation Lock',
            value: 'Off',
            tone: 'good',
            detail: 'Find My is not blocking activation.',
          },
    );
  }

  if (report.frp_lock !== 'not_applicable') {
    findings.push(
      report.frp_lock === 'on'
        ? {
            label: 'Google FRP lock',
            value: 'ON',
            tone: 'bad',
            detail:
              'Factory Reset Protection is tied to a Google account. Only that account holder can clear it — a carrier unlock will not.',
          }
        : {
            label: 'Google FRP lock',
            value: 'Off',
            tone: 'good',
            detail: 'No Factory Reset Protection blocking setup.',
          },
    );
  }

  return findings;
}

function summarise(
  report: DeviceStatusReport,
): Pick<DeviceStatusReport, 'headline' | 'recommendation'> {
  if (report.blacklist === 'blacklisted') {
    return {
      headline: 'This device is reported lost or stolen',
      recommendation: {
        message:
          'We cannot unlock a blacklisted device, and neither will any network. If you believe this is a mistake, the carrier that reported it has to clear the block first.',
        action: 'none',
      },
    };
  }
  if (report.icloud_lock === 'on' || report.frp_lock === 'on') {
    const which = report.icloud_lock === 'on' ? 'iCloud Activation Lock' : 'Google FRP lock';
    return {
      headline: `Carrier-unlockable, but ${which} is active`,
      recommendation: {
        message: `A carrier unlock will free this device for any network, but it will not remove the ${which} — that is an owner-only step. If you are the owner, open a proof-of-ownership case and we will route it to the right place.`,
        action: 'ownership_case',
      },
    };
  }
  return {
    headline: 'Good to unlock',
    recommendation: {
      message: 'This device is clean and carrier-locked. It is eligible for a carrier unlock.',
      action: 'carrier_unlock',
    },
  };
}

let cached: DeviceStatusProvider | null = null;

export function getDeviceStatusProvider(): DeviceStatusProvider {
  if (!cached) cached = new MockDeviceStatusProvider();
  return cached;
}

export function setDeviceStatusProvider(provider: DeviceStatusProvider | null): void {
  cached = provider;
}

/** Runs the report and logs it, validating the IMEI first. */
export async function checkDeviceStatus(
  rawImei: string,
  database: Database.Database = db,
): Promise<DeviceStatusReport> {
  const validation = validateImei(rawImei);
  if (!validation.valid) {
    throw ApiError.badRequest(IMEI_ERROR_MESSAGES[validation.error!]);
  }
  const report = await getDeviceStatusProvider().check(validation.normalised);

  database
    .prepare(
      `INSERT INTO device_checks (imei, blacklist, icloud_lock, frp_lock, carrier)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(report.imei, report.blacklist, report.icloud_lock, report.frp_lock, report.carrier);

  return report;
}

/**
 * Order-time gate. Blocks a carrier-unlock order for a device that no network
 * would release anyway, so we never take money we would only have to refund.
 * Activation/FRP locks do NOT block a carrier unlock — they are orthogonal —
 * so they pass here and are surfaced as advice elsewhere.
 */
export async function assertDeviceEligibleForUnlock(imei: string): Promise<void> {
  if (!config.precheckDevices) return;
  const report = await getDeviceStatusProvider().check(imei);
  if (blocksCarrierUnlock(report)) {
    throw ApiError.badRequest(
      'This IMEI is reported lost or stolen, so it cannot be unlocked. Run a free device check for details.',
    );
  }
}
