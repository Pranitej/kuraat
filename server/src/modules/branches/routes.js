/** /api/v1/branches — delivery (hub) branches from ROF with our opening hours. */
import express from 'express';
import { requireAuth } from '../../http/auth.js';

export function branchRoutes(ctx) {
  const router = express.Router();
  router.use(requireAuth(ctx));

  router.get('/', async (req, res) => {
    res.json(await ctx.branches.listDeliveryBranches());
  });

  return router;
}
