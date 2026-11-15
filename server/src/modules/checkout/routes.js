/**
 * /api/v1/checkout/quote — which branch will deliver to an address, how far it is, and the delivery
 * slot. Used by the Delivery step and by the product page's "Delivered from …" line (productIds).
 */
import express from 'express';
import { z } from 'zod';
import { requireAuth } from '../../http/auth.js';
import { conflict, notFound } from '../../http/errors.js';
import { validate } from '../../http/validate.js';
import { findAddress } from '../addresses/routes.js';
import { loadCart } from '../cart/routes.js';
import { deliveryCandidates } from './branchChoice.js';
import { deliveryWindow } from './window.js';

export function checkoutRoutes(ctx) {
  const router = express.Router();
  router.use(requireAuth(ctx));

  router.post(
    '/quote',
    validate({ body: z.object({ addressId: z.string().min(1), productIds: z.array(z.string().min(1).max(64)).max(50).optional() }) }),
    async (req, res) => {
      const address = await findAddress(ctx.db, req.userId, req.body.addressId);
      if (!address) throw notFound('not_found', 'This address no longer exists.');
      const items = req.body.productIds
        ? req.body.productIds.map((productId) => ({ productId, qty: 1 }))
        : (await loadCart(ctx.db, req.userId)).items.map(({ productId, qty }) => ({ productId, qty }));

      const location = { lat: Number(address.lat), lng: Number(address.lng) };
      const { candidates, nearestId, inStock } = await deliveryCandidates(ctx, location, items);
      if (!candidates.length) throw conflict('no_branch', "We don't have a branch that delivers to this address yet.");
      const [chosen] = candidates;
      const { start, end } = deliveryWindow(ctx.clock.now());
      res.json({
        branch: chosen.branch,
        distanceKm: chosen.distanceKm,
        isNearest: chosen.branch.id === nearestId,
        inStock,
        window: { start: start.toISOString(), end: end.toISOString() },
      });
    },
  );

  return router;
}
