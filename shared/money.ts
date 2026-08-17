/** Money is stored and passed around in minor units (cents) everywhere. */

const SYMBOLS: Record<string, string> = {
  USD: '$',
  GBP: '£',
  EUR: '€',
  CAD: 'CA$',
  AUD: 'A$',
};

export function formatMoney(cents: number, currency = 'USD'): string {
  const symbol = SYMBOLS[currency] ?? `${currency} `;
  const sign = cents < 0 ? '-' : '';
  return `${sign}${symbol}${(Math.abs(cents) / 100).toFixed(2)}`;
}

export function formatEta(minHours: number, maxHours: number): string {
  const asUnit = (h: number) => (h < 24 ? `${h}h` : `${Math.round(h / 24)}d`);
  if (minHours === maxHours) return asUnit(minHours);
  return `${asUnit(minHours)} – ${asUnit(maxHours)}`;
}

export interface Discount {
  code: string;
  percent_off: number;
}

/**
 * Percentage discounts round half-up on the discount itself, so a customer is
 * never charged a cent more than the advertised percentage implies.
 */
export function applyDiscount(priceCents: number, discount?: Discount | null): number {
  if (!discount || discount.percent_off <= 0) return priceCents;
  const percent = Math.min(discount.percent_off, 100);
  const off = Math.round((priceCents * percent) / 100);
  return Math.max(0, priceCents - off);
}
