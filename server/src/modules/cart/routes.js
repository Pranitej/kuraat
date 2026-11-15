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
import { normalizePromoCode, priceCart } from './pricing.js';

const MAX_LINES = 50;

export async function loadCart(db, userId) {
  const row = await db('carts').where({ user_id: userId }).first();
  return { items: row?.items ?? [], promoCode: row?.promo_code ?? null };
}

export async function saveCart(db, userId, { items, promoCode }, now) {
  await db('carts')
    .insert({ user_id: userId, items: JSON.stringify(items), promo_code: promoCode, created_at: now, updated_at: now })
    .onConflict('user_id')
    .merge({ items: JSON.stringify(items), promo_code: promoCode, updated_at: now });
}

/** A customer's first order: no earlier order that was not cancelled. */
export async function isFirstOrder(db, userId) {
  const { n } = await db('orders').where({ user_id: userId, cancelled: false }).count({ n: '*' }).first();
  return Number(n) === 0;
}

/** Prices a cart with fresh ROF product data. */
export async function priceForUser(ctx, userId, cart) {
  return priceCart(cart, {
    getProduct: (id) => ctx.catalog.getProduct(id, { fresh: true }),
    isFirstOrder: await isFirstOrder(ctx.db, userId),
    pricesIncludeVat: ctx.config.pricesIncludeVat,
  });
}

const cartSchema = z.object({
  items: z
    .array(z.object({ productId: z.string().min(1).max(64), qty: z.number().int().min(1).max(MAX_ITEM_QTY) }))
    .max(MAX_LINES, `A cart can hold up to ${MAX_LINES} different products.`),
  promoCode: z.string().max(40).nullable().optional(),
});

export function cartRoutes(ctx) {
  const router = express.Router();
  router.use(requireAuth(ctx));

  router.get('/', async (req, res) => {
    res.json(await priceForUser(ctx, req.userId, await loadCart(ctx.db, req.userId)));
  });

  router.put('/', validate({ body: cartSchema }), async (req, res) => {
    // Same product twice → one line (quantities added, capped).
    const merged = new Map();
    for (const { productId, qty } of req.body.items) merged.set(productId, Math.min(MAX_ITEM_QTY, (merged.get(productId) ?? 0) + qty));
    const promoCode = normalizePromoCode(req.body.promoCode);
    const priced = await priceForUser(ctx, req.userId, { items: [...merged].map(([productId, qty]) => ({ productId, qty })), promoCode });
    const stored = priced.items.map((l) => ({ productId: l.productId, qty: l.qty, lastPrice: l.product?.price ?? null }));
    await saveCart(ctx.db, req.userId, { items: stored, promoCode }, ctx.clock.now());
    res.json(priced);
  });

  return router;
}
