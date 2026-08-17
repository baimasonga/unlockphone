/**
 * Seed catalog. Prices are illustrative retail figures in cents; the cost
 * column is what a wholesale supplier would charge, and the gap between the
 * two is the margin the business runs on.
 */

export interface BrandSeed {
  slug: string;
  name: string;
  delivery_kind: 'code' | 'remote';
}

export const BRANDS: BrandSeed[] = [
  { slug: 'apple', name: 'Apple', delivery_kind: 'remote' },
  { slug: 'samsung', name: 'Samsung', delivery_kind: 'code' },
  { slug: 'google', name: 'Google Pixel', delivery_kind: 'code' },
  { slug: 'motorola', name: 'Motorola', delivery_kind: 'code' },
  { slug: 'huawei', name: 'Huawei', delivery_kind: 'code' },
  { slug: 'xiaomi', name: 'Xiaomi', delivery_kind: 'code' },
  { slug: 'oneplus', name: 'OnePlus', delivery_kind: 'code' },
  { slug: 'sony', name: 'Sony', delivery_kind: 'code' },
  { slug: 'nokia', name: 'Nokia', delivery_kind: 'code' },
  { slug: 'lg', name: 'LG', delivery_kind: 'code' },
  { slug: 'oppo', name: 'Oppo', delivery_kind: 'code' },
  { slug: 'other', name: 'Other brand', delivery_kind: 'code' },
];

export interface NetworkSeed {
  slug: string;
  name: string;
  country: string;
  country_code: string;
}

export const NETWORKS: NetworkSeed[] = [
  { slug: 'att-us', name: 'AT&T', country: 'United States', country_code: 'US' },
  { slug: 'tmobile-us', name: 'T-Mobile', country: 'United States', country_code: 'US' },
  { slug: 'verizon-us', name: 'Verizon', country: 'United States', country_code: 'US' },
  { slug: 'sprint-us', name: 'Sprint', country: 'United States', country_code: 'US' },
  { slug: 'metropcs-us', name: 'Metro by T-Mobile', country: 'United States', country_code: 'US' },
  { slug: 'cricket-us', name: 'Cricket Wireless', country: 'United States', country_code: 'US' },
  { slug: 'uscellular-us', name: 'US Cellular', country: 'United States', country_code: 'US' },
  { slug: 'ee-uk', name: 'EE', country: 'United Kingdom', country_code: 'GB' },
  { slug: 'o2-uk', name: 'O2', country: 'United Kingdom', country_code: 'GB' },
  { slug: 'vodafone-uk', name: 'Vodafone', country: 'United Kingdom', country_code: 'GB' },
  { slug: 'three-uk', name: 'Three', country: 'United Kingdom', country_code: 'GB' },
  { slug: 'tesco-uk', name: 'Tesco Mobile', country: 'United Kingdom', country_code: 'GB' },
  { slug: 'sky-uk', name: 'Sky Mobile', country: 'United Kingdom', country_code: 'GB' },
  { slug: 'rogers-ca', name: 'Rogers', country: 'Canada', country_code: 'CA' },
  { slug: 'bell-ca', name: 'Bell', country: 'Canada', country_code: 'CA' },
  { slug: 'telus-ca', name: 'Telus', country: 'Canada', country_code: 'CA' },
  { slug: 'fido-ca', name: 'Fido', country: 'Canada', country_code: 'CA' },
  { slug: 'telstra-au', name: 'Telstra', country: 'Australia', country_code: 'AU' },
  { slug: 'optus-au', name: 'Optus', country: 'Australia', country_code: 'AU' },
  { slug: 'vodafone-au', name: 'Vodafone', country: 'Australia', country_code: 'AU' },
  { slug: 'orange-fr', name: 'Orange', country: 'France', country_code: 'FR' },
  { slug: 'sfr-fr', name: 'SFR', country: 'France', country_code: 'FR' },
  { slug: 'movistar-es', name: 'Movistar', country: 'Spain', country_code: 'ES' },
  { slug: 'vodafone-de', name: 'Vodafone', country: 'Germany', country_code: 'DE' },
  { slug: 'telekom-de', name: 'Telekom', country: 'Germany', country_code: 'DE' },
];

/**
 * Per-network pricing profile. Apple unlocks are dearer and slower because
 * they go through the carrier's whitelist rather than a code generator.
 */
export interface PricingProfile {
  network: string;
  apple: { price: number; cost: number; min: number; max: number; rate: number };
  android: { price: number; cost: number; min: number; max: number; rate: number };
}

export const PRICING: PricingProfile[] = [
  {
    network: 'att-us',
    apple: { price: 4999, cost: 2600, min: 24, max: 72, rate: 0.94 },
    android: { price: 2999, cost: 1400, min: 2, max: 24, rate: 0.97 },
  },
  {
    network: 'tmobile-us',
    apple: { price: 5999, cost: 3200, min: 24, max: 120, rate: 0.9 },
    android: { price: 3499, cost: 1800, min: 4, max: 48, rate: 0.95 },
  },
  {
    network: 'verizon-us',
    apple: { price: 3999, cost: 2000, min: 12, max: 48, rate: 0.96 },
    android: { price: 2499, cost: 1100, min: 1, max: 12, rate: 0.98 },
  },
  {
    network: 'sprint-us',
    apple: { price: 6499, cost: 3600, min: 48, max: 168, rate: 0.85 },
    android: { price: 3999, cost: 2100, min: 24, max: 96, rate: 0.9 },
  },
  {
    network: 'metropcs-us',
    apple: { price: 5499, cost: 2900, min: 24, max: 96, rate: 0.91 },
    android: { price: 2999, cost: 1500, min: 4, max: 48, rate: 0.95 },
  },
  {
    network: 'cricket-us',
    apple: { price: 4499, cost: 2400, min: 24, max: 72, rate: 0.93 },
    android: { price: 2799, cost: 1300, min: 2, max: 24, rate: 0.96 },
  },
  {
    network: 'uscellular-us',
    apple: { price: 4999, cost: 2700, min: 24, max: 96, rate: 0.9 },
    android: { price: 2999, cost: 1500, min: 4, max: 48, rate: 0.94 },
  },
  {
    network: 'ee-uk',
    apple: { price: 2999, cost: 1500, min: 1, max: 24, rate: 0.98 },
    android: { price: 1999, cost: 900, min: 1, max: 12, rate: 0.98 },
  },
  {
    network: 'o2-uk',
    apple: { price: 2799, cost: 1400, min: 1, max: 24, rate: 0.98 },
    android: { price: 1899, cost: 850, min: 1, max: 12, rate: 0.98 },
  },
  {
    network: 'vodafone-uk',
    apple: { price: 2999, cost: 1500, min: 2, max: 48, rate: 0.97 },
    android: { price: 1999, cost: 900, min: 1, max: 24, rate: 0.97 },
  },
  {
    network: 'three-uk',
    apple: { price: 2599, cost: 1300, min: 1, max: 24, rate: 0.98 },
    android: { price: 1799, cost: 800, min: 1, max: 12, rate: 0.98 },
  },
  {
    network: 'tesco-uk',
    apple: { price: 2899, cost: 1450, min: 2, max: 48, rate: 0.96 },
    android: { price: 1899, cost: 850, min: 1, max: 24, rate: 0.97 },
  },
  {
    network: 'sky-uk',
    apple: { price: 3199, cost: 1600, min: 4, max: 72, rate: 0.95 },
    android: { price: 2099, cost: 950, min: 2, max: 24, rate: 0.96 },
  },
  {
    network: 'rogers-ca',
    apple: { price: 3999, cost: 2100, min: 12, max: 48, rate: 0.95 },
    android: { price: 2499, cost: 1200, min: 2, max: 24, rate: 0.97 },
  },
  {
    network: 'bell-ca',
    apple: { price: 3999, cost: 2100, min: 12, max: 48, rate: 0.95 },
    android: { price: 2499, cost: 1200, min: 2, max: 24, rate: 0.97 },
  },
  {
    network: 'telus-ca',
    apple: { price: 3799, cost: 2000, min: 12, max: 48, rate: 0.95 },
    android: { price: 2399, cost: 1150, min: 2, max: 24, rate: 0.97 },
  },
  {
    network: 'fido-ca',
    apple: { price: 3699, cost: 1950, min: 12, max: 48, rate: 0.95 },
    android: { price: 2299, cost: 1100, min: 2, max: 24, rate: 0.97 },
  },
  {
    network: 'telstra-au',
    apple: { price: 3499, cost: 1800, min: 12, max: 72, rate: 0.94 },
    android: { price: 2299, cost: 1050, min: 2, max: 24, rate: 0.96 },
  },
  {
    network: 'optus-au',
    apple: { price: 3299, cost: 1700, min: 12, max: 72, rate: 0.94 },
    android: { price: 2199, cost: 1000, min: 2, max: 24, rate: 0.96 },
  },
  {
    network: 'vodafone-au',
    apple: { price: 3299, cost: 1700, min: 12, max: 72, rate: 0.94 },
    android: { price: 2199, cost: 1000, min: 2, max: 24, rate: 0.96 },
  },
  {
    network: 'orange-fr',
    apple: { price: 3499, cost: 1800, min: 24, max: 96, rate: 0.93 },
    android: { price: 2299, cost: 1050, min: 4, max: 48, rate: 0.95 },
  },
  {
    network: 'sfr-fr',
    apple: { price: 3399, cost: 1750, min: 24, max: 96, rate: 0.93 },
    android: { price: 2199, cost: 1000, min: 4, max: 48, rate: 0.95 },
  },
  {
    network: 'movistar-es',
    apple: { price: 3299, cost: 1700, min: 24, max: 96, rate: 0.92 },
    android: { price: 2099, cost: 950, min: 4, max: 48, rate: 0.95 },
  },
  {
    network: 'vodafone-de',
    apple: { price: 3599, cost: 1850, min: 24, max: 96, rate: 0.93 },
    android: { price: 2399, cost: 1100, min: 4, max: 48, rate: 0.95 },
  },
  {
    network: 'telekom-de',
    apple: { price: 3799, cost: 1950, min: 24, max: 96, rate: 0.92 },
    android: { price: 2499, cost: 1150, min: 4, max: 48, rate: 0.94 },
  },
];

/**
 * A small TAC sample so model lookup is demonstrable offline. A production
 * deployment would sync the full GSMA TAC allocation list into this table.
 */
export const TAC_MODELS: Array<{ tac: string; brand_slug: string; model: string }> = [
  { tac: '35326111', brand_slug: 'apple', model: 'iPhone 15 Pro Max' },
  { tac: '35325811', brand_slug: 'apple', model: 'iPhone 15 Pro' },
  { tac: '35674011', brand_slug: 'apple', model: 'iPhone 15' },
  { tac: '35361310', brand_slug: 'apple', model: 'iPhone 14 Pro' },
  { tac: '35310310', brand_slug: 'apple', model: 'iPhone 14' },
  { tac: '35695811', brand_slug: 'apple', model: 'iPhone 13 Pro' },
  { tac: '35341510', brand_slug: 'apple', model: 'iPhone 13' },
  { tac: '35316810', brand_slug: 'apple', model: 'iPhone 12' },
  { tac: '35674910', brand_slug: 'apple', model: 'iPhone 11' },
  { tac: '35853104', brand_slug: 'apple', model: 'iPhone SE (3rd gen)' },
  { tac: '35204910', brand_slug: 'samsung', model: 'Galaxy S24 Ultra' },
  { tac: '35174611', brand_slug: 'samsung', model: 'Galaxy S24' },
  { tac: '35897510', brand_slug: 'samsung', model: 'Galaxy S23 Ultra' },
  { tac: '35462111', brand_slug: 'samsung', model: 'Galaxy S23' },
  { tac: '35339510', brand_slug: 'samsung', model: 'Galaxy S22' },
  { tac: '35131911', brand_slug: 'samsung', model: 'Galaxy A54 5G' },
  { tac: '35662310', brand_slug: 'samsung', model: 'Galaxy Z Flip 5' },
  { tac: '35847011', brand_slug: 'google', model: 'Pixel 8 Pro' },
  { tac: '35162311', brand_slug: 'google', model: 'Pixel 8' },
  { tac: '35429510', brand_slug: 'google', model: 'Pixel 7a' },
  { tac: '35895110', brand_slug: 'motorola', model: 'Moto G Power (2023)' },
  { tac: '35741110', brand_slug: 'oneplus', model: 'OnePlus 12' },
  { tac: '35983110', brand_slug: 'xiaomi', model: 'Redmi Note 13 Pro' },
];

export const DISCOUNTS = [
  { code: 'WELCOME10', percent_off: 10, active: 1, expires_at: null },
  { code: 'RETURN15', percent_off: 15, active: 1, expires_at: null },
];
