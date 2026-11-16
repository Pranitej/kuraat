/** Bearer-token middleware for our own app tokens (not ROF's). */
import { verifyAccessToken } from '../modules/auth/tokens.js';
import { unauthorized } from './errors.js';

const bearer = (req) => {
  const header = req.get('authorization') || '';
  return header.startsWith('Bearer ') ? header.slice(7).trim() : null;
};

/**
 * The token's user id — unless that account was deleted after the token was issued (access tokens
 * are stateless, so one lookup by primary key stops a deleted account's token at once).
 */
async function activeUserId(ctx, req) {
  const userId = verifyAccessToken(ctx, bearer(req));
  if (!userId) return null;
  const row = await ctx.db('users').where({ id: userId }).whereNull('deleted_at').first('id');
  return row ? userId : null;
}

/** Signed-in only: sets req.userId or answers 401 { code: 'unauthorized' }. */
export const requireAuth = (ctx) => async (req, res, next) => {
  const userId = await activeUserId(ctx, req);
  if (!userId) return next(unauthorized());
  req.userId = userId;
  return next();
};

/** Sets req.userId when a valid token of an active account is present; never rejects. */
export const optionalAuth = (ctx) => async (req, res, next) => {
  req.userId = await activeUserId(ctx, req);
  next();
};
