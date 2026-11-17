/** /api/v1/orders — place, list, detail (live from ROF), cancel, resend delivery code. */
import express from 'express';
import { z } from 'zod';
import { requireAuth } from '../../http/auth.js';
import { validate } from '../../http/validate.js';
import { phoneSchema } from '../auth/phone.js';
import { placeOrder } from './place.js';

/** Saudi Arabia: card (incl. Mada) or cash on delivery. UPI is India-only and is not offered. */
const paymentSchema = z.discriminatedUnion(
  'method',
  [
    z.object({
      method: z.literal('card'),
      card: z.object({ number: z.string().max(30), expiry: z.string().max(10), cvv: z.string().max(4) }),
      saveCard: z.boolean().optional(),
    }),
    z.object({ method: z.literal('cod') }),
  ],
  { error: (issue) => (issue.code === 'invalid_union' ? 'Choose card or cash on delivery.' : undefined) },
);

const placeSchema = z.object({
  addressId: z.string().min(1),
  deliveryPhone: phoneSchema,
  promoCode: z.string().max(40).nullable().optional(),
  payment: paymentSchema,
  idempotencyKey: z.uuid('Start the checkout again.'),
});

export function orderRoutes(ctx) {
  const router = express.Router();
  router.use(requireAuth(ctx));

  router.post('/', validate({ body: placeSchema }), async (req, res) => {
    const { order, created } = await placeOrder(ctx, req.userId, req.body);
    res.status(created ? 201 : 200).json(order);
  });

  // ?refresh=true — the apps' refresh button: re-read ROF now (throttled in the service).
  const refreshQuery = z.enum(['true', 'false']).optional();

  router.get('/', validate({ query: z.object({ tab: z.enum(['ongoing', 'delivered', 'all']).default('all'), refresh: refreshQuery }) }), async (req, res) => {
    res.json(await ctx.orders.list(req.userId, req.validQuery.tab, { refresh: req.validQuery.refresh === 'true' }));
  });

  router.get('/:id', validate({ query: z.object({ refresh: refreshQuery }) }), async (req, res) => {
    res.json(await ctx.orders.get(req.userId, req.params.id, { refresh: req.validQuery.refresh === 'true' }));
  });

  router.post('/:id/cancel', async (req, res) => {
    res.json(await ctx.orders.cancel(req.userId, req.params.id));
  });

  router.post('/:id/resend-code', async (req, res) => {
    res.json(await ctx.orders.resendCode(req.userId, req.params.id));
  });

  return router;
}
