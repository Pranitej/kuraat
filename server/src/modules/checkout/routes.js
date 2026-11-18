/**
 * /api/v1/checkout/quote — which branch will deliver to an address, how far it is, and the delivery
 * slot. Used by the Delivery step and by the product page's "Delivered from …" line (productIds).
 * For branch pickup (design 2026-11-18 §5.3) it estimates the nearest hub to where the customer is
 * and prices the stored cart without the delivery fee (the server owns every price).
 */
import express from 'express';
import { z } from 'zod';
import { requireAuth } from '../../http/auth.js';
import { conflict, notFound } from '../../http/errors.js';
import { validate } from '../../http/validate.js';
import { findAddress, listAddresses, toAddress } from '../addresses/routes.js';
import { findUserById } from '../auth/service.js';
import { loadCart, priceForUser } from '../cart/routes.js';
import { deliveryCandidates } from './branchChoice.js';
import { deliveryWindow } from './window.js';

const quoteSchema = z
  .object({
    fulfilment: z.enum(['delivery', 'pickup']).default('delivery'),
    addressId: z.string().min(1).optional(),
    productIds: z.array(z.string().min(1).max(64)).max(50).optional(),
    location: z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) }).optional(),
  })
  .superRefine((body, ctx) => {
    if (body.fulfilment === 'delivery' && !body.addressId) ctx.addIssue({ code: 'custom', path: ['addressId'], message: 'Choose a delivery address.' });
  });

export function checkoutRoutes(ctx) {
  const router = express.Router();
  router.use(requireAuth(ctx));

  /** Where the customer is for a pickup: the request, else their last known location, else their usual address. */
  async function pickupLocation(userId, requested) {
    if (requested) return requested;
    const user = await findUserById(ctx.db, userId);
    if (user?.last_lat != null && user?.last_lng != null) return { lat: Number(user.last_lat), lng: Number(user.last_lng) };
    const usual = await listAddresses(ctx.db, userId).first();
    return usual ? toAddress(usual).location : null;
  }

  router.post('/quote', validate({ body: quoteSchema }), async (req, res) => {
    const cart = await loadCart(ctx.db, req.userId);
    const items = req.body.productIds
      ? req.body.productIds.map((productId) => ({ productId, qty: 1 }))
      : cart.items.map(({ productId, qty }) => ({ productId, qty }));

    if (req.body.fulfilment === 'pickup') {
      const location = await pickupLocation(req.userId, req.body.location);
      const { totals } = await priceForUser(ctx, req.userId, cart, { fulfilment: 'pickup' });
      const found = location ? await deliveryCandidates(ctx, location, items) : null;
      const chosen = found?.candidates[0] ?? null;
      return res.json({
        fulfilment: 'pickup',
        branch: chosen?.branch ?? null,
        distanceKm: chosen?.distanceKm ?? null,
        isNearest: chosen ? chosen.branch.id === found.nearestId : null,
        inStock: chosen ? found.inStock : null,
        totals,
      });
    }

    const address = await findAddress(ctx.db, req.userId, req.body.addressId);
    if (!address) throw notFound('not_found', 'This address no longer exists.');
    const location = { lat: Number(address.lat), lng: Number(address.lng) };
    const { candidates, nearestId, inStock } = await deliveryCandidates(ctx, location, items);
    if (!candidates.length) throw conflict('no_branch', "We don't have a branch that delivers to this address yet.");
    const [chosen] = candidates;
    const { start, end } = deliveryWindow(ctx.clock.now());
    return res.json({
      branch: chosen.branch,
      distanceKm: chosen.distanceKm,
      isNearest: chosen.branch.id === nearestId,
      inStock,
      window: { start: start.toISOString(), end: end.toISOString() },
    });
  });

  return router;
}
