import type Database from 'better-sqlite3';
import { beforeEach, describe, expect, it } from 'vitest';
import { createTestDb } from '../db/index.js';
import { seed } from '../db/seed.js';
import { findService } from './catalog.js';
import {
  createOrder,
  findOrderByReference,
  generateReference,
  toPublicOrder,
  transitionOrder,
} from './orders.js';
import { ApiError } from '../lib/errors.js';

const VALID_IMEI = '353261110006674';
const OTHER_IMEI = '353261110004000';

let database: Database.Database;

function newOrder(imei = VALID_IMEI, email = 'buyer@example.com') {
  const service = findService('apple', 'att-us', database);
  return createOrder(
    {
      serviceId: service.id,
      imei,
      email,
      priceCents: service.price_cents,
      currency: service.currency,
    },
    database,
  );
}

beforeEach(() => {
  database = createTestDb();
  seed(database);
});

describe('generateReference', () => {
  it('produces a readable, prefixed reference', () => {
    expect(generateReference()).toMatch(/^UL-[ACDEFGHJKLMNPQRTUVWXY34679]{4}-[ACDEFGHJKLMNPQRTUVWXY34679]{4}$/);
  });

  it('does not collide across a large batch', () => {
    const seen = new Set(Array.from({ length: 2000 }, generateReference));
    expect(seen.size).toBe(2000);
  });
});

describe('createOrder', () => {
  it('creates an unpaid order with an opening event', () => {
    const order = newOrder();
    expect(order.status).toBe('awaiting_payment');
    expect(order.imei).toBe(VALID_IMEI);
    expect(toPublicOrder(order, database).events).toHaveLength(1);
  });

  it('normalises the email so tracking matches regardless of case', () => {
    const order = newOrder(VALID_IMEI, 'Buyer@Example.COM');
    expect(order.email).toBe('buyer@example.com');
  });

  it('rejects an IMEI that fails its checksum before taking any money', () => {
    expect(() => newOrder('353261110006675')).toThrow(ApiError);
  });

  it('refuses a second open order for the same IMEI and service', () => {
    newOrder();
    expect(() => newOrder()).toThrow(/already has an unlock in progress/);
  });

  it('allows a new order once the previous one is finished', () => {
    const first = newOrder();
    transitionOrder(first.id, 'cancelled', 'Cancelled by the customer.', {}, database);
    expect(() => newOrder()).not.toThrow();
  });

  it('demands a model where the service cannot infer one', () => {
    const service = findService('other', 'att-us', database);
    expect(() =>
      createOrder(
        {
          serviceId: service.id,
          imei: OTHER_IMEI,
          email: 'buyer@example.com',
          priceCents: service.price_cents,
          currency: service.currency,
        },
        database,
      ),
    ).toThrow(/exact handset model/);
  });
});

describe('transitionOrder', () => {
  it('records an event for every legal move', () => {
    const order = newOrder();
    transitionOrder(order.id, 'submitted', 'Payment received.', {}, database);
    const updated = transitionOrder(
      order.id,
      'in_progress',
      'Queued at the network.',
      {},
      database,
    );
    expect(updated.status).toBe('in_progress');
    expect(toPublicOrder(updated, database).events).toHaveLength(3);
  });

  it('stamps delivered_at exactly when the unlock lands', () => {
    const order = newOrder();
    transitionOrder(order.id, 'submitted', 'Paid.', {}, database);
    const delivered = transitionOrder(
      order.id,
      'delivered',
      'Approved.',
      { resultCode: '12345678' },
      database,
    );
    expect(delivered.delivered_at).toBeTruthy();
    expect(delivered.result_code).toBe('12345678');
  });

  it('blocks a jump that would skip payment', () => {
    const order = newOrder();
    expect(() =>
      transitionOrder(order.id, 'delivered', 'Should not happen.', {}, database),
    ).toThrow(/Cannot move order/);
  });

  it('is idempotent when asked to repeat the current status', () => {
    const order = newOrder();
    const same = transitionOrder(order.id, 'awaiting_payment', 'Repeat.', {}, database);
    expect(same.status).toBe('awaiting_payment');
    expect(toPublicOrder(same, database).events).toHaveLength(1);
  });
});

describe('toPublicOrder', () => {
  it('withholds the unlock code until the order is actually delivered', () => {
    const order = newOrder();
    transitionOrder(order.id, 'submitted', 'Paid.', {}, database);
    transitionOrder(order.id, 'in_progress', 'Queued.', {}, database);

    // A code can exist on the row before the status catches up; it must not leak.
    database
      .prepare('UPDATE orders SET result_code = ? WHERE id = ?')
      .run('99887766', order.id);

    const inProgress = toPublicOrder(findOrderByReference(order.reference, database)!, database);
    expect(inProgress.result_code).toBeNull();

    transitionOrder(order.id, 'delivered', 'Approved.', {}, database);
    const delivered = toPublicOrder(findOrderByReference(order.reference, database)!, database);
    expect(delivered.result_code).toBe('99887766');
  });

  it('masks the IMEI and email it exposes', () => {
    const publicOrder = toPublicOrder(newOrder(), database);
    expect(publicOrder.imei_masked).not.toBe(VALID_IMEI);
    expect(publicOrder.email_masked).toContain('@example.com');
    expect(publicOrder.email_masked).not.toBe('buyer@example.com');
  });
});

describe('findOrderByReference', () => {
  it('is case-insensitive, since customers retype references by hand', () => {
    const order = newOrder();
    expect(findOrderByReference(order.reference.toLowerCase(), database)?.id).toBe(order.id);
  });

  it('returns null rather than throwing for an unknown reference', () => {
    expect(findOrderByReference('UL-XXXX-XXXX', database)).toBeNull();
  });
});
