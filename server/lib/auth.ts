import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { NextFunction, Request, Response } from 'express';
import { config } from '../config.js';
import { db } from '../db/index.js';
import { ApiError } from './errors.js';
import type { User } from '../../shared/types.js';

const COOKIE_NAME = 'session';
const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7;

export interface SessionUser {
  id: number;
  email: string;
  role: 'customer' | 'admin';
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: SessionUser;
    }
  }
}

export function hashPassword(password: string): string {
  return bcrypt.hashSync(password, 10);
}

export function verifyPassword(password: string, hash: string): boolean {
  return bcrypt.compareSync(password, hash);
}

export function issueSession(res: Response, user: SessionUser): string {
  const token = jwt.sign(
    { sub: String(user.id), email: user.email, role: user.role },
    config.jwtSecret,
    { expiresIn: TOKEN_TTL_SECONDS },
  );
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.isProduction,
    maxAge: TOKEN_TTL_SECONDS * 1000,
    path: '/',
  });
  return token;
}

export function clearSession(res: Response): void {
  res.clearCookie(COOKIE_NAME, { path: '/' });
}

/**
 * Populates req.user when a valid session cookie is present. Never rejects —
 * routes that require a user call requireAuth, and the rest stay public so
 * guest checkout keeps working.
 */
export function attachUser(req: Request, _res: Response, next: NextFunction): void {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return next();
  try {
    const payload = jwt.verify(token, config.jwtSecret) as jwt.JwtPayload;
    const user = db
      .prepare('SELECT id, email, role FROM users WHERE id = ?')
      .get(Number(payload.sub)) as SessionUser | undefined;
    // Re-reading the row means a deleted or demoted user loses access on their
    // next request rather than when the token happens to expire.
    if (user) req.user = user;
  } catch {
    // An expired or tampered token is simply treated as signed out.
  }
  next();
}

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) return next(ApiError.unauthorized());
  next();
}

export function requireAdmin(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) return next(ApiError.unauthorized());
  if (req.user.role !== 'admin') return next(ApiError.forbidden());
  next();
}

export function toPublicUser(user: SessionUser & { created_at?: string }): User {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    created_at: user.created_at ?? '',
  };
}
