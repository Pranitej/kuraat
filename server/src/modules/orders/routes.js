/** /api/v1/orders — place, list, detail (live from ROF), cancel, resend delivery code. */
import express from 'express';
import { z } from 'zod';
import { requireAuth } from '../../http/auth.js';
import { validate } from '../../http/validate.js';
import { phoneSchema } from '../auth/phone.js';
import { placeOrder } from './place.js';

const paymentSchema = z.discriminatedUnion('method', [
  z.object({
    method: z.literal('card'),
    card: z.object({ number: z.string().max(30), expiry: z.string().max(10), cvv: z.string().max(4) }),
    saveCard: z.boolean().optional(),
  }),
  z.object({ method: z.literal('upi'), upiId: z.string().max(120) }),
  z.object({ method: z.literal('cod') }),
]);

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

  router.get('/', validate({ query: z.object({ tab: z.enum(['ongoing', 'delivered', 'all']).default('all') }) }), async (req, res) => {
    res.json(await ctx.orders.list(req.userId, req.validQuery.tab));
  });

  router.get('/:id', async (req, res) => {
    res.json(await ctx.orders.get(req.userId, req.params.id));
  });

  router.post('/:id/cancel', async (req, res) => {
    res.json(await ctx.orders.cancel(req.userId, req.params.id));
  });

  router.post('/:id/resend-code', async (req, res) => {
    res.json(await ctx.orders.resendCode(req.userId, req.params.id));
  });

  return router;
}
