/** Account creation and the public user shape. */
import { newId } from '../../lib/ids.js';
import { postcodeFor } from '../addresses/postcodes.js';
import { WELCOME, notify } from '../notifications/service.js';

export const toPublicUser = (row) => ({
  id: row.id,
  name: row.name,
  phone: row.phone,
  email: row.email || null,
  gender: row.gender || null,
  avatar: row.avatar || null,
  hasPassword: Boolean(row.password_hash),
  createdAt: new Date(row.created_at).toISOString(),
});

export const findUserByPhone = (db, phone) => db('users').where({ phone }).first();
export const findUserById = (db, id) => db('users').where({ id }).first();

/**
 * Creates the account from the sign-up form: user, default Home address (with the map pin's
 * coordinates), empty cart and the welcome notification. Runs inside the caller's transaction.
 */
export async function createAccount(trx, ctx, { phone, name, gender, address, passwordHash = null }) {
  const now = ctx.clock.now();
  const userId = newId();
  await trx('users').insert({ id: userId, phone, name, gender, email: null, avatar: null, password_hash: passwordHash, created_at: now, updated_at: now });
  await trx('addresses').insert({
    id: newId(),
    user_id: userId,
    label: 'Home',
    type: 'home',
    line: address.line,
    district: address.district || '',
    city: address.city,
    postcode: address.postcode || postcodeFor(address.district, address.city),
    landmark: '',
    phone,
    contact_name: name,
    lat: address.location.lat,
    lng: address.location.lng,
    is_default: true,
    created_at: now,
    updated_at: now,
  });
  await trx('carts').insert({ user_id: userId, items: JSON.stringify([]), promo_code: null, created_at: now, updated_at: now });
  await notify(trx, userId, WELCOME, now);
  return userId;
}
