import { describe, expect, it } from 'vitest';
import { MockDeviceStatusProvider } from './device-status.js';
import { blocksCarrierUnlock } from '../../shared/device-status.js';

// Reserved marker IMEIs (two digits before the check digit encode the state).
const CLEAN = '353261110006674';
const BLACKLISTED = '353261110000669';
const ICLOUD = '353261110000701';
const FRP = '353261110000776';

const provider = new MockDeviceStatusProvider();

describe('MockDeviceStatusProvider', () => {
  it('flags a blacklisted device and blocks carrier unlock', async () => {
    const report = await provider.check(BLACKLISTED);
    expect(report.blacklist).toBe('blacklisted');
    expect(report.lost_stolen).toBe(true);
    expect(report.can_carrier_unlock).toBe(false);
    expect(blocksCarrierUnlock(report)).toBe(true);
  });

  it('reports an active iCloud lock but still allows carrier unlock', async () => {
    const report = await provider.check(ICLOUD);
    expect(report.icloud_lock).toBe('on');
    expect(report.can_carrier_unlock).toBe(true);
    expect(blocksCarrierUnlock(report)).toBe(false);
    expect(report.recommendation.action).toBe('ownership_case');
  });

  it('reports an active FRP lock', async () => {
    const report = await provider.check(FRP);
    expect(report.frp_lock).toBe('on');
    expect(report.recommendation.action).toBe('ownership_case');
  });

  it('passes a clean device through to the unlock recommendation', async () => {
    const report = await provider.check(CLEAN);
    expect(report.blacklist).toBe('clean');
    expect(report.icloud_lock).toBe('off');
    expect(report.can_carrier_unlock).toBe(true);
    expect(report.recommendation.action).toBe('carrier_unlock');
  });

  it('is deterministic — the same IMEI always yields the same verdict', async () => {
    const a = await provider.check(BLACKLISTED);
    const b = await provider.check(BLACKLISTED);
    expect(a.blacklist).toBe(b.blacklist);
    expect(a.carrier).toBe(b.carrier);
  });
});
