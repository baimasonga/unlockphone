import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Minimal .env loader so the project runs with no extra dependency. Real
 * process env always wins, which is what container platforms inject.
 */
function loadDotEnv(file = '.env'): void {
  const path = resolve(process.cwd(), file);
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadDotEnv();

const isProduction = process.env.NODE_ENV === 'production';

function requiredInProduction(key: string, fallback: string): string {
  const value = process.env[key];
  if (value && value.length > 0) return value;
  if (isProduction) {
    throw new Error(
      `${key} must be set in production. Refusing to start with a default.`,
    );
  }
  return fallback;
}

export const config = {
  isProduction,
  port: Number(process.env.PORT ?? 8787),
  jwtSecret: requiredInProduction('JWT_SECRET', 'dev-only-insecure-secret'),
  databasePath: process.env.DATABASE_PATH ?? './data/unlockphone.db',
  paymentProvider: (process.env.PAYMENT_PROVIDER ?? 'mock') as 'mock' | 'stripe',
  stripeSecretKey: process.env.STRIPE_SECRET_KEY ?? '',
  supplierProvider: (process.env.SUPPLIER_PROVIDER ?? 'mock') as 'mock' | 'dhru',
  dhru: {
    apiUrl: process.env.DHRU_API_URL ?? '',
    username: process.env.DHRU_USERNAME ?? '',
    apiKey: process.env.DHRU_API_KEY ?? '',
  },
  workerIntervalMs: Number(process.env.WORKER_INTERVAL_MS ?? 5000),
  // When on, unlock orders are refused up front for blacklisted / lost-stolen
  // devices instead of being taken and later refunded.
  precheckDevices: (process.env.PRECHECK_DEVICES ?? 'true') !== 'false',
  uploadsDir: process.env.UPLOADS_DIR ?? './data/uploads',
  maxProofBytes: Number(process.env.MAX_PROOF_BYTES ?? 8 * 1024 * 1024),
  mailTransport: (process.env.MAIL_TRANSPORT ?? 'console') as 'console' | 'smtp',
  mailFrom: process.env.MAIL_FROM ?? 'Unlock Support <support@example.com>',
};
