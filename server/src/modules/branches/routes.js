/** /api/v1/branches — every active branch from ROF (hub, master, …) with its type and our opening hours; `isHub` marks the delivery ones. */
import express from 'express';
import { requireAuth } from '../../http/auth.js';

export function branchRoutes(ctx) {
  const router = express.Router();
  router.use(requireAuth(ctx));

  router.get('/', async (req, res) => {
    res.json(await ctx.branches.listBranches());
  });

  return router;
}
