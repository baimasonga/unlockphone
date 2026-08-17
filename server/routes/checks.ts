import { Router } from 'express';
import { z } from 'zod';
import { asyncRoute, ApiError } from '../lib/errors.js';
import { rateLimit } from '../lib/rate-limit.js';
import { checkDeviceStatus } from '../services/device-status.js';

export const checksRouter = Router();

/**
 * Full device status report: blacklist, carrier lock, and activation/FRP lock
 * state. Rate limited like the other IMEI-database endpoints to deter scraping.
 */
checksRouter.post(
  '/device-status',
  rateLimit({ windowMs: 60_000, max: 15 }),
  asyncRoute(async (req, res) => {
    const body = z.object({ imei: z.string() }).safeParse(req.body);
    if (!body.success) throw ApiError.badRequest('Send an IMEI to check.');
    const report = await checkDeviceStatus(body.data.imei);
    res.json({ report });
  }),
);
