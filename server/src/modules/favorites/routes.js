/** /api/v1/favorites — hearted products (ROF product ids), in the order they were added. */
import express from 'express';
import { z } from 'zod';
import { requireAuth } from '../../http/auth.js';
import { validate } from '../../http/validate.js';

const listIds = async (db, userId) => (await db('favorites').where({ user_id: userId }).orderBy('created_at')).map((r) => r.product_id);

export function favoriteRoutes(ctx) {
  const router = express.Router();
  router.use(requireAuth(ctx));

  router.get('/', async (req, res) => {
    res.json({ productIds: await listIds(ctx.db, req.userId) });
  });

  router.put('/', validate({ body: z.object({ productIds: z.array(z.string().min(1).max(64)).max(200) }) }), async (req, res) => {
    const ids = [...new Set(req.body.productIds)];
    const start = ctx.clock.now().getTime();
    await ctx.db.transaction(async (trx) => {
      await trx('favorites').where({ user_id: req.userId }).delete();
      if (ids.length) {
        // +i ms keeps the given order stable when read back.
        await trx('favorites').insert(ids.map((id, i) => ({ user_id: req.userId, product_id: id, created_at: new Date(start + i) })));
      }
    });
    res.json({ productIds: await listIds(ctx.db, req.userId) });
  });

  return router;
}
