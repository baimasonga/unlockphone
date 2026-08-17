import { Router } from 'express';
import { z } from 'zod';
import { asyncRoute, ApiError } from '../lib/errors.js';
import { rateLimit } from '../lib/rate-limit.js';
import {
  findService,
  listBrands,
  listNetworks,
  listNetworksByCountry,
  lookupTac,
  priceFrom,
} from '../services/catalog.js';
import { validateImei, IMEI_ERROR_MESSAGES } from '../../shared/imei.js';

export const catalogRouter = Router();

catalogRouter.get('/brands', (_req, res) => {
  res.json({ brands: listBrands() });
});

catalogRouter.get('/networks', (req, res) => {
  const country = typeof req.query.country === 'string' ? req.query.country : undefined;
  const query = typeof req.query.q === 'string' ? req.query.q : undefined;
  res.json({ networks: listNetworks({ country, query }) });
});

catalogRouter.get('/networks/grouped', (_req, res) => {
  res.json({ countries: listNetworksByCountry() });
});

catalogRouter.get('/brands/:slug/price-from', (req, res) => {
  const price = priceFrom(req.params.slug);
  if (!price) throw ApiError.notFound('No active services for that brand.');
  res.json(price);
});

const quoteSchema = z.object({
  brand: z.string().min(1),
  network: z.string().min(1),
});

/** Price and SLA for one brand+network pair. */
catalogRouter.get('/quote', (req, res) => {
  const parsed = quoteSchema.safeParse(req.query);
  if (!parsed.success) {
    throw ApiError.badRequest('Choose both a phone brand and a network.');
  }
  res.json({ service: findService(parsed.data.brand, parsed.data.network) });
});

/**
 * Device identification from the IMEI's TAC. Rate limited because it is the
 * one unauthenticated endpoint that reads our device database, and we do not
 * want it scraped wholesale.
 */
catalogRouter.post(
  '/imei/check',
  rateLimit({ windowMs: 60_000, max: 20 }),
  asyncRoute(async (req, res) => {
    const body = z.object({ imei: z.string() }).safeParse(req.body);
    if (!body.success) throw ApiError.badRequest('Send an IMEI to check.');

    const result = validateImei(body.data.imei);
    if (!result.valid) {
      res.status(200).json({
        valid: false,
        reason: IMEI_ERROR_MESSAGES[result.error!],
      });
      return;
    }

    const match = result.tac ? lookupTac(result.tac) : null;
    res.json({
      valid: true,
      imei: result.normalised,
      tac: result.tac,
      brand_slug: match?.brand_slug ?? null,
      model: match?.model ?? null,
      // A TAC we have not catalogued is common and not an error — the customer
      // just picks their brand by hand instead.
      recognised: Boolean(match),
    });
  }),
);
