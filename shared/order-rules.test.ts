import { describe, expect, it } from 'vitest';
import { applyDiscount, formatEta, formatMoney } from './money';
import { canTransition, ORDER_TRANSITIONS, type OrderStatus } from './types';

describe('money', () => {
  it('formats minor units with the right symbol', () => {
    expect(formatMoney(4999, 'USD')).toBe('$49.99');
    expect(formatMoney(2999, 'GBP')).toBe('£29.99');
    expect(formatMoney(0, 'USD')).toBe('$0.00');
  });

  it('falls back to the currency code when there is no symbol', () => {
    expect(formatMoney(1000, 'SEK')).toBe('SEK 10.00');
  });

  it('renders an ETA range in the largest sensible unit', () => {
    expect(formatEta(1, 12)).toBe('1h – 12h');
    // 24 hours reads better as a day, and the range may mix units.
    expect(formatEta(1, 24)).toBe('1h – 1d');
    expect(formatEta(24, 72)).toBe('1d – 3d');
    expect(formatEta(4, 4)).toBe('4h');
  });
});

describe('applyDiscount', () => {
  it('returns the list price when there is no code', () => {
    expect(applyDiscount(4999, null)).toBe(4999);
  });

  it('takes the advertised percentage off', () => {
    expect(applyDiscount(4999, { code: 'WELCOME10', percent_off: 10 })).toBe(4499);
  });

  it('never rounds a customer up past the advertised discount', () => {
    // 15% of 1999 is 299.85; the discount rounds to 300, not down to 299.
    expect(applyDiscount(1999, { code: 'RETURN15', percent_off: 15 })).toBe(1699);
  });

  it('clamps a bad percentage instead of producing a negative price', () => {
    expect(applyDiscount(4999, { code: 'BROKEN', percent_off: 500 })).toBe(0);
    expect(applyDiscount(4999, { code: 'ZERO', percent_off: 0 })).toBe(4999);
  });
});

describe('order state machine', () => {
  it('walks the happy path from payment to delivery', () => {
    expect(canTransition('awaiting_payment', 'submitted')).toBe(true);
    expect(canTransition('submitted', 'in_progress')).toBe(true);
    expect(canTransition('in_progress', 'delivered')).toBe(true);
  });

  it('never lets a delivered or refunded order move again', () => {
    for (const terminal of ['delivered', 'refunded', 'cancelled'] as OrderStatus[]) {
      expect(ORDER_TRANSITIONS[terminal]).toHaveLength(0);
    }
  });

  it('refuses to deliver an order that was never paid for', () => {
    expect(canTransition('awaiting_payment', 'delivered')).toBe(false);
    expect(canTransition('awaiting_payment', 'in_progress')).toBe(false);
  });

  it('routes every failure state to a refund and nowhere else', () => {
    expect(ORDER_TRANSITIONS.not_found).toEqual(['refunded']);
    expect(ORDER_TRANSITIONS.rejected).toEqual(['refunded']);
  });

  it('cannot resurrect a refunded order into delivery', () => {
    expect(canTransition('refunded', 'delivered')).toBe(false);
    expect(canTransition('cancelled', 'submitted')).toBe(false);
  });
});
