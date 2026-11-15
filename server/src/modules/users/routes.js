/** /api/v1/me — the signed-in customer's profile and password. */
import express from 'express';
import { z } from 'zod';
import { requireAuth } from '../../http/auth.js';
import { badRequest, conflict, unauthorized } from '../../http/errors.js';
import { validate } from '../../http/validate.js';
import { markConsumed, verifiedChallenge } from '../auth/otp.js';
import { checkPassword, hashPassword, passwordProblems, weakPasswordMessage } from '../auth/password.js';
import { phoneSchema } from '../auth/phone.js';
import { findUserById, findUserByPhone, toPublicUser } from '../auth/service.js';
import { notify, passwordNotification } from '../notifications/service.js';

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
  phone: phoneSchema.optional(),
  verificationToken: z.string().optional(),
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
    const { name, email, gender, avatar, phone, verificationToken } = req.body;
    const changes = { updated_at: ctx.clock.now() };
    if (name !== undefined) changes.name = name;
    if (email !== undefined) changes.email = email || null;
    if (gender !== undefined) changes.gender = gender;
    if (avatar !== undefined) changes.avatar = avatar;

    let challenge = null;
    if (phone !== undefined && phone !== user.phone) {
      challenge = verificationToken ? await verifiedChallenge(ctx, verificationToken, { purpose: 'change-phone', userId: user.id, phone }) : null;
      if (!challenge) throw badRequest('unverified_phone', 'Verify your new number with a WhatsApp code first.', 'phone');
      const owner = await findUserByPhone(ctx.db, phone);
      if (owner && owner.id !== user.id) throw conflict('phone_taken', 'This number already has a kuraat account.', 'phone');
      changes.phone = phone;
    }

    await ctx.db.transaction(async (trx) => {
      await trx('users').where({ id: user.id }).update(changes);
      if (challenge) await markConsumed(ctx, challenge.id, trx);
    });
    res.json(toPublicUser(await findUserById(ctx.db, user.id)));
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

  return router;
}
