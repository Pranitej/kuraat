/** /api/v1/me — the signed-in customer's profile and password. */
import express from 'express';
import { z } from 'zod';
import { requireAuth } from '../../http/auth.js';
import { badRequest, unauthorized } from '../../http/errors.js';
import { validate } from '../../http/validate.js';
import { verifiedChallenge } from '../auth/otp.js';
import { checkPassword, hashPassword, passwordProblems, weakPasswordMessage } from '../auth/password.js';
import { phoneSchema } from '../auth/phone.js';
import { findUserById, toPublicUser } from '../auth/service.js';
import { notify, passwordNotification } from '../notifications/service.js';
import { deleteAccount } from './deletion.js';

/** Photos are resized in the app before upload; 300 KB of image ≈ 410 000 base64 characters. */
const avatarSchema = z.union([
  z.null(),
  z
    .string()
    .max(410_000, 'Choose a photo smaller than 300 KB.')
    .regex(/^data:image\/(png|jpe?g|webp|gif);base64,/, 'Upload a JPG or PNG photo.'),
]);

const profileSchema = z.object({
  name: z.string().trim().min(2, 'Enter your full name').max(120).optional(),
  email: z.union([z.literal(''), z.email('Enter a valid email address')]).optional(),
  gender: z.enum(['male', 'female', 'other']).optional(),
  avatar: avatarSchema.optional(),
  // The mobile number is fixed once the account exists: it is still accepted here (older apps send it back
  // unchanged) but a different one is refused below.
  phone: phoneSchema.optional(),
});

const locationSchema = z.object({
  lat: z.number('Send the latitude as a number').min(-90, 'Latitude is out of range').max(90, 'Latitude is out of range'),
  lng: z.number('Send the longitude as a number').min(-180, 'Longitude is out of range').max(180, 'Longitude is out of range'),
});

export function meRoutes(ctx) {
  const router = express.Router();
  router.use(requireAuth(ctx));

  const currentUser = async (req) => {
    const user = await findUserById(ctx.db, req.userId);
    if (!user) throw unauthorized();
    return user;
  };

  router.get('/', async (req, res) => {
    res.json(toPublicUser(await currentUser(req)));
  });

  router.patch('/', validate({ body: profileSchema }), async (req, res) => {
    const user = await currentUser(req);
    const { name, email, gender, avatar, phone } = req.body;
    if (phone !== undefined && phone !== user.phone) throw badRequest('phone_locked', 'Your mobile number cannot be changed.', 'phone');
    const changes = { updated_at: ctx.clock.now() };
    if (name !== undefined) changes.name = name;
    if (email !== undefined) changes.email = email || null;
    if (gender !== undefined) changes.gender = gender;
    if (avatar !== undefined) changes.avatar = avatar;

    await ctx.db('users').where({ id: user.id }).update(changes);
    res.json(toPublicUser(await findUserById(ctx.db, user.id)));
  });

  // The apps send the device location once per session (design 2026-11-18 §5.6); only the latest is kept.
  router.put('/location', validate({ body: locationSchema }), async (req, res) => {
    const user = await currentUser(req);
    const now = ctx.clock.now();
    await ctx.db('users').where({ id: user.id }).update({ last_lat: req.body.lat, last_lng: req.body.lng, last_location_at: now, updated_at: now });
    res.status(204).end();
  });

  router.put(
    '/password',
    validate({ body: z.object({ currentPassword: z.string().max(100).optional(), newPassword: z.string().max(100) }) }),
    async (req, res) => {
      const user = await currentUser(req);
      const { currentPassword, newPassword } = req.body;
      const hadPassword = Boolean(user.password_hash);
      if (hadPassword) {
        if (!currentPassword || !(await checkPassword(currentPassword, user.password_hash))) {
          throw badRequest('wrong_password', 'Your current password is incorrect.', 'currentPassword');
        }
        if (await checkPassword(newPassword, user.password_hash)) {
          throw badRequest('same_password', 'Choose a password you have not used before.', 'newPassword');
        }
      }
      const problems = passwordProblems(newPassword);
      if (problems.length) throw badRequest('weak_password', weakPasswordMessage(problems), 'newPassword');
      const passwordHash = await hashPassword(newPassword, ctx.config.passwordHashCost);
      await ctx.db.transaction(async (trx) => {
        await trx('users').where({ id: user.id }).update({ password_hash: passwordHash, updated_at: ctx.clock.now() });
        await notify(trx, user.id, passwordNotification(hadPassword), ctx.clock.now());
      });
      res.json(toPublicUser(await findUserById(ctx.db, user.id)));
    },
  );

  /**
   * Delete account (App Store 5.1.1(v), Google Play): needs a verified `delete-account` WhatsApp
   * code. Personal data goes; placed orders stay (RSOF and the branch keep them) without the
   * delivery phone and address — only the city remains. Refused while an order is on its way.
   */
  router.delete('/', validate({ body: z.object({ verificationToken: z.string().optional() }) }), async (req, res) => {
    const user = await currentUser(req);
    const token = req.body?.verificationToken;
    const challenge = token ? await verifiedChallenge(ctx, token, { purpose: 'delete-account', userId: user.id }) : null;
    if (!challenge) throw badRequest('unverified', 'Confirm with the WhatsApp code we sent you first.');

    await deleteAccount(ctx, user.id, challenge.id);
    res.status(204).end();
  });

  return router;
}
