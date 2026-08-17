import type Database from 'better-sqlite3';
import { db } from '../db/index.js';
import { ApiError } from '../lib/errors.js';
import type { Brand, Network, PublicService } from '../../shared/types.js';

interface ServiceRow extends PublicService {
  brand_slug: string;
  network_slug: string;
  cost_cents: number;
  active: number;
  requires_model_int: number;
  delivery_kind: 'code' | 'remote';
}

const SERVICE_SELECT = `
  SELECT s.id, s.name, s.price_cents, s.currency, s.min_hours, s.max_hours,
         s.success_rate, s.cost_cents, s.active,
         s.requires_model AS requires_model_int,
         b.name AS brand, b.slug AS brand_slug, b.delivery_kind,
         n.name AS network, n.slug AS network_slug, n.country
  FROM services s
  JOIN brands b ON b.id = s.brand_id
  JOIN networks n ON n.id = s.network_id
`;

function toPublic(row: ServiceRow): PublicService {
  return {
    id: row.id,
    name: row.name,
    brand: row.brand,
    network: row.network,
    country: row.country,
    price_cents: row.price_cents,
    currency: row.currency,
    min_hours: row.min_hours,
    max_hours: row.max_hours,
    success_rate: row.success_rate,
    delivery_kind: row.delivery_kind,
    requires_model: row.requires_model_int === 1,
  };
}

export function listBrands(database: Database.Database = db): Brand[] {
  return database
    .prepare('SELECT id, slug, name, delivery_kind FROM brands ORDER BY id')
    .all() as Brand[];
}

export function listNetworks(
  filter: { country?: string; query?: string } = {},
  database: Database.Database = db,
): Network[] {
  const clauses: string[] = [];
  const params: unknown[] = [];
  if (filter.country) {
    clauses.push('country_code = ?');
    params.push(filter.country.toUpperCase());
  }
  if (filter.query) {
    clauses.push('(name LIKE ? OR country LIKE ?)');
    params.push(`%${filter.query}%`, `%${filter.query}%`);
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  return database
    .prepare(
      `SELECT id, slug, name, country, country_code FROM networks
       ${where} ORDER BY country, name`,
    )
    .all(...params) as Network[];
}

/** Groups networks by country for the country-first network picker. */
export function listNetworksByCountry(
  database: Database.Database = db,
): Array<{ country: string; country_code: string; networks: Network[] }> {
  const grouped = new Map<string, { country: string; country_code: string; networks: Network[] }>();
  for (const network of listNetworks({}, database)) {
    const entry = grouped.get(network.country_code) ?? {
      country: network.country,
      country_code: network.country_code,
      networks: [],
    };
    entry.networks.push(network);
    grouped.set(network.country_code, entry);
  }
  return [...grouped.values()].sort((a, b) => a.country.localeCompare(b.country));
}

export function findService(
  brandSlug: string,
  networkSlug: string,
  database: Database.Database = db,
): PublicService {
  const row = database
    .prepare(`${SERVICE_SELECT} WHERE b.slug = ? AND n.slug = ? AND s.active = 1`)
    .get(brandSlug, networkSlug) as ServiceRow | undefined;
  if (!row) {
    throw ApiError.notFound(
      'We do not currently unlock that brand on that network. Contact support and we will look into sourcing it.',
    );
  }
  return toPublic(row);
}

export function getServiceById(
  id: number,
  database: Database.Database = db,
): PublicService {
  const row = database
    .prepare(`${SERVICE_SELECT} WHERE s.id = ? AND s.active = 1`)
    .get(id) as ServiceRow | undefined;
  if (!row) throw ApiError.notFound('That unlock service is no longer available.');
  return toPublic(row);
}

/** Cheapest active price per brand, used for the "from $X" copy on landing pages. */
export function priceFrom(
  brandSlug: string,
  database: Database.Database = db,
): { price_cents: number; currency: string } | null {
  const row = database
    .prepare(
      `SELECT s.price_cents, s.currency FROM services s
       JOIN brands b ON b.id = s.brand_id
       WHERE b.slug = ? AND s.active = 1
       ORDER BY s.price_cents ASC LIMIT 1`,
    )
    .get(brandSlug) as { price_cents: number; currency: string } | undefined;
  return row ?? null;
}

export function lookupTac(
  tac: string,
  database: Database.Database = db,
): { brand_slug: string; model: string } | null {
  const row = database
    .prepare('SELECT brand_slug, model FROM tac_models WHERE tac = ?')
    .get(tac) as { brand_slug: string; model: string } | undefined;
  return row ?? null;
}

export function findDiscount(
  code: string,
  database: Database.Database = db,
): { code: string; percent_off: number } | null {
  const row = database
    .prepare(
      `SELECT code, percent_off FROM discounts
       WHERE code = ? AND active = 1
         AND (expires_at IS NULL OR expires_at > datetime('now'))`,
    )
    .get(code.trim()) as { code: string; percent_off: number } | undefined;
  return row ?? null;
}
