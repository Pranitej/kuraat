/** /api/v1/orders — place, list, detail (live from ROF), pay by card (RSOF payment link), cancel, resend delivery code. */
import express from 'express';
import { z } from 'zod';
import { requireAuth } from '../../http/auth.js';
import { validate } from '../../http/validate.js';
import { placeOrder } from './place.js';

/**
 * Saudi Arabia: card (incl. Mada), cash on delivery (delivery orders) or pay at the branch (pickup
 * orders). UPI is India-only and is not offered. A card is paid on RSOF's payment page after the order is
 * placed (19 Nov 2026), so no card details are sent. An older app build still sends them and has no "Pay now"
 * screen: its card order would never be paid, so it is refused (nothing created, the details never stored or logged).
 */
const OLD_APP_CARD = 'Please update the app to pay by card, or choose another payment method.';
const paymentSchema = z.discriminatedUnion(
  'method',
  [
    z
      .object({ method: z.literal('card'), card: z.unknown().optional() })
      .refine((p) => p.card === undefined, { path: ['method'], message: OLD_APP_CARD }),
    z.object({ method: z.literal('cod') }),
    z.object({ method: z.literal('branch') }),
  ],
  { error: (issue) => (issue.code === 'invalid_union' ? 'Choose card or cash on delivery.' : undefined) },
);

const placeSchema = z
  .object({
    fulfilment: z.enum(['delivery', 'pickup']).default('delivery'),
    // Which app placed the order; RSOF staff see it as the order's source. Older app builds send none = mobile.
    channel: z.enum(['web', 'mobile']).default('mobile'),
    addressId: z.string().min(1).optional(),
    payment: paymentSchema,
    idempotencyKey: z.uuid('Start the checkout again.'),
  })
  // Delivery needs an address and pays by card or cash; pickup has no address and pays by card or at the branch.
  .superRefine((order, ctx) => {
    const pickup = order.fulfilment === 'pickup';
    if (pickup && order.addressId) ctx.addIssue({ code: 'custom', path: ['addressId'], message: 'A pickup order has no delivery address.' });
    if (!pickup && !order.addressId) ctx.addIssue({ code: 'custom', path: ['addressId'], message: 'Choose a delivery address.' });
    const allowed = pickup ? ['card', 'branch'] : ['card', 'cod'];
    if (!allowed.includes(order.payment.method)) {
      ctx.addIssue({ code: 'custom', path: ['payment', 'method'], message: pickup ? 'Choose card or pay at branch.' : 'Choose card or cash on delivery.' });
    }
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

  // Card orders placed in the app: RSOF's payment page ({ status: 'pending', link, expiresAt, amount, currency })
  // or { status: 'paid' }. The apps ask when they show an unpaid order and when the customer comes back from paying.
  router.post('/:id/pay', async (req, res) => {
    res.json(await ctx.payments.pay(req.userId, req.params.id));
  });

  router.post('/:id/resend-code', async (req, res) => {
    res.json(await ctx.orders.resendCode(req.userId, req.params.id));
  });

  return router;
}
