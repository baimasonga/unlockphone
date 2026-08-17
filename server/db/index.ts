import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { config } from '../config.js';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('customer','admin')),
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS brands (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  slug          TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  delivery_kind TEXT NOT NULL CHECK (delivery_kind IN ('code','remote'))
);

CREATE TABLE IF NOT EXISTS networks (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  slug         TEXT NOT NULL UNIQUE,
  name         TEXT NOT NULL,
  country      TEXT NOT NULL,
  country_code TEXT NOT NULL
);

-- One sellable unlock = brand x network, priced independently.
CREATE TABLE IF NOT EXISTS services (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  brand_id       INTEGER NOT NULL REFERENCES brands(id),
  network_id     INTEGER NOT NULL REFERENCES networks(id),
  name           TEXT NOT NULL,
  price_cents    INTEGER NOT NULL CHECK (price_cents >= 0),
  cost_cents     INTEGER NOT NULL DEFAULT 0,
  currency       TEXT NOT NULL DEFAULT 'USD',
  min_hours      INTEGER NOT NULL DEFAULT 1,
  max_hours      INTEGER NOT NULL DEFAULT 24,
  success_rate   REAL NOT NULL DEFAULT 0.95,
  active         INTEGER NOT NULL DEFAULT 1,
  requires_model INTEGER NOT NULL DEFAULT 0,
  supplier_code  TEXT,
  UNIQUE (brand_id, network_id)
);

CREATE TABLE IF NOT EXISTS orders (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  reference          TEXT NOT NULL UNIQUE,
  user_id            INTEGER REFERENCES users(id),
  email              TEXT NOT NULL,
  service_id         INTEGER NOT NULL REFERENCES services(id),
  imei               TEXT NOT NULL,
  model              TEXT,
  status             TEXT NOT NULL DEFAULT 'awaiting_payment',
  price_cents        INTEGER NOT NULL,
  currency           TEXT NOT NULL DEFAULT 'USD',
  result_code        TEXT,
  result_message     TEXT,
  supplier_reference TEXT,
  -- Set once the worker picks the order up, so retries are bounded.
  attempts           INTEGER NOT NULL DEFAULT 0,
  next_poll_at       TEXT,
  created_at         TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at         TEXT NOT NULL DEFAULT (datetime('now')),
  delivered_at       TEXT
);

CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_email ON orders(email);
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);

CREATE TABLE IF NOT EXISTS order_events (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id   INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  status     TEXT NOT NULL,
  message    TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_events_order ON order_events(order_id);

CREATE TABLE IF NOT EXISTS payments (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id      INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  provider      TEXT NOT NULL,
  provider_ref  TEXT NOT NULL,
  amount_cents  INTEGER NOT NULL,
  currency      TEXT NOT NULL,
  status        TEXT NOT NULL CHECK (status IN ('pending','paid','refunded','failed')),
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (provider, provider_ref)
);

CREATE TABLE IF NOT EXISTS discounts (
  code         TEXT PRIMARY KEY COLLATE NOCASE,
  percent_off  INTEGER NOT NULL CHECK (percent_off BETWEEN 1 AND 100),
  active       INTEGER NOT NULL DEFAULT 1,
  expires_at   TEXT
);

-- Type Allocation Code -> handset name, so we can echo the model back before payment.
CREATE TABLE IF NOT EXISTS tac_models (
  tac        TEXT PRIMARY KEY,
  brand_slug TEXT NOT NULL,
  model      TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions_revoked (
  jti        TEXT PRIMARY KEY,
  revoked_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Log of device status lookups, for support history and abuse monitoring.
CREATE TABLE IF NOT EXISTS device_checks (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  imei        TEXT NOT NULL,
  blacklist   TEXT NOT NULL,
  icloud_lock TEXT NOT NULL,
  frp_lock    TEXT NOT NULL,
  carrier     TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_device_checks_imei ON device_checks(imei);

-- Proof-of-ownership cases: the lawful, owner-verified route to lock removal.
CREATE TABLE IF NOT EXISTS ownership_cases (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  reference     TEXT NOT NULL UNIQUE,
  user_id       INTEGER REFERENCES users(id),
  email         TEXT NOT NULL,
  full_name     TEXT NOT NULL,
  imei          TEXT NOT NULL,
  device_model  TEXT,
  brand_slug    TEXT,
  lock_type     TEXT NOT NULL CHECK (lock_type IN ('screen_lock','google_frp','icloud_activation')),
  purchase_info TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'submitted',
  authority_key TEXT,
  package       TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_cases_email ON ownership_cases(email);
CREATE INDEX IF NOT EXISTS idx_cases_status ON ownership_cases(status);

CREATE TABLE IF NOT EXISTS ownership_case_events (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  case_id    INTEGER NOT NULL REFERENCES ownership_cases(id) ON DELETE CASCADE,
  status     TEXT NOT NULL,
  message    TEXT NOT NULL,
  actor      TEXT NOT NULL DEFAULT 'system',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_case_events_case ON ownership_case_events(case_id);

CREATE TABLE IF NOT EXISTS ownership_case_files (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  case_id      INTEGER NOT NULL REFERENCES ownership_cases(id) ON DELETE CASCADE,
  filename     TEXT NOT NULL,
  content_type TEXT NOT NULL,
  byte_size    INTEGER NOT NULL,
  storage_path TEXT NOT NULL,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_case_files_case ON ownership_case_files(case_id);
`;

function open(): Database.Database {
  const path = resolve(process.cwd(), config.databasePath);
  mkdirSync(dirname(path), { recursive: true });
  const database = new Database(path);
  database.pragma('journal_mode = WAL');
  database.pragma('foreign_keys = ON');
  database.exec(SCHEMA);
  return database;
}

export const db = open();

/** Opens a separate in-memory database, used by the tests. */
export function createTestDb(): Database.Database {
  const database = new Database(':memory:');
  database.pragma('foreign_keys = ON');
  database.exec(SCHEMA);
  return database;
}
