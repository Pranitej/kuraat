/**
 * /api/v1/addresses — the customer's address book (ROF has no address API; guide §6.2 says to keep
 * addresses with latitude/longitude in our own database). Exactly one address is the default.
 */
import express from 'express';
import { z } from 'zod';
import { requireAuth } from '../../http/auth.js';
import { badRequest, conflict, notFound } from '../../http/errors.js';
import { validate } from '../../http/validate.js';
import { newId } from '../../lib/ids.js';
import { findUserById } from '../auth/service.js';
import { postcodeFor } from './postcodes.js';
import { OUT_OF_AREA_MESSAGE, addressInputSchema, isInSaudi } from './schema.js';

const MAX_ADDRESSES = 20;
const GONE = 'This address no longer exists.';

export const toAddress = (row) => ({
  id: row.id,
  label: row.label,
  type: row.type,
  line: row.line,
  district: row.district,
  city: row.city,
  postcode: row.postcode,
  landmark: row.landmark,
  phone: row.phone,
  contactName: row.contact_name,
  location: { lat: Number(row.lat), lng: Number(row.lng) },
  isDefault: Boolean(row.is_default),
});

const labelFor = (type, label) => (type === 'home' ? 'Home' : type === 'office' ? 'Office' : label?.trim() || 'Other');

/** Default first, then oldest first. */
export const listAddresses = (db, userId) =>
  db('addresses').where({ user_id: userId }).orderBy([{ column: 'is_default', order: 'desc' }, 'created_at', 'id']);

export const findAddress = (db, userId, id) => db('addresses').where({ user_id: userId, id }).first();

/** Makes `id` the only default (or, with id = null, gives the default to the oldest address). */
async function setDefault(trx, userId, id, now) {
  let target = id;
  if (!target) {
    const oldest = await trx('addresses').where({ user_id: userId }).orderBy(['created_at', 'id']).first();
    if (!oldest) return;
    target = oldest.id;
  }
  await trx('addresses').where({ user_id: userId }).update({ is_default: trx.raw('id = ?', [target]), updated_at: now });
}

export function addressRoutes(ctx) {
  const router = express.Router();
  router.use(requireAuth(ctx));

  const fields = (input, user) => {
    if (!isInSaudi(input.location)) throw badRequest('out_of_area', OUT_OF_AREA_MESSAGE, 'location');
    return {
      label: labelFor(input.type, input.label),
      type: input.type,
      line: input.line,
      district: input.district,
      city: input.city,
      postcode: input.postcode || postcodeFor(input.district, input.city),
      landmark: input.landmark,
      phone: input.phone,
      contact_name: user.name,
      lat: input.location.lat,
      lng: input.location.lng,
    };
  };

  router.get('/', async (req, res) => {
    res.json((await listAddresses(ctx.db, req.userId)).map(toAddress));
  });

  router.post('/', validate({ body: addressInputSchema }), async (req, res) => {
    const user = await findUserById(ctx.db, req.userId);
    const row = fields(req.body, user);
    const now = ctx.clock.now();
    const id = newId();
    await ctx.db.transaction(async (trx) => {
      const { n } = await trx('addresses').where({ user_id: req.userId }).count({ n: '*' }).first();
      if (Number(n) >= MAX_ADDRESSES) throw conflict('too_many_addresses', `You can save up to ${MAX_ADDRESSES} addresses.`);
      await trx('addresses').insert({ id, user_id: req.userId, ...row, is_default: false, created_at: now, updated_at: now });
      if (req.body.isDefault || Number(n) === 0) await setDefault(trx, req.userId, id, now);
    });
    res.status(201).json(toAddress(await findAddress(ctx.db, req.userId, id)));
  });

  router.patch('/:id', validate({ body: addressInputSchema }), async (req, res) => {
    const existing = await findAddress(ctx.db, req.userId, req.params.id);
    if (!existing) throw notFound('not_found', GONE);
    const user = await findUserById(ctx.db, req.userId);
    const now = ctx.clock.now();
    await ctx.db.transaction(async (trx) => {
      await trx('addresses').where({ id: existing.id }).update({ ...fields(req.body, user), updated_at: now });
      if (req.body.isDefault === true) await setDefault(trx, req.userId, existing.id, now);
      if (req.body.isDefault === false && existing.is_default) {
        // Keep exactly one default: hand it to the oldest other address (if any).
        const next = await trx('addresses').where({ user_id: req.userId }).whereNot({ id: existing.id }).orderBy(['created_at', 'id']).first();
        if (next) await setDefault(trx, req.userId, next.id, now);
      }
    });
    res.json(toAddress(await findAddress(ctx.db, req.userId, existing.id)));
  });

  router.delete('/:id', async (req, res) => {
    const existing = await findAddress(ctx.db, req.userId, req.params.id);
    if (!existing) throw notFound('not_found', GONE);
    await ctx.db.transaction(async (trx) => {
      await trx('addresses').where({ id: existing.id }).delete();
      if (existing.is_default) await setDefault(trx, req.userId, null, ctx.clock.now());
    });
    res.status(204).end();
  });

  router.post('/:id/default', validate({ params: z.object({ id: z.string().min(1) }) }), async (req, res) => {
    const existing = await findAddress(ctx.db, req.userId, req.params.id);
    if (!existing) throw notFound('not_found', GONE);
    await ctx.db.transaction((trx) => setDefault(trx, req.userId, existing.id, ctx.clock.now()));
    res.json((await listAddresses(ctx.db, req.userId)).map(toAddress));
  });

  return router;
}
