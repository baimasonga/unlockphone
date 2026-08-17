import type { NextFunction, Request, Response } from 'express';
import { ApiError } from './errors.js';

interface Bucket {
  count: number;
  resetAt: number;
}

/**
 * Fixed-window limiter kept in process memory. Enough to blunt credential
 * stuffing and IMEI-scraping on a single node; a multi-node deployment would
 * point this at Redis instead.
 */
export function rateLimit(options: {
  windowMs: number;
  max: number;
  key?: (req: Request) => string;
}) {
  const buckets = new Map<string, Bucket>();
  const keyFor = options.key ?? ((req: Request) => req.ip ?? 'unknown');

  return (req: Request, _res: Response, next: NextFunction): void => {
    const now = Date.now();
    const key = keyFor(req);
    const bucket = buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + options.windowMs });
      // Opportunistic sweep so the map cannot grow without bound.
      if (buckets.size > 5000) {
        for (const [k, v] of buckets) if (v.resetAt <= now) buckets.delete(k);
      }
      return next();
    }

    bucket.count += 1;
    if (bucket.count > options.max) {
      const seconds = Math.ceil((bucket.resetAt - now) / 1000);
      return next(ApiError.tooMany(`Too many attempts. Try again in ${seconds}s.`));
    }
    next();
  };
}
