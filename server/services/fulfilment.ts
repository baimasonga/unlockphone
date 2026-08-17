import type Database from 'better-sqlite3';
import { db } from '../db/index.js';
import { config } from '../config.js';
import { getSupplier } from './supplier.js';
import { getPaymentProvider, findPaymentForOrder, recordPayment } from './payments.js';
import {
  getOrderById,
  recordEvent,
  toPublicOrder,
  transitionOrder,
} from './orders.js';
import { orderDeliveredMail, orderRefundedMail, sendMail } from '../lib/mail.js';
import type { Order } from '../../shared/types.js';

const MAX_ATTEMPTS = 60;

/**
 * Hands a paid order to the supplier. Called right after payment confirms;
 * failures here leave the order in `submitted` with an event logged, so the
 * poller retries rather than the customer losing their money silently.
 */
export async function submitToSupplier(
  orderId: number,
  database: Database.Database = db,
): Promise<Order> {
  const order = getOrderById(orderId, database);
  const service = database
    .prepare('SELECT supplier_code FROM services WHERE id = ?')
    .get(order.service_id) as { supplier_code: string | null } | undefined;

  const supplier = getSupplier();
  const placement = await supplier.place({
    serviceCode: service?.supplier_code ?? String(order.service_id),
    imei: order.imei,
    model: order.model,
  });

  database
    .prepare(
      `UPDATE orders SET supplier_reference = ?, next_poll_at = datetime('now'),
                         updated_at = datetime('now')
       WHERE id = ?`,
    )
    .run(placement.supplierReference, orderId);

  return transitionOrder(
    orderId,
    'in_progress',
    'Request accepted by the network and queued for processing.',
    { supplierReference: placement.supplierReference },
    database,
  );
}

/**
 * Polls one order and applies whatever the supplier says. Failure outcomes
 * refund automatically — the business promise is that a failed unlock costs
 * the customer nothing, and that promise is enforced here rather than left to
 * a support agent to remember.
 */
export async function processOrder(
  orderId: number,
  database: Database.Database = db,
): Promise<Order> {
  const order = getOrderById(orderId, database);
  if (order.status !== 'in_progress' && order.status !== 'submitted') return order;

  if (order.status === 'submitted') {
    return submitToSupplier(orderId, database);
  }
  if (!order.supplier_reference) return submitToSupplier(orderId, database);

  const attempts = order.attempts + 1;
  database.prepare('UPDATE orders SET attempts = ? WHERE id = ?').run(attempts, orderId);

  const outcome = await getSupplier().poll(order.supplier_reference);

  if (outcome.state === 'pending') {
    if (attempts >= MAX_ATTEMPTS) {
      // The supplier has gone quiet for too long. Refunding is the honest
      // outcome: we cannot show progress and will not hold the money.
      await refundOrder(
        orderId,
        'The network did not respond within our service window.',
        database,
      );
      return getOrderById(orderId, database);
    }
    // Back off gently so a slow network does not get hammered.
    const delaySeconds = Math.min(300, 5 * attempts);
    database
      .prepare(`UPDATE orders SET next_poll_at = datetime('now', ?) WHERE id = ?`)
      .run(`+${delaySeconds} seconds`, orderId);
    return order;
  }

  if (outcome.state === 'delivered') {
    const delivered = transitionOrder(
      orderId,
      'delivered',
      outcome.message,
      { resultCode: outcome.code, resultMessage: outcome.message },
      database,
    );
    await sendMail(orderDeliveredMail(toPublicOrder(delivered, database)));
    return delivered;
  }

  // not_found or rejected: mark the failure, then refund in the same pass.
  transitionOrder(orderId, outcome.state, outcome.message, {
    resultMessage: outcome.message,
  }, database);
  await refundOrder(orderId, outcome.message, database);
  return getOrderById(orderId, database);
}

export async function refundOrder(
  orderId: number,
  reason: string,
  database: Database.Database = db,
): Promise<Order> {
  const order = getOrderById(orderId, database);
  const payment = findPaymentForOrder(orderId, database);

  if (payment && payment.status === 'paid') {
    try {
      const result = await getPaymentProvider().refund(payment.provider_ref);
      if (result.refunded) {
        recordPayment(
          {
            orderId,
            provider: payment.provider,
            providerRef: payment.provider_ref,
            amountCents: order.price_cents,
            currency: order.currency,
            status: 'refunded',
          },
          database,
        );
      }
    } catch (error) {
      // Never strand the order because the processor hiccuped: log it, mark
      // the order refunded for the customer, and let finance reconcile.
      recordEvent(
        orderId,
        order.status,
        `Automatic refund failed and needs manual review: ${(error as Error).message}`,
        database,
      );
    }
  }

  const refunded = transitionOrder(orderId, 'refunded', `Refunded — ${reason}`, {}, database);
  await sendMail(orderRefundedMail(refunded, reason));
  return refunded;
}

/** Orders the worker should look at on this tick. */
export function dueOrders(database: Database.Database = db): Order[] {
  return database
    .prepare(
      `SELECT * FROM orders
       WHERE status IN ('submitted','in_progress')
         AND (next_poll_at IS NULL OR next_poll_at <= datetime('now'))
       ORDER BY id
       LIMIT 25`,
    )
    .all() as Order[];
}

export function startWorker(database: Database.Database = db): () => void {
  let running = false;

  const tick = async () => {
    if (running) return;
    running = true;
    try {
      for (const order of dueOrders(database)) {
        try {
          await processOrder(order.id, database);
        } catch (error) {
          console.error(`[worker] order ${order.reference} failed:`, error);
          recordEvent(
            order.id,
            order.status,
            `Processing error, will retry: ${(error as Error).message}`,
            database,
          );
        }
      }
    } finally {
      running = false;
    }
  };

  const handle = setInterval(tick, config.workerIntervalMs);
  // Do not hold the process open purely for the poller.
  handle.unref?.();
  console.log(`[worker] polling every ${config.workerIntervalMs}ms`);
  return () => clearInterval(handle);
}
