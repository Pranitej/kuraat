/**
 * /api/v1/auth — our own customer login (the lead: "a separate login system … like Swiggy and
 * Zomato"; ROF has no customer login). Error codes match the web client's authService.js.
 * Credential errors are 400/404 (never 401) so the client does not mistake them for an expired session.
 */
import express from 'express';
import { z } from 'zod';
import { authRateLimit } from '../../http/rateLimits.js';
import { optionalAuth } from '../../http/auth.js';
import { badRequest, conflict, notFound, unauthorized } from '../../http/errors.js';
import { validate } from '../../http/validate.js';
import { OUT_OF_AREA_MESSAGE, isInSaudi, signupAddressSchema } from '../addresses/schema.js';
import { notify, passwordNotification } from '../notifications/service.js';
import { checkCode, createChallenge, expiredSession, markConsumed, markVerified, resendChallenge, verifiedChallenge } from './otp.js';
import { checkPassword, hashPassword, passwordProblems, weakPasswordMessage } from './password.js';
import { phoneSchema } from './phone.js';
import { createAccount, findUserById, findUserByPhone, toPublicUser } from './service.js';
import { issueTokens, revokeRefresh, rotateRefresh } from './tokens.js';

const PHONE_TAKEN = 'This number already has a kuraat account.';
const NO_ACCOUNT = 'We could not find an account with this number.';

const signupPayloadSchema = z.object({
  name: z.string().trim().min(2, 'Enter your full name').max(120),
  gender: z.enum(['male', 'female', 'other'], { error: 'Choose a gender' }),
  address: signupAddressSchema,
});

const passwordField = z.string().max(100);
const requireStrong = (password, field) => {
  const problems = passwordProblems(password);
  if (problems.length) throw badRequest('weak_password', weakPasswordMessage(problems), field);
};

function parseSignupPayload(payload) {
  const result = signupPayloadSchema.safeParse(payload ?? undefined);
  if (!result.success) {
    const issue = result.error.issues[0];
    throw badRequest('invalid', payload ? issue.message : 'Fill in the sign-up form first.', ['payload', ...issue.path].join('.'));
  }
  if (!isInSaudi(result.data.address.location)) throw badRequest('out_of_area', OUT_OF_AREA_MESSAGE, 'address.location');
  return result.data;
}

export function authRoutes(ctx) {
  const router = express.Router();
  router.use(authRateLimit(ctx.config));

  const signedIn = async (userId) => {
    const user = await findUserById(ctx.db, userId);
    return { user: toPublicUser(user), tokens: await issueTokens(ctx, userId) };
  };

  router.post(
    '/otp/request',
    optionalAuth(ctx),
    validate({
      body: z.object({
        phone: phoneSchema,
        purpose: z.enum(['signup', 'signin', 'reset', 'change-phone', 'delete-account']),
        payload: z.unknown().optional(),
      }),
    }),
    async (req, res) => {
      const { phone, purpose } = req.body;
      if (purpose === 'delete-account') {
        // The signed-in customer confirms deleting their own account — only their own number.
        const user = req.userId ? await findUserById(ctx.db, req.userId) : null;
        if (!user) throw unauthorized();
        if (user.phone !== phone) throw badRequest('wrong_phone', 'Use the mobile number of this account.', 'phone');
        return res.json(await createChallenge(ctx, { phone, purpose, payload: null, userId: user.id }));
      }
      const existing = await findUserByPhone(ctx.db, phone);
      let payload = null;
      if (purpose === 'signup') {
        payload = parseSignupPayload(req.body.payload);
        if (existing) throw conflict('phone_taken', PHONE_TAKEN, 'phone');
      } else if (purpose === 'change-phone') {
        if (!req.userId) throw unauthorized();
        if (existing) throw conflict('phone_taken', PHONE_TAKEN, 'phone');
      } else if (!existing) {
        throw notFound('not_found', NO_ACCOUNT, 'phone');
      }
      res.json(await createChallenge(ctx, { phone, purpose, payload, userId: purpose === 'change-phone' ? req.userId : null }));
    },
  );

  router.post('/otp/resend', validate({ body: z.object({ challengeId: z.uuid() }) }), async (req, res) => {
    res.json(await resendChallenge(ctx, req.body.challengeId));
  });

  router.post(
    '/otp/verify',
    optionalAuth(ctx),
    validate({ body: z.object({ challengeId: z.uuid(), code: z.string().regex(/^\d{6}$/, 'Enter the 6-digit code.') }) }),
    async (req, res) => {
      const challenge = await checkCode(ctx, req.body.challengeId, req.body.code);
      switch (challenge.purpose) {
        case 'signup': {
          if (await findUserByPhone(ctx.db, challenge.phone)) throw conflict('phone_taken', PHONE_TAKEN, 'phone');
          const form = challenge.payload;
          const userId = await ctx.db.transaction(async (trx) => {
            const id = await createAccount(trx, ctx, { phone: challenge.phone, ...form });
            await markConsumed(ctx, challenge.id, trx);
            return id;
          });
          return res.json({ next: 'home', ...(await signedIn(userId)) });
        }
        case 'signin': {
          const user = await findUserByPhone(ctx.db, challenge.phone);
          if (!user) throw notFound('not_found', NO_ACCOUNT, 'phone');
          await markConsumed(ctx, challenge.id);
          return res.json({ next: 'home', ...(await signedIn(user.id)) });
        }
        case 'reset':
          await markVerified(ctx, challenge.id);
          return res.json({ next: 'set-password', verificationToken: challenge.id });
        case 'change-phone':
          if (!req.userId || req.userId !== challenge.user_id) throw unauthorized();
          await markVerified(ctx, challenge.id);
          return res.json({ next: 'account', verificationToken: challenge.id });
        case 'delete-account':
          if (!req.userId || req.userId !== challenge.user_id) throw unauthorized();
          await markVerified(ctx, challenge.id);
          return res.json({ next: 'delete-account', verificationToken: challenge.id });
        default:
          throw expiredSession();
      }
    },
  );

  // PDF screen 05 "Set a password instead": create the account from the pending sign-up form.
  router.post('/signup/password', validate({ body: z.object({ challengeId: z.uuid(), password: passwordField }) }), async (req, res) => {
    const challenge = await ctx.db('otp_challenges').where({ id: req.body.challengeId, purpose: 'signup' }).first();
    const stale = !challenge || challenge.consumed_at || ctx.clock.now() - new Date(challenge.sent_at) > 30 * 60_000;
    if (stale) throw badRequest('expired', 'Your sign-up session expired. Please start again.');
    requireStrong(req.body.password, 'password');
    if (await findUserByPhone(ctx.db, challenge.phone)) throw conflict('phone_taken', PHONE_TAKEN, 'phone');
    const passwordHash = await hashPassword(req.body.password, ctx.config.passwordHashCost);
    const userId = await ctx.db.transaction(async (trx) => {
      const id = await createAccount(trx, ctx, { phone: challenge.phone, ...challenge.payload, passwordHash });
      await notify(trx, id, passwordNotification(false), ctx.clock.now());
      await markConsumed(ctx, challenge.id, trx);
      return id;
    });
    res.json(await signedIn(userId));
  });

  router.post('/signin', validate({ body: z.object({ phone: phoneSchema, password: passwordField }) }), async (req, res) => {
    const user = await findUserByPhone(ctx.db, req.body.phone);
    if (!user) throw notFound('not_found', NO_ACCOUNT, 'phone');
    if (!user.password_hash) {
      throw badRequest('no_password', 'No password is set for this account yet. Sign in with a WhatsApp code.', 'password');
    }
    if (!(await checkPassword(req.body.password, user.password_hash))) {
      throw badRequest('wrong_password', 'Incorrect password. Try again or use a WhatsApp code.', 'password');
    }
    res.json(await signedIn(user.id));
  });

  router.post(
    '/password/reset',
    validate({ body: z.object({ verificationToken: z.string().min(1), newPassword: passwordField }) }),
    async (req, res) => {
      const challenge = await verifiedChallenge(ctx, req.body.verificationToken, { purpose: 'reset' });
      if (!challenge) throw badRequest('expired', 'Verify your number with a WhatsApp code first.');
      const user = await findUserByPhone(ctx.db, challenge.phone);
      if (!user) throw notFound('not_found', NO_ACCOUNT, 'phone');
      requireStrong(req.body.newPassword, 'newPassword');
      const passwordHash = await hashPassword(req.body.newPassword, ctx.config.passwordHashCost);
      await ctx.db.transaction(async (trx) => {
        await trx('users').where({ id: user.id }).update({ password_hash: passwordHash, updated_at: ctx.clock.now() });
        await notify(trx, user.id, passwordNotification(Boolean(user.password_hash)), ctx.clock.now());
        await markConsumed(ctx, challenge.id, trx);
      });
      res.json(await signedIn(user.id));
    },
  );

  router.post('/refresh', validate({ body: z.object({ refreshToken: z.string().min(1) }) }), async (req, res) => {
    res.json({ tokens: await rotateRefresh(ctx, req.body.refreshToken) });
  });

  router.post('/signout', validate({ body: z.object({ refreshToken: z.string().min(1) }) }), async (req, res) => {
    await revokeRefresh(ctx, req.body.refreshToken);
    res.status(204).end();
  });

  return router;
}
