/** Per-IP rate limit for /auth/* (per-phone code limits live in modules/auth/otp.js). */
import { rateLimit } from 'express-rate-limit';
import { tooManyRequests } from './errors.js';

export const authRateLimit = (config) =>
  rateLimit({
    windowMs: 60_000,
    limit: config.authRateLimitPerMinute,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (req, res, next) => next(tooManyRequests()),
  });
