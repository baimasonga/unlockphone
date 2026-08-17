import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/index.js';
import { ApiError, asyncRoute } from '../lib/errors.js';
import { rateLimit } from '../lib/rate-limit.js';
import {
  clearSession,
  hashPassword,
  issueSession,
  requireAuth,
  verifyPassword,
} from '../lib/auth.js';

export const authRouter = Router();

const credentials = z.object({
  email: z.string().email('Enter a valid email address.'),
  password: z.string().min(8, 'Use at least 8 characters.'),
});

authRouter.post(
  '/register',
  rateLimit({ windowMs: 60 * 60_000, max: 10 }),
  asyncRoute(async (req, res) => {
    const parsed = credentials.safeParse(req.body);
    if (!parsed.success) {
      throw ApiError.badRequest(parsed.error.issues[0].message);
    }
    const email = parsed.data.email.trim().toLowerCase();

    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) {
      throw ApiError.conflict('An account with that email already exists. Sign in instead.');
    }

    const result = db
      .prepare('INSERT INTO users (email, password_hash) VALUES (?, ?)')
      .run(email, hashPassword(parsed.data.password));
    const user = { id: Number(result.lastInsertRowid), email, role: 'customer' as const };

    // Adopt any guest orders placed with this address so they show in the
    // dashboard straight away.
    db.prepare('UPDATE orders SET user_id = ? WHERE email = ? AND user_id IS NULL').run(
      user.id,
      email,
    );

    issueSession(res, user);
    res.status(201).json({ user });
  }),
);

authRouter.post(
  '/login',
  rateLimit({ windowMs: 15 * 60_000, max: 10 }),
  asyncRoute(async (req, res) => {
    const parsed = credentials.safeParse(req.body);
    if (!parsed.success) throw ApiError.unauthorized('Email or password is incorrect.');

    const email = parsed.data.email.trim().toLowerCase();
    const row = db
      .prepare('SELECT id, email, role, password_hash FROM users WHERE email = ?')
      .get(email) as
      | { id: number; email: string; role: 'customer' | 'admin'; password_hash: string }
      | undefined;

    // Same message either way, so this cannot be used to enumerate accounts.
    if (!row || !verifyPassword(parsed.data.password, row.password_hash)) {
      throw ApiError.unauthorized('Email or password is incorrect.');
    }

    const user = { id: row.id, email: row.email, role: row.role };
    issueSession(res, user);
    res.json({ user });
  }),
);

authRouter.post('/logout', (_req, res) => {
  clearSession(res);
  res.json({ ok: true });
});

authRouter.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});
