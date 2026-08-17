import { createHash, randomInt } from 'node:crypto';
import { config } from '../config.js';

/**
 * Wholesale unlock suppliers (DHRU Fusion is the de-facto standard API in this
 * trade) all expose the same two operations: place an order, then poll it.
 * Everything above this interface is provider-agnostic, so swapping supplier
 * is a config change rather than a rewrite.
 */
export interface SupplierOrderRequest {
  serviceCode: string;
  imei: string;
  model?: string | null;
}

export interface SupplierPlacement {
  supplierReference: string;
}

export type SupplierOutcome =
  | { state: 'pending'; message: string }
  | { state: 'delivered'; code: string; message: string }
  | { state: 'not_found'; message: string }
  | { state: 'rejected'; message: string };

export interface Supplier {
  readonly name: string;
  place(request: SupplierOrderRequest): Promise<SupplierPlacement>;
  poll(supplierReference: string): Promise<SupplierOutcome>;
}

/**
 * Local simulator. Outcomes are derived by hashing the IMEI, so the same
 * device always resolves the same way — that determinism is what makes the
 * fulfilment path testable and demos repeatable.
 *
 * Reserved test IMEI suffixes:
 *   ...000  always "not found"
 *   ...111  always "rejected by network"
 *   anything else succeeds after a short simulated delay.
 */
export class MockSupplier implements Supplier {
  readonly name = 'mock';

  private readonly placedAt = new Map<string, number>();
  private readonly imeiFor = new Map<string, string>();

  async place(request: SupplierOrderRequest): Promise<SupplierPlacement> {
    const supplierReference = `MOCK-${Date.now().toString(36).toUpperCase()}-${randomInt(
      1000,
      9999,
    )}`;
    this.placedAt.set(supplierReference, Date.now());
    this.imeiFor.set(supplierReference, request.imei);
    return { supplierReference };
  }

  async poll(supplierReference: string): Promise<SupplierOutcome> {
    const imei = this.imeiFor.get(supplierReference);
    if (!imei) {
      // The process restarted and lost the in-memory placement. Treating this
      // as still-pending is the safe answer: the worker retries rather than
      // refunding an order that may well have succeeded upstream.
      return { state: 'pending', message: 'Awaiting network response.' };
    }

    const placedAt = this.placedAt.get(supplierReference) ?? 0;
    if (Date.now() - placedAt < 8000) {
      return { state: 'pending', message: 'The network is checking device eligibility.' };
    }

    if (imei.endsWith('000')) {
      return {
        state: 'not_found',
        message: 'The network has no record of this IMEI on their database.',
      };
    }
    if (imei.endsWith('111')) {
      return {
        state: 'rejected',
        message:
          'The network declined this unlock — the device is reported as unpaid, blacklisted, or still under contract.',
      };
    }

    return {
      state: 'delivered',
      code: deterministicUnlockCode(imei),
      message: 'The network approved the unlock.',
    };
  }
}

/** Derives a stable 8-digit NCK from the IMEI so repeat polls agree. */
function deterministicUnlockCode(imei: string): string {
  const digest = createHash('sha256').update(`nck:${imei}`).digest();
  let code = '';
  for (let i = 0; i < 8; i++) code += (digest[i] % 10).toString();
  return code;
}

/**
 * DHRU Fusion adapter. The wire format is a POST of form-encoded credentials
 * plus an action, returning JSON. Left unconfigured by default — the mock
 * supplier is what runs until real credentials are supplied.
 */
export class DhruSupplier implements Supplier {
  readonly name = 'dhru';

  constructor(
    private readonly apiUrl: string,
    private readonly username: string,
    private readonly apiKey: string,
  ) {
    if (!apiUrl || !username || !apiKey) {
      throw new Error(
        'SUPPLIER_PROVIDER=dhru requires DHRU_API_URL, DHRU_USERNAME and DHRU_API_KEY.',
      );
    }
  }

  private async call(action: string, parameters: Record<string, string>) {
    const body = new URLSearchParams({
      username: this.username,
      apiaccesskey: this.apiKey,
      action,
      requestformat: 'JSON',
      ...parameters,
    });
    const response = await fetch(this.apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    if (!response.ok) {
      throw new Error(`Supplier returned HTTP ${response.status}`);
    }
    return (await response.json()) as Record<string, unknown>;
  }

  async place(request: SupplierOrderRequest): Promise<SupplierPlacement> {
    const result = await this.call('placeimeiorder', {
      ID: request.serviceCode,
      IMEI: request.imei,
      ...(request.model ? { MODEL: request.model } : {}),
    });
    const success = (result.SUCCESS as Array<Record<string, unknown>> | undefined)?.[0];
    const reference = success?.MESSAGE ?? success?.REFERENCEID;
    if (!reference) {
      const error = (result.ERROR as Array<{ MESSAGE?: string }> | undefined)?.[0]?.MESSAGE;
      throw new Error(error ?? 'Supplier rejected the order.');
    }
    return { supplierReference: String(reference) };
  }

  async poll(supplierReference: string): Promise<SupplierOutcome> {
    const result = await this.call('getimeiorder', { ID: supplierReference });
    const success = (result.SUCCESS as Array<Record<string, unknown>> | undefined)?.[0];
    if (!success) {
      const error = (result.ERROR as Array<{ MESSAGE?: string }> | undefined)?.[0]?.MESSAGE;
      return { state: 'rejected', message: error ?? 'Supplier returned no result.' };
    }

    const status = String(success.STATUS ?? '').toLowerCase();
    const code = success.CODE ? String(success.CODE) : '';

    if (status === 'available' && code) {
      return { state: 'delivered', code, message: 'The network approved the unlock.' };
    }
    if (status === 'rejected' || status === 'cancelled') {
      return {
        state: 'rejected',
        message: String(success.REMARK ?? 'The network declined this unlock.'),
      };
    }
    if (status === 'notfound') {
      return { state: 'not_found', message: 'The network has no record of this IMEI.' };
    }
    return { state: 'pending', message: 'The network is still processing this request.' };
  }
}

let cached: Supplier | null = null;

export function getSupplier(): Supplier {
  if (cached) return cached;
  cached =
    config.supplierProvider === 'dhru'
      ? new DhruSupplier(config.dhru.apiUrl, config.dhru.username, config.dhru.apiKey)
      : new MockSupplier();
  return cached;
}

/** Test seam: lets a test install a stub supplier. */
export function setSupplier(supplier: Supplier | null): void {
  cached = supplier;
}
