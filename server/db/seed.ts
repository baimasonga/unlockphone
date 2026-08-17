import bcrypt from 'bcryptjs';
import type Database from 'better-sqlite3';
import { db } from './index.js';
import {
  BRANDS,
  DISCOUNTS,
  NETWORKS,
  PRICING,
  TAC_MODELS,
} from './catalog-data.js';

/**
 * Idempotent seed: safe to re-run, since every insert is an upsert keyed on
 * the natural key. Re-running refreshes prices without orphaning orders that
 * already reference a service row.
 */
export function seed(database: Database.Database = db): void {
  const insertBrand = database.prepare(
    `INSERT INTO brands (slug, name, delivery_kind) VALUES (?, ?, ?)
     ON CONFLICT(slug) DO UPDATE SET name = excluded.name,
                                     delivery_kind = excluded.delivery_kind`,
  );
  const insertNetwork = database.prepare(
    `INSERT INTO networks (slug, name, country, country_code) VALUES (?, ?, ?, ?)
     ON CONFLICT(slug) DO UPDATE SET name = excluded.name,
                                     country = excluded.country,
                                     country_code = excluded.country_code`,
  );
  const insertService = database.prepare(
    `INSERT INTO services
       (brand_id, network_id, name, price_cents, cost_cents, currency,
        min_hours, max_hours, success_rate, active, requires_model, supplier_code)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
     ON CONFLICT(brand_id, network_id) DO UPDATE SET
       name = excluded.name,
       price_cents = excluded.price_cents,
       cost_cents = excluded.cost_cents,
       min_hours = excluded.min_hours,
       max_hours = excluded.max_hours,
       success_rate = excluded.success_rate`,
  );
  const insertTac = database.prepare(
    `INSERT INTO tac_models (tac, brand_slug, model) VALUES (?, ?, ?)
     ON CONFLICT(tac) DO UPDATE SET model = excluded.model`,
  );
  const insertDiscount = database.prepare(
    `INSERT INTO discounts (code, percent_off, active, expires_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(code) DO UPDATE SET percent_off = excluded.percent_off,
                                     active = excluded.active`,
  );

  const run = database.transaction(() => {
    for (const brand of BRANDS) {
      insertBrand.run(brand.slug, brand.name, brand.delivery_kind);
    }
    for (const network of NETWORKS) {
      insertNetwork.run(network.slug, network.name, network.country, network.country_code);
    }

    const brandRows = database
      .prepare('SELECT id, slug, name FROM brands')
      .all() as Array<{ id: number; slug: string; name: string }>;
    const networkRows = database
      .prepare('SELECT id, slug, name, country_code FROM networks')
      .all() as Array<{ id: number; slug: string; name: string; country_code: string }>;

    const currencyFor = (countryCode: string) =>
      ({ US: 'USD', GB: 'GBP', CA: 'CAD', AU: 'AUD' })[countryCode] ?? 'EUR';

    for (const profile of PRICING) {
      const network = networkRows.find((n) => n.slug === profile.network);
      if (!network) continue;
      for (const brand of brandRows) {
        const tier = brand.slug === 'apple' ? profile.apple : profile.android;
        // "Other brand" needs the customer to tell us the handset, since we
        // cannot infer a supplier service from the TAC alone.
        const requiresModel = brand.slug === 'other' ? 1 : 0;
        insertService.run(
          brand.id,
          network.id,
          `${brand.name} unlock — ${network.name}`,
          tier.price,
          tier.cost,
          currencyFor(network.country_code),
          tier.min,
          tier.max,
          tier.rate,
          requiresModel,
          `${brand.slug}:${network.slug}`,
        );
      }
    }

    for (const tac of TAC_MODELS) insertTac.run(tac.tac, tac.brand_slug, tac.model);
    for (const d of DISCOUNTS) insertDiscount.run(d.code, d.percent_off, d.active, d.expires_at);
  });

  run();
}

/** Creates the default admin only when no admin exists yet. */
export function seedAdmin(
  database: Database.Database = db,
  email = 'admin@example.com',
  password = 'admin12345',
): void {
  const existing = database
    .prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'admin'")
    .get() as { n: number };
  if (existing.n > 0) return;
  database
    .prepare('INSERT INTO users (email, password_hash, role) VALUES (?, ?, ?)')
    .run(email, bcrypt.hashSync(password, 10), 'admin');
  console.log(`[seed] created admin ${email} / ${password} — change this password`);
}

// Running `npm run seed` executes this module directly.
if (process.argv[1]?.endsWith('seed.ts') || process.argv[1]?.endsWith('seed.js')) {
  seed();
  seedAdmin();
  const counts = db
    .prepare(
      `SELECT (SELECT COUNT(*) FROM brands) AS brands,
              (SELECT COUNT(*) FROM networks) AS networks,
              (SELECT COUNT(*) FROM services) AS services`,
    )
    .get();
  console.log('[seed] done', counts);
}
