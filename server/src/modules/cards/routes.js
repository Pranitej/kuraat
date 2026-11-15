/**
 * /api/v1/cards — cards the customer chose to remember. Masked only (brand, last 4, expiry):
 * the full number and CVV are never stored (guide §6.3, design spec §6.12).
 */
import express from 'express';
import { requireAuth } from '../../http/auth.js';
import { notFound } from '../../http/errors.js';
import { newId } from '../../lib/ids.js';

export const toCard = (row) => ({ id: row.id, brand: row.brand, last4: row.last4, expiry: row.expiry });

/** Remembers a card after a successful payment; the same brand + last 4 is updated, not duplicated. */
export async function saveCard(db, userId, { brand, last4, expiry }, now = new Date()) {
  await db('saved_cards')
    .insert({ id: newId(), user_id: userId, brand, last4, expiry, created_at: now, updated_at: now })
    .onConflict(['user_id', 'brand', 'last4'])
    .merge({ expiry, updated_at: now });
}

export function cardRoutes(ctx) {
  const router = express.Router();
  router.use(requireAuth(ctx));

  router.get('/', async (req, res) => {
    const rows = await ctx.db('saved_cards').where({ user_id: req.userId }).orderBy('created_at', 'desc');
    res.json(rows.map(toCard));
  });

  router.delete('/:id', async (req, res) => {
    const removed = await ctx.db('saved_cards').where({ user_id: req.userId, id: req.params.id }).delete();
    if (!removed) throw notFound('not_found', 'This card is no longer saved.');
    res.status(204).end();
  });

  return router;
}
