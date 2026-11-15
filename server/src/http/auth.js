/** Bearer-token middleware for our own app tokens (not ROF's). */
import { verifyAccessToken } from '../modules/auth/tokens.js';
import { unauthorized } from './errors.js';

const bearer = (req) => {
  const header = req.get('authorization') || '';
  return header.startsWith('Bearer ') ? header.slice(7).trim() : null;
};

/** Signed-in only: sets req.userId or answers 401 { code: 'unauthorized' }. */
export const requireAuth = (ctx) => (req, res, next) => {
  const userId = verifyAccessToken(ctx, bearer(req));
  if (!userId) return next(unauthorized());
  req.userId = userId;
  return next();
};

/** Sets req.userId when a valid token is present; never rejects. */
export const optionalAuth = (ctx) => (req, res, next) => {
  req.userId = verifyAccessToken(ctx, bearer(req)) || null;
  next();
};
