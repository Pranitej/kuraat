/** /api/v1/categories and /api/v1/products — read through ROF. */
import express from 'express';
import { z } from 'zod';
import { requireAuth } from '../../http/auth.js';
import { notFound } from '../../http/errors.js';
import { validate } from '../../http/validate.js';

export function catalogRoutes(ctx) {
  const router = express.Router();
  const auth = requireAuth(ctx); // per route: this router is mounted at the API root

  router.get('/categories', auth, async (req, res) => {
    res.json(await ctx.catalog.listCategories());
  });

  router.get(
    '/products',
    auth,
    validate({ query: z.object({ categoryId: z.string().max(64).optional(), search: z.string().max(100).optional() }) }),
    async (req, res) => {
      res.json(await ctx.catalog.listProducts(req.validQuery));
    },
  );

  router.get('/products/:id', auth, async (req, res) => {
    const product = await ctx.catalog.getProduct(req.params.id);
    if (!product) throw notFound('not_found', 'This product is not available any more.');
    res.json(product);
  });

  return router;
}
