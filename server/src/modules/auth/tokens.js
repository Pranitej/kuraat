/**
 * App login tokens (design spec §6.12):
 * - access token: HS256 JWT, 15 minutes, sent as `Authorization: Bearer …`;
 * - refresh token: random 48 bytes, 30 days, stored only as an HMAC; rotated on every use.
 *   Re-using an already-rotated refresh token revokes all of that user's sessions (theft signal).
 * Times come from ctx.clock so tests can move time.
 */
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { unauthorized } from '../../http/errors.js';
import { newId } from '../../lib/ids.js';

const DAY_MS = 24 * 3600 * 1000;

/** Keyed hash for secrets we must recognise later but never store (refresh tokens, login codes). */
export const secretHash = (ctx, value) => createHmac('sha256', ctx.config.jwt.refreshSecret).update(String(value)).digest('hex');

export const sameHash = (a, b) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

export async function issueTokens(ctx, userId, db = ctx.db) {
  const now = ctx.clock.now();
  const iat = Math.floor(now.getTime() / 1000);
  const { accessSecret, accessTtlSec, refreshTtlDays } = ctx.config.jwt;
  const accessToken = jwt.sign({ sub: userId, typ: 'access', iat, exp: iat + accessTtlSec }, accessSecret, { algorithm: 'HS256' });
  const refreshToken = randomBytes(48).toString('base64url');
  await db('refresh_tokens').insert({
    id: newId(),
    user_id: userId,
    token_hash: secretHash(ctx, refreshToken),
    expires_at: new Date(now.getTime() + refreshTtlDays * DAY_MS),
    created_at: now,
    updated_at: now,
  });
  return { accessToken, refreshToken, expiresIn: accessTtlSec };
}

/** @returns {string|null} the user id, or null when the token is missing, invalid or expired. */
export function verifyAccessToken(ctx, token) {
  if (!token) return null;
  try {
    const payload = jwt.verify(token, ctx.config.jwt.accessSecret, {
      algorithms: ['HS256'],
      clockTimestamp: Math.floor(ctx.clock.now().getTime() / 1000),
    });
    return payload.typ === 'access' && typeof payload.sub === 'string' ? payload.sub : null;
  } catch {
    return null;
  }
}

export async function rotateRefresh(ctx, refreshToken) {
  const now = ctx.clock.now();
  const row = await ctx.db('refresh_tokens').where({ token_hash: secretHash(ctx, refreshToken) }).first();
  if (!row) throw unauthorized();
  if (row.revoked_at) {
    // A rotated token came back: someone else may hold it. End every session of this user.
    await ctx.db('refresh_tokens').where({ user_id: row.user_id }).whereNull('revoked_at').update({ revoked_at: now, updated_at: now });
    ctx.logger.warn(`[auth] refresh token reuse for user ${row.user_id}; all sessions revoked`);
    throw unauthorized();
  }
  if (new Date(row.expires_at) <= now) throw unauthorized();
  const user = await ctx.db('users').where({ id: row.user_id }).first();
  if (!user) throw unauthorized();
  return ctx.db.transaction(async (trx) => {
    await trx('refresh_tokens').where({ id: row.id }).update({ revoked_at: now, updated_at: now });
    return issueTokens(ctx, row.user_id, trx);
  });
}

export async function revokeRefresh(ctx, refreshToken) {
  const now = ctx.clock.now();
  await ctx.db('refresh_tokens')
    .where({ token_hash: secretHash(ctx, refreshToken) })
    .whereNull('revoked_at')
    .update({ revoked_at: now, updated_at: now });
}
