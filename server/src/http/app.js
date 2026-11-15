/** Express application: security headers, CORS, JSON, the /api/v1 routes and uniform errors. */
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { addressRoutes } from '../modules/addresses/routes.js';
import { authRoutes } from '../modules/auth/routes.js';
import { cardRoutes } from '../modules/cards/routes.js';
import { favoriteRoutes } from '../modules/favorites/routes.js';
import { notificationRoutes } from '../modules/notifications/routes.js';
import { meRoutes } from '../modules/users/routes.js';
import { errorMiddleware, notFoundRoute } from './errors.js';

export function createApp(ctx) {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({ origin: ctx.config.corsOrigins }));
  app.use(express.json({ limit: '1mb' }));

  const api = express.Router();
  api.get('/health', async (req, res) => {
    await ctx.db.raw('select 1');
    res.json({ status: 'ok', db: 'ok' });
  });
  api.use('/auth', authRoutes(ctx));
  api.use('/me', meRoutes(ctx));
  api.use('/addresses', addressRoutes(ctx));
  api.use('/favorites', favoriteRoutes(ctx));
  api.use('/cards', cardRoutes(ctx));
  api.use('/notifications', notificationRoutes(ctx));

  app.use('/api/v1', api);
  app.use(notFoundRoute);
  app.use(errorMiddleware);
  return app;
}
