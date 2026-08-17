import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/index.js';
import { ApiError, asyncRoute } from '../lib/errors.js';
import { rateLimit } from '../lib/rate-limit.js';
import { requireAuth } from '../lib/auth.js';
import { findDiscount, findService, getServiceById } from '../services/catalog.js';
import {
  createOrder,
  findOrderByReference,
  listOrdersForUser,
  toPublicOrder,
  transitionOrder,
} from '../services/orders.js';
import {
  findPaymentForOrder,
  getPaymentProvider,
  recordPayment,
} from '../services/payments.js';
import { submitToSupplier } from '../services/fulfilment.js';
import { assertDeviceEligibleForUnlock } from '../services/device-status.js';
import { orderConfirmationMail, sendMail } from '../lib/mail.js';
import { applyDiscount } from '../../shared/money.js';
import { validateImei } from '../../shared/imei.js';

export const orderRouter = Router();

const createSchema = z.object({
  brand: z.string().min(1),
  network: z.string().min(1),
  imei: z.string().min(1),
  email: z.string().email('We need a valid email to send your unlock to.'),
  model: z.string().max(120).optional().nullable(),
  discount_code: z.string().max(40).optional().nullable(),
});

/**
 * Creates an order and its payment intent in one step. The price is resolved
 * server-side from the catalog — never trusted from the client — so a tampered
 * request cannot buy a $50 unlock for a dollar.
 */
orderRouter.post(
  '/',
  rateLimit({ windowMs: 60_000, max: 12 }),
  asyncRoute(async (req, res) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) throw ApiError.badRequest(parsed.error.issues[0].message);
    const input = parsed.data;

    const service = findService(input.brand, input.network);

    // Refuse blacklisted / lost-stolen devices before taking any money — the
    // network would only reject them and force a refund anyway.
    await assertDeviceEligibleForUnlock(validateImei(input.imei).normalised);

    const discount = input.discount_code ? findDiscount(input.discount_code) : null;
    if (input.discount_code && !discount) {
      throw ApiError.badRequest('That discount code is not valid or has expired.');
    }
    const priceCents = applyDiscount(service.price_cents, discount);

    const order = createOrder({
      serviceId: service.id,
      imei: input.imei,
      email: input.email,
      model: input.model ?? null,
      userId: req.user?.id ?? null,
      priceCents,
      currency: service.currency,
    });

    const intent = await getPaymentProvider().createIntent({
      orderId: order.id,
      amountCents: priceCents,
      currency: service.currency,
      email: order.email,
    });
    recordPayment({
      orderId: order.id,
      provider: intent.provider,
      providerRef: intent.reference,
      amountCents: priceCents,
      currency: service.currency,
      status: 'pending',
    });

    res.status(201).json({
      order: toPublicOrder(order),
      payment: {
        provider: intent.provider,
        reference: intent.reference,
        checkout_url: intent.checkout_url,
        amount_cents: priceCents,
        currency: service.currency,
        list_price_cents: service.price_cents,
        discount: discount ? { code: discount.code, percent_off: discount.percent_off } : null,
      },
    });
  }),
);

/**
 * Confirms payment, then submits to the supplier. Submission failure is not
 * fatal: the order stays `submitted` and the worker retries, because the money
 * is already taken and the customer is owed the unlock either way.
 */
orderRouter.post(
  '/:reference/confirm-payment',
  rateLimit({ windowMs: 60_000, max: 20 }),
  asyncRoute(async (req, res) => {
    const order = findOrderByReference(req.params.reference);
    if (!order) throw ApiError.notFound('Order not found.');

    if (order.status !== 'awaiting_payment') {
      // Confirming twice is harmless — return the current state rather than an
      // error, since a double-submitted checkout form is a common accident.
      res.json({ order: toPublicOrder(order) });
      return;
    }

    const payment = findPaymentForOrder(order.id);
    if (!payment) throw ApiError.badRequest('No payment was started for this order.');

    const result = await getPaymentProvider().confirm(payment.provider_ref);
    if (!result.paid) {
      throw ApiError.badRequest('That payment has not completed yet.');
    }

    recordPayment({
      orderId: order.id,
      provider: payment.provider,
      providerRef: payment.provider_ref,
      amountCents: order.price_cents,
      currency: order.currency,
      status: 'paid',
    });

    const submitted = transitionOrder(
      order.id,
      'submitted',
      'Payment received. Submitting your request to the network.',
    );

    const service = getServiceById(order.service_id);
    await sendMail(orderConfirmationMail(submitted, service.name));

    try {
      await submitToSupplier(order.id);
    } catch (error) {
      console.error('[orders] supplier submission deferred to worker:', error);
    }

    res.json({ order: toPublicOrder(findOrderByReference(order.reference)!) });
  }),
);

/**
 * Public tracking. Requires reference *and* the email on the order, so a
 * guessed reference alone reveals nothing.
 */
orderRouter.post(
  '/track',
  rateLimit({ windowMs: 60_000, max: 20 }),
  asyncRoute(async (req, res) => {
    const parsed = z
      .object({ reference: z.string().min(1), email: z.string().email() })
      .safeParse(req.body);
    if (!parsed.success) {
      throw ApiError.badRequest('Enter both your order reference and the email you used.');
    }

    const order = findOrderByReference(parsed.data.reference);
    const matches =
      order && order.email === parsed.data.email.trim().toLowerCase();
    if (!order || !matches) {
      throw ApiError.notFound(
        'No order matches that reference and email. Check the confirmation email you received.',
      );
    }

    res.json({ order: toPublicOrder(order) });
  }),
);

/** Signed-in customers get their order history without needing references. */
orderRouter.get('/mine', requireAuth, (req, res) => {
  res.json({ orders: listOrdersForUser(req.user!.id) });
});

orderRouter.get(
  '/mine/:reference',
  requireAuth,
  asyncRoute(async (req, res) => {
    const order = findOrderByReference(req.params.reference);
    if (!order || order.user_id !== req.user!.id) {
      throw ApiError.notFound('Order not found.');
    }
    res.json({ order: toPublicOrder(order) });
  }),
);

/** Cancel is only allowed before payment — after that a refund is the path. */
orderRouter.post(
  '/:reference/cancel',
  asyncRoute(async (req, res) => {
    const order = findOrderByReference(req.params.reference);
    if (!order) throw ApiError.notFound('Order not found.');

    const owns =
      (req.user && order.user_id === req.user.id) ||
      req.body?.email?.trim?.().toLowerCase() === order.email;
    if (!owns) throw ApiError.forbidden('That is not your order.');

    if (order.status !== 'awaiting_payment') {
      throw ApiError.conflict(
        'This order is already with the network. Contact support if you need it refunded.',
      );
    }

    const cancelled = transitionOrder(order.id, 'cancelled', 'Cancelled by the customer.');
    db.prepare("UPDATE payments SET status = 'failed' WHERE order_id = ? AND status = 'pending'").run(
      order.id,
    );
    res.json({ order: toPublicOrder(cancelled) });
  }),
);
