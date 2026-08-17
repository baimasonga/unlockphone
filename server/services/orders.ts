import { randomBytes } from 'node:crypto';
import type Database from 'better-sqlite3';
import { db } from '../db/index.js';
import { ApiError } from '../lib/errors.js';
import { getServiceById } from './catalog.js';
import { maskEmail, maskImei, validateImei, IMEI_ERROR_MESSAGES } from '../../shared/imei.js';
import {
  canTransition,
  STATUS_LABELS,
  type Order,
  type OrderEvent,
  type OrderStatus,
  type PublicOrder,
} from '../../shared/types.js';

/**
 * Human-friendly reference: a customer reads this over the phone, so it avoids
 * characters that sound alike and digits that look like letters.
 */
const ALPHABET = 'ACDEFGHJKLMNPQRTUVWXY34679';

export function generateReference(): string {
  const bytes = randomBytes(8);
  let body = '';
  for (let i = 0; i < 8; i++) body += ALPHABET[bytes[i] % ALPHABET.length];
  return `UL-${body.slice(0, 4)}-${body.slice(4)}`;
}

export interface CreateOrderInput {
  serviceId: number;
  imei: string;
  email: string;
  model?: string | null;
  userId?: number | null;
  priceCents: number;
  currency: string;
}

export function createOrder(
  input: CreateOrderInput,
  database: Database.Database = db,
): Order {
  const imei = validateImei(input.imei);
  if (!imei.valid) {
    throw ApiError.badRequest(IMEI_ERROR_MESSAGES[imei.error!]);
  }

  const service = getServiceById(input.serviceId, database);
  if (service.requires_model && !input.model?.trim()) {
    throw ApiError.badRequest(
      'Tell us the exact handset model so we can route this to the right unlock service.',
    );
  }

  // One open order per IMEI per service: a customer double-clicking checkout
  // should not pay twice for the same unlock.
  const open = database
    .prepare(
      `SELECT reference FROM orders
       WHERE imei = ? AND service_id = ?
         AND status IN ('awaiting_payment','submitted','in_progress')`,
    )
    .get(imei.normalised, input.serviceId) as { reference: string } | undefined;
  if (open) {
    throw ApiError.conflict(
      `This IMEI already has an unlock in progress (${open.reference}). Track that order instead of placing a new one.`,
    );
  }

  const reference = generateReference();
  const result = database
    .prepare(
      `INSERT INTO orders (reference, user_id, email, service_id, imei, model, status,
                           price_cents, currency)
       VALUES (?, ?, ?, ?, ?, ?, 'awaiting_payment', ?, ?)`,
    )
    .run(
      reference,
      input.userId ?? null,
      input.email.trim().toLowerCase(),
      input.serviceId,
      imei.normalised,
      input.model?.trim() || null,
      input.priceCents,
      input.currency,
    );

  const orderId = Number(result.lastInsertRowid);
  recordEvent(orderId, 'awaiting_payment', 'Order created, waiting for payment.', database);
  return getOrderById(orderId, database);
}

export function recordEvent(
  orderId: number,
  status: OrderStatus,
  message: string,
  database: Database.Database = db,
): void {
  database
    .prepare('INSERT INTO order_events (order_id, status, message) VALUES (?, ?, ?)')
    .run(orderId, status, message);
}

export function getOrderById(id: number, database: Database.Database = db): Order {
  const row = database.prepare('SELECT * FROM orders WHERE id = ?').get(id) as
    | Order
    | undefined;
  if (!row) throw ApiError.notFound('Order not found.');
  return row;
}

export function findOrderByReference(
  reference: string,
  database: Database.Database = db,
): Order | null {
  const row = database
    .prepare('SELECT * FROM orders WHERE reference = ?')
    .get(reference.trim().toUpperCase()) as Order | undefined;
  return row ?? null;
}

/**
 * Moves an order along its lifecycle, refusing any transition the state
 * machine does not allow. Centralising this is what stops a late supplier
 * callback from resurrecting a refunded order.
 */
export function transitionOrder(
  orderId: number,
  to: OrderStatus,
  message: string,
  extra: {
    resultCode?: string | null;
    resultMessage?: string | null;
    supplierReference?: string | null;
  } = {},
  database: Database.Database = db,
): Order {
  const order = getOrderById(orderId, database);
  if (order.status === to) return order;
  if (!canTransition(order.status, to)) {
    throw ApiError.conflict(
      `Cannot move order ${order.reference} from ${order.status} to ${to}.`,
    );
  }

  database
    .prepare(
      `UPDATE orders
       SET status = ?,
           result_code = COALESCE(?, result_code),
           result_message = COALESCE(?, result_message),
           supplier_reference = COALESCE(?, supplier_reference),
           delivered_at = CASE WHEN ? = 'delivered' THEN datetime('now') ELSE delivered_at END,
           updated_at = datetime('now')
       WHERE id = ?`,
    )
    .run(
      to,
      extra.resultCode ?? null,
      extra.resultMessage ?? null,
      extra.supplierReference ?? null,
      to,
      orderId,
    );

  recordEvent(orderId, to, message, database);
  return getOrderById(orderId, database);
}

export function listOrderEvents(
  orderId: number,
  database: Database.Database = db,
): OrderEvent[] {
  return database
    .prepare(
      'SELECT id, order_id, status, message, created_at FROM order_events WHERE order_id = ? ORDER BY id',
    )
    .all(orderId) as OrderEvent[];
}

/**
 * Shapes an order for the customer. The unlock code is withheld unless the
 * order is actually delivered, so a leaked reference cannot reveal a code for
 * an order still being paid for or already refunded.
 */
export function toPublicOrder(
  order: Order,
  database: Database.Database = db,
): PublicOrder {
  const service = getServiceById(order.service_id, database);
  const events = listOrderEvents(order.id, database).map((e) => ({
    status: e.status,
    message: e.message,
    created_at: e.created_at,
  }));

  return {
    reference: order.reference,
    email_masked: maskEmail(order.email),
    status: order.status,
    status_label: STATUS_LABELS[order.status],
    imei_masked: maskImei(order.imei),
    service: service.name,
    brand: service.brand,
    network: service.network,
    price_cents: order.price_cents,
    currency: order.currency,
    model: order.model,
    result_code: order.status === 'delivered' ? order.result_code : null,
    result_message: order.result_message,
    delivery_kind: service.delivery_kind,
    eta_hours: [service.min_hours, service.max_hours],
    created_at: order.created_at,
    delivered_at: order.delivered_at,
    events,
  };
}

export function listOrdersForUser(
  userId: number,
  database: Database.Database = db,
): PublicOrder[] {
  const rows = database
    .prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY id DESC')
    .all(userId) as Order[];
  return rows.map((row) => toPublicOrder(row, database));
}
