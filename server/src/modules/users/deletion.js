/**
 * Account deletion (App Store guideline 5.1.1(v), Google Play account-deletion policy).
 * Personal data goes; placed orders stay for RSOF's and the branch's records, keeping only the
 * city of the address. The user row stays as an anonymous tombstone the orders point at.
 */
import { conflict } from '../../http/errors.js';
import { markConsumed } from '../auth/otp.js';

const PERSONAL_TABLES = ['addresses', 'carts', 'favorites', 'saved_cards', 'notifications', 'refresh_tokens'];

/** Refuses while an order is on its way (the courier still needs the address and phone). */
export async function assertNoOrderInProgress(db, userId) {
  const ongoing = await db('orders')
    .where({ user_id: userId, cancelled: false })
    .andWhere((q) => q.whereNull('step').orWhere('step', '<', 3))
    .first('id');
  if (ongoing) {
    throw conflict('order_in_progress', 'You have an order on its way. You can delete your account once it is delivered or cancelled.');
  }
}

/** Deletes the account in one transaction and uses up the verified `delete-account` code. */
export async function deleteAccount(ctx, userId, challengeId) {
  await assertNoOrderInProgress(ctx.db, userId);
  const now = ctx.clock.now();
  await ctx.db.transaction(async (trx) => {
    for (const table of PERSONAL_TABLES) await trx(table).where({ user_id: userId }).delete();
    const orders = await trx('orders').where({ user_id: userId }).select('id', 'address');
    for (const order of orders) {
      const address = typeof order.address === 'string' ? JSON.parse(order.address) : order.address;
      await trx('orders')
        .where({ id: order.id })
        .update({ address: JSON.stringify({ city: address?.city ?? '' }), delivery_phone: '', updated_at: now });
    }
    await trx('payments').where({ user_id: userId }).update({ upi_id: null, updated_at: now });
    await trx('users').where({ id: userId }).update({
      phone: null,
      name: 'Deleted customer',
      email: null,
      gender: null,
      avatar: null,
      password_hash: null,
      last_lat: null,
      last_lng: null,
      last_location_at: null,
      deleted_at: now,
      updated_at: now,
    });
    await markConsumed(ctx, challengeId, trx);
  });
}
