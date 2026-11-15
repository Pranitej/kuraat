/** /api/v1/notifications — newest first; mark one or all as read. */
import express from 'express';
import { requireAuth } from '../../http/auth.js';
import { notFound } from '../../http/errors.js';
import { toNotification } from './service.js';

const LIST_LIMIT = 100;

export function notificationRoutes(ctx) {
  const router = express.Router();
  router.use(requireAuth(ctx));

  router.get('/', async (req, res) => {
    const rows = await ctx.db('notifications')
      .where({ user_id: req.userId })
      .orderBy([{ column: 'created_at', order: 'desc' }, { column: 'id', order: 'desc' }])
      .limit(LIST_LIMIT);
    res.json(rows.map(toNotification));
  });

  router.post('/read-all', async (req, res) => {
    const updated = await ctx.db('notifications').where({ user_id: req.userId, read: false }).update({ read: true });
    res.json({ updated });
  });

  router.post('/:id/read', async (req, res) => {
    const where = { user_id: req.userId, id: req.params.id };
    const updated = await ctx.db('notifications').where(where).update({ read: true });
    if (!updated) {
      const exists = await ctx.db('notifications').where(where).first();
      if (!exists) throw notFound('not_found', 'This notification no longer exists.');
    }
    res.json(toNotification(await ctx.db('notifications').where(where).first()));
  });

  return router;
}
