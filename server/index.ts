import express from 'express';
import cookieParser from 'cookie-parser';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { config } from './config.js';
import { db } from './db/index.js';
import { seed, seedAdmin } from './db/seed.js';
import { attachUser } from './lib/auth.js';
import { errorHandler } from './lib/errors.js';
import { catalogRouter } from './routes/catalog.js';
import { authRouter } from './routes/auth.js';
import { orderRouter } from './routes/orders.js';
import { checksRouter } from './routes/checks.js';
import { ownershipRouter } from './routes/ownership.js';
import { adminRouter } from './routes/admin.js';
import { startWorker } from './services/fulfilment.js';

const app = express();

// Behind a proxy the client IP arrives in X-Forwarded-For; the rate limiter
// keys on req.ip, so this has to be trusted for limits to mean anything.
app.set('trust proxy', 1);
app.disable('x-powered-by');

app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());
app.use(attachUser);

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, supplier: config.supplierProvider, payments: config.paymentProvider });
});

app.use('/api/catalog', catalogRouter);
app.use('/api/auth', authRouter);
app.use('/api/orders', orderRouter);
app.use('/api/checks', checksRouter);
app.use('/api/ownership', ownershipRouter);
app.use('/api/admin', adminRouter);

app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'No such endpoint.', code: 'not_found' });
});

// In production the built client is served from the same origin, so there is
// no CORS surface at all.
const clientDir = resolve(process.cwd(), 'dist/client');
if (existsSync(clientDir)) {
  app.use(express.static(clientDir));
  app.get('*', (_req, res) => {
    res.sendFile(resolve(clientDir, 'index.html'));
  });
}

app.use(errorHandler);

seed();
seedAdmin();
const stopWorker = startWorker();

const server = app.listen(config.port, () => {
  console.log(`[api] listening on http://localhost:${config.port}`);
});

function shutdown(signal: string) {
  console.log(`\n[api] ${signal} received, shutting down`);
  stopWorker();
  server.close(() => {
    db.close();
    process.exit(0);
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
