/**
 * WhatsApp login codes (design spec §6.12): 6 digits, valid 10 minutes, 5 attempts, resend after
 * 60 s, at most 5 requests per phone per 10 minutes. Codes are stored only as an HMAC.
 *
 * OTP_MODE=test (UAT default): nothing is sent; OTP_TEST_CODE always works and is logged.
 * OTP_MODE=whatsapp: needs a WhatsApp provider — not integrated yet (design spec §8), so requests
 * fail with a clear message instead of pretending to send.
 */
import { randomInt } from 'node:crypto';
import { OTP_RULES } from '../../config/business.js';
import { badRequest, tooManyRequests, unavailable } from '../../http/errors.js';
import { newId } from '../../lib/ids.js';
import { sameHash, secretHash } from './tokens.js';

const MINUTE = 60_000;
const codeHash = (ctx, challengeId, code) => secretHash(ctx, `${challengeId}:${code}`);

export const expiredSession = () => badRequest('expired', 'Your verification session expired. Please start again.');
const expiredCode = () => badRequest('expired_code', 'This code has expired. Request a new one.', 'code');

export function challengeView(row) {
  return {
    challengeId: row.id,
    phone: row.phone,
    purpose: row.purpose,
    length: OTP_RULES.length,
    resendAt: new Date(new Date(row.sent_at).getTime() + OTP_RULES.resendSeconds * 1000).toISOString(),
    expiresAt: new Date(row.expires_at).toISOString(),
  };
}

function newCode(ctx) {
  if (ctx.config.otp.mode === 'test') return ctx.config.otp.testCode;
  return String(randomInt(0, 10 ** OTP_RULES.length)).padStart(OTP_RULES.length, '0');
}

async function deliver(ctx, { phone, purpose }, code) {
  if (ctx.config.otp.mode === 'test') {
    ctx.logger.info(`[otp] ${purpose} code for ${String(phone).startsWith('+') ? phone : `+966 ${phone}`}: ${code} (OTP_MODE=test — nothing sent)`);
    return;
  }
  ctx.logger.error('[otp] OTP_MODE=whatsapp but no WhatsApp provider is integrated yet');
  throw unavailable('otp_unavailable', "We can't send WhatsApp codes right now. Sign in with your password or try again later.");
}

export async function createChallenge(ctx, { phone, purpose, payload = null, userId = null }) {
  const now = ctx.clock.now();
  const windowStart = new Date(now.getTime() - 10 * MINUTE);
  const { n } = await ctx.db('otp_challenges').where({ phone }).where('created_at', '>', windowStart).count({ n: '*' }).first();
  if (Number(n) >= 5) throw tooManyRequests('too_many_requests', 'Too many codes requested for this number. Please wait a few minutes.');

  const id = newId();
  const code = newCode(ctx);
  const row = {
    id,
    phone,
    purpose,
    code_hash: codeHash(ctx, id, code),
    payload: payload ? JSON.stringify(payload) : null,
    user_id: userId,
    attempts: 0,
    sent_at: now,
    expires_at: new Date(now.getTime() + OTP_RULES.expiryMinutes * MINUTE),
    created_at: now,
    updated_at: now,
  };
  await deliver(ctx, row, code);
  await ctx.db('otp_challenges').insert(row);
  return challengeView(row);
}

export async function resendChallenge(ctx, challengeId) {
  const now = ctx.clock.now();
  const row = await ctx.db('otp_challenges').where({ id: challengeId }).first();
  if (!row || row.consumed_at) throw expiredSession();
  const waitMs = new Date(row.sent_at).getTime() + OTP_RULES.resendSeconds * 1000 - now.getTime();
  if (waitMs > 0) throw tooManyRequests('resend_too_soon', `You can request a new code in ${Math.ceil(waitMs / 1000)} seconds.`);
  const code = newCode(ctx);
  await deliver(ctx, row, code);
  const changes = {
    code_hash: codeHash(ctx, row.id, code),
    attempts: 0,
    sent_at: now,
    expires_at: new Date(now.getTime() + OTP_RULES.expiryMinutes * MINUTE),
    updated_at: now,
  };
  await ctx.db('otp_challenges').where({ id: row.id }).update(changes);
  return challengeView({ ...row, ...changes });
}

/** Checks the code; counts wrong attempts. Returns the challenge row when the code is right. */
export async function checkCode(ctx, challengeId, code) {
  const now = ctx.clock.now();
  const row = await ctx.db('otp_challenges').where({ id: challengeId }).first();
  if (!row || row.consumed_at) throw expiredSession();
  if (row.attempts >= OTP_RULES.maxAttempts || new Date(row.expires_at) <= now) throw expiredCode();
  if (!sameHash(codeHash(ctx, row.id, String(code)), row.code_hash)) {
    const attempts = row.attempts + 1;
    await ctx.db('otp_challenges').where({ id: row.id }).update({ attempts, updated_at: now });
    if (attempts >= OTP_RULES.maxAttempts) throw expiredCode();
    throw badRequest('wrong_code', 'That code is not correct. Check WhatsApp and try again.', 'code');
  }
  return row;
}

export const markVerified = (ctx, id, db = ctx.db) => db('otp_challenges').where({ id }).update({ verified_at: ctx.clock.now(), updated_at: ctx.clock.now() });
export const markConsumed = (ctx, id, db = ctx.db) =>
  db('otp_challenges').where({ id }).update({ consumed_at: ctx.clock.now(), updated_at: ctx.clock.now() });

/** A verified-but-unused challenge (reset / change-phone), valid for 15 minutes after verification. */
export async function verifiedChallenge(ctx, id, { purpose, userId, phone } = {}) {
  const row = await ctx.db('otp_challenges').where({ id }).first();
  const fresh = row?.verified_at && ctx.clock.now().getTime() - new Date(row.verified_at).getTime() <= 15 * MINUTE;
  if (!row || row.consumed_at || !fresh || row.purpose !== purpose) return null;
  if (userId !== undefined && row.user_id !== userId) return null;
  if (phone !== undefined && row.phone !== phone) return null;
  return row;
}
