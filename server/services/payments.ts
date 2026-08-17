import { randomBytes } from 'node:crypto';
import type Database from 'better-sqlite3';
import { db } from '../db/index.js';
import { config } from '../config.js';
import { ApiError } from '../lib/errors.js';

export interface PaymentIntent {
  provider: string;
  reference: string;
  amount_cents: number;
  currency: string;
  /** Where the client should send the customer to authorise the charge. */
  checkout_url: string | null;
}

/**
 * Payments are modelled as an intent that is later confirmed, which is the
 * shape every real processor uses. The mock provider confirms immediately so
 * the rest of the system can be exercised without a Stripe account.
 */
export interface PaymentProvider {
  readonly name: string;
  createIntent(input: {
    orderId: number;
    amountCents: number;
    currency: string;
    email: string;
  }): Promise<PaymentIntent>;
  confirm(reference: string): Promise<{ paid: boolean }>;
  refund(reference: string): Promise<{ refunded: boolean }>;
}

class MockPaymentProvider implements PaymentProvider {
  readonly name = 'mock';

  async createIntent(input: {
    orderId: number;
    amountCents: number;
    currency: string;
  }): Promise<PaymentIntent> {
    const reference = `pi_mock_${randomBytes(9).toString('hex')}`;
    return {
      provider: this.name,
      reference,
      amount_cents: input.amountCents,
      currency: input.currency,
      // No redirect: the client posts straight to /api/payments/confirm.
      checkout_url: null,
    };
  }

  async confirm(): Promise<{ paid: boolean }> {
    return { paid: true };
  }

  async refund(): Promise<{ refunded: boolean }> {
    return { refunded: true };
  }
}

class StripePaymentProvider implements PaymentProvider {
  readonly name = 'stripe';

  constructor(private readonly secretKey: string) {
    if (!secretKey) {
      throw new Error('PAYMENT_PROVIDER=stripe requires STRIPE_SECRET_KEY.');
    }
  }

  private async call(path: string, body: Record<string, string>) {
    const response = await fetch(`https://api.stripe.com/v1/${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(body),
    });
    const json = (await response.json()) as Record<string, any>;
    if (!response.ok) {
      throw new ApiError(502, json?.error?.message ?? 'Payment provider error.', 'payment_error');
    }
    return json;
  }

  async createIntent(input: {
    orderId: number;
    amountCents: number;
    currency: string;
    email: string;
  }): Promise<PaymentIntent> {
    const intent = await this.call('payment_intents', {
      amount: String(input.amountCents),
      currency: input.currency.toLowerCase(),
      receipt_email: input.email,
      'metadata[order_id]': String(input.orderId),
      'automatic_payment_methods[enabled]': 'true',
    });
    return {
      provider: this.name,
      reference: intent.id,
      amount_cents: input.amountCents,
      currency: input.currency,
      checkout_url: intent.client_secret ?? null,
    };
  }

  async confirm(reference: string): Promise<{ paid: boolean }> {
    const intent = await this.call(`payment_intents/${reference}`, {});
    return { paid: intent.status === 'succeeded' };
  }

  async refund(reference: string): Promise<{ refunded: boolean }> {
    const refund = await this.call('refunds', { payment_intent: reference });
    return { refunded: refund.status === 'succeeded' || refund.status === 'pending' };
  }
}

let cached: PaymentProvider | null = null;

export function getPaymentProvider(): PaymentProvider {
  if (cached) return cached;
  cached =
    config.paymentProvider === 'stripe'
      ? new StripePaymentProvider(config.stripeSecretKey)
      : new MockPaymentProvider();
  return cached;
}

export function setPaymentProvider(provider: PaymentProvider | null): void {
  cached = provider;
}

export function recordPayment(
  input: {
    orderId: number;
    provider: string;
    providerRef: string;
    amountCents: number;
    currency: string;
    status: 'pending' | 'paid' | 'refunded' | 'failed';
  },
  database: Database.Database = db,
): void {
  database
    .prepare(
      `INSERT INTO payments (order_id, provider, provider_ref, amount_cents, currency, status)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(provider, provider_ref) DO UPDATE SET status = excluded.status`,
    )
    .run(
      input.orderId,
      input.provider,
      input.providerRef,
      input.amountCents,
      input.currency,
      input.status,
    );
}

export function findPaymentForOrder(
  orderId: number,
  database: Database.Database = db,
): { provider: string; provider_ref: string; status: string } | null {
  const row = database
    .prepare(
      `SELECT provider, provider_ref, status FROM payments
       WHERE order_id = ? ORDER BY id DESC LIMIT 1`,
    )
    .get(orderId) as { provider: string; provider_ref: string; status: string } | undefined;
  return row ?? null;
}
