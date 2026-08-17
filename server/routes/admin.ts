import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/index.js';
import { ApiError, asyncRoute } from '../lib/errors.js';
import { requireAdmin } from '../lib/auth.js';
import { findOrderByReference, toPublicOrder, transitionOrder } from '../services/orders.js';
import { processOrder, refundOrder } from '../services/fulfilment.js';
import {
  findCaseByReference,
  fileForCase,
  toAdminCase,
  transitionCase,
} from '../services/ownership.js';
import { readFileSync } from 'node:fs';
import type { Order } from '../../shared/types.js';
import type { CaseStatus } from '../../shared/ownership.js';
import type { CaseRow } from '../services/ownership.js';

export const adminRouter = Router();

adminRouter.use(requireAdmin);

/** Headline numbers for the operator dashboard. */
adminRouter.get('/stats', (_req, res) => {
  const totals = db
    .prepare(
      `SELECT
         COUNT(*) AS orders,
         SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) AS delivered,
         SUM(CASE WHEN status IN ('submitted','in_progress') THEN 1 ELSE 0 END) AS working,
         SUM(CASE WHEN status = 'refunded' THEN 1 ELSE 0 END) AS refunded,
         SUM(CASE WHEN status = 'delivered' THEN price_cents ELSE 0 END) AS revenue_cents
       FROM orders`,
    )
    .get() as Record<string, number | null>;

  // Margin is revenue on delivered orders minus what those unlocks cost us.
  const cost = db
    .prepare(
      `SELECT COALESCE(SUM(s.cost_cents), 0) AS cost_cents
       FROM orders o JOIN services s ON s.id = o.service_id
       WHERE o.status = 'delivered'`,
    )
    .get() as { cost_cents: number };

  const byNetwork = db
    .prepare(
      `SELECT n.name AS network, COUNT(*) AS orders,
              SUM(CASE WHEN o.status = 'delivered' THEN 1 ELSE 0 END) AS delivered
       FROM orders o
       JOIN services s ON s.id = o.service_id
       JOIN networks n ON n.id = s.network_id
       GROUP BY n.id ORDER BY orders DESC LIMIT 10`,
    )
    .all();

  res.json({
    orders: totals.orders ?? 0,
    delivered: totals.delivered ?? 0,
    working: totals.working ?? 0,
    refunded: totals.refunded ?? 0,
    revenue_cents: totals.revenue_cents ?? 0,
    margin_cents: (totals.revenue_cents ?? 0) - cost.cost_cents,
    by_network: byNetwork,
  });
});

adminRouter.get('/orders', (req, res) => {
  const status = typeof req.query.status === 'string' ? req.query.status : undefined;
  const search = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  const limit = Math.min(Number(req.query.limit ?? 50), 200);

  const clauses: string[] = [];
  const params: unknown[] = [];
  if (status) {
    clauses.push('status = ?');
    params.push(status);
  }
  if (search) {
    clauses.push('(reference LIKE ? OR email LIKE ? OR imei LIKE ?)');
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

  const rows = db
    .prepare(`SELECT * FROM orders ${where} ORDER BY id DESC LIMIT ?`)
    .all(...params, limit) as Order[];

  // Admins see the raw IMEI and email — they need them to work a support case.
  res.json({
    orders: rows.map((row) => ({
      ...toPublicOrder(row),
      email: row.email,
      imei: row.imei,
      supplier_reference: row.supplier_reference,
      attempts: row.attempts,
    })),
  });
});

adminRouter.post(
  '/orders/:reference/refund',
  asyncRoute(async (req, res) => {
    const order = findOrderByReference(req.params.reference);
    if (!order) throw ApiError.notFound('Order not found.');
    const parsedReason = z.string().min(1).safeParse(req.body?.reason);
    const reason = parsedReason.success ? parsedReason.data : 'Refunded by support.';
    const refunded = await refundOrder(order.id, reason);
    res.json({ order: toPublicOrder(refunded) });
  }),
);

/** Force an immediate supplier poll instead of waiting for the worker. */
adminRouter.post(
  '/orders/:reference/poll',
  asyncRoute(async (req, res) => {
    const order = findOrderByReference(req.params.reference);
    if (!order) throw ApiError.notFound('Order not found.');
    const updated = await processOrder(order.id);
    res.json({ order: toPublicOrder(updated) });
  }),
);

/**
 * Manual delivery, for when a supplier hands a code over out of band (email,
 * phone) and it has to be entered by a human.
 */
adminRouter.post(
  '/orders/:reference/deliver',
  asyncRoute(async (req, res) => {
    const parsed = z
      .object({ code: z.string().min(1), message: z.string().optional() })
      .safeParse(req.body);
    if (!parsed.success) throw ApiError.badRequest('Provide the unlock code to deliver.');

    const order = findOrderByReference(req.params.reference);
    if (!order) throw ApiError.notFound('Order not found.');

    const delivered = transitionOrder(
      order.id,
      'delivered',
      parsed.data.message ?? 'Unlock delivered by support.',
      { resultCode: parsed.data.code, resultMessage: parsed.data.message ?? null },
    );
    res.json({ order: toPublicOrder(delivered) });
  }),
);

/** Price and availability editing for the catalog. */
adminRouter.patch(
  '/services/:id',
  asyncRoute(async (req, res) => {
    const parsed = z
      .object({
        price_cents: z.number().int().min(0).optional(),
        cost_cents: z.number().int().min(0).optional(),
        active: z.boolean().optional(),
        min_hours: z.number().int().min(0).optional(),
        max_hours: z.number().int().min(0).optional(),
      })
      .safeParse(req.body);
    if (!parsed.success) throw ApiError.badRequest('Nothing valid to update.');

    const fields = Object.entries(parsed.data).filter(([, v]) => v !== undefined);
    if (fields.length === 0) throw ApiError.badRequest('Nothing to update.');

    const sets = fields.map(([key]) => `${key} = ?`).join(', ');
    const values = fields.map(([, value]) =>
      typeof value === 'boolean' ? (value ? 1 : 0) : value,
    );
    const result = db
      .prepare(`UPDATE services SET ${sets} WHERE id = ?`)
      .run(...values, Number(req.params.id));
    if (result.changes === 0) throw ApiError.notFound('Service not found.');

    res.json({ ok: true });
  }),
);

// ── Proof-of-ownership cases ────────────────────────────────────────────────

adminRouter.get('/cases', (req, res) => {
  const status = typeof req.query.status === 'string' ? req.query.status : undefined;
  const search = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  const limit = Math.min(Number(req.query.limit ?? 50), 200);

  const clauses: string[] = [];
  const params: unknown[] = [];
  if (status) {
    clauses.push('status = ?');
    params.push(status);
  }
  if (search) {
    clauses.push('(reference LIKE ? OR email LIKE ? OR imei LIKE ? OR full_name LIKE ?)');
    params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

  const rows = db
    .prepare(`SELECT * FROM ownership_cases ${where} ORDER BY id DESC LIMIT ?`)
    .all(...params, limit) as CaseRow[];

  res.json({ cases: rows.map((row) => toAdminCase(row)) });
});

adminRouter.get('/cases/:reference', (req, res) => {
  const record = findCaseByReference(req.params.reference);
  if (!record) throw ApiError.notFound('Case not found.');
  res.json({ case: toAdminCase(record) });
});

/** Advance a case through the review workflow. */
adminRouter.post(
  '/cases/:reference/transition',
  asyncRoute(async (req, res) => {
    const parsed = z
      .object({
        status: z.enum([
          'reviewing',
          'needs_more_info',
          'verified',
          'submitted_to_authority',
          'resolved',
          'rejected',
        ]),
        message: z.string().max(500).optional(),
      })
      .safeParse(req.body);
    if (!parsed.success) throw ApiError.badRequest('Choose a valid next status.');

    const record = findCaseByReference(req.params.reference);
    if (!record) throw ApiError.notFound('Case not found.');

    const defaults: Record<CaseStatus, string> = {
      submitted: 'Case received.',
      reviewing: 'A specialist is reviewing your proof of ownership.',
      needs_more_info: 'We need clearer proof of purchase to continue — please reply with more detail.',
      verified: 'Ownership verified. We have prepared the submission for the manufacturer.',
      submitted_to_authority: 'Your verified request has been submitted to the manufacturer.',
      resolved: 'The manufacturer has actioned the request. This case is complete.',
      rejected: 'We could not verify ownership from the evidence provided.',
    };

    const updated = transitionCase(
      record.reference,
      parsed.data.status,
      parsed.data.message?.trim() || defaults[parsed.data.status],
      req.user!.email,
    );
    res.json({ case: toAdminCase(updated) });
  }),
);

/** Stream a proof file for review. Admin only. */
adminRouter.get('/cases/:reference/files/:fileId', (req, res) => {
  const file = fileForCase(req.params.reference, Number(req.params.fileId));
  res.setHeader('Content-Type', file.content_type);
  res.setHeader('Content-Disposition', `inline; filename="${file.filename}"`);
  res.send(readFileSync(file.storage_path));
});
