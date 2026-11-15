/** Express application: security headers, CORS, JSON, the /api/v1 routes and uniform errors. */
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
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

  app.use('/api/v1', api);
  app.use(notFoundRoute);
  app.use(errorMiddleware);
  return app;
}
