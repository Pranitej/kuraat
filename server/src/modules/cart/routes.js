/**
 * /api/v1/cart — kept on the server (guide §5: "Keep the cart in your backend") and re-priced from
 * ROF on every read so price, stock and availability changes show up (guide §6.1).
 * GET never changes the stored cart; PUT stores what the customer now sees (adjusted quantities and
 * the current prices, used for later 'price_changed' warnings).
 */
import express from 'express';
import { z } from 'zod';
import { MAX_ITEM_QTY } from '../../config/business.js';
import { requireAuth } from '../../http/auth.js';
import { validate } from '../../http/validate.js';
import { priceCart } from './pricing.js';

const MAX_LINES = 50;

export async function loadCart(db, userId) {
  const row = await db('carts').where({ user_id: userId }).first();
  return { items: row?.items ?? [] };
}

export async function saveCart(db, userId, { items }, now) {
  await db('carts')
    .insert({ user_id: userId, items: JSON.stringify(items), promo_code: null, created_at: now, updated_at: now })
    .onConflict('user_id')
    .merge({ items: JSON.stringify(items), promo_code: null, updated_at: now });
}

/** How old a product may be on the cart screen and in quotes: changes still show within seconds. */
export const CART_PRODUCT_MAX_AGE_MS = 5_000;

/**
 * Prices a cart. The cart screen and quotes share each product read for CART_PRODUCT_MAX_AGE_MS across
 * all customers and taps (one RSOF call per product per few seconds instead of one per line per
 * request); placing an order passes `fresh`, so every line is re-read from ROF right then.
 */
export async function priceForUser(ctx, cart, { fresh = false } = {}) {
  return priceCart(cart, {
    getProduct: (id) => ctx.catalog.getProduct(id, fresh ? { fresh: true } : { maxAgeMs: CART_PRODUCT_MAX_AGE_MS }),
  });
}

const cartSchema = z.object({
  items: z
    .array(z.object({ productId: z.string().min(1).max(64), qty: z.number().int().min(1).max(MAX_ITEM_QTY) }))
    .max(MAX_LINES, `A cart can hold up to ${MAX_LINES} different products.`),
});

export function cartRoutes(ctx) {
  const router = express.Router();
  router.use(requireAuth(ctx));

  router.get('/', async (req, res) => {
    res.json(await priceForUser(ctx, await loadCart(ctx.db, req.userId)));
  });

  router.put('/', validate({ body: cartSchema }), async (req, res) => {
    // Same product twice → one line (quantities added, capped).
    const merged = new Map();
    for (const { productId, qty } of req.body.items) merged.set(productId, Math.min(MAX_ITEM_QTY, (merged.get(productId) ?? 0) + qty));
    const priced = await priceForUser(ctx, { items: [...merged].map(([productId, qty]) => ({ productId, qty })) });
    const stored = priced.items.map((l) => ({ productId: l.productId, qty: l.qty, lastPrice: l.product?.price ?? null }));
    await saveCart(ctx.db, req.userId, { items: stored }, ctx.clock.now());
    res.json(priced);
  });

  return router;
}
