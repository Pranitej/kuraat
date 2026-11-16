import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { TEST_CODE, signInDemo, signUp } from '../helpers/auth.js';
import { createTestContext } from '../helpers/context.js';
import { advance, placeTestOrder } from '../helpers/orders.js';

let t;
beforeAll(async () => {
  t = await createTestContext({ withRof: true });
});
beforeEach(async () => {
  await t.reset();
  t.clock.set('2026-11-15T09:21:00Z');
});
afterAll(async () => {
  await t?.close();
});

const api = (method, path, auth, body) => {
  const req = request(t.app)[method](`/api/v1${path}`);
  if (auth) req.set('Authorization', auth);
  return body === undefined ? req : req.send(body);
};

/** Request + verify a delete-account code for the signed-in user. */
async function verifiedDeletion(me, phone = me.user.phone) {
  const otp = await api('post', '/auth/otp/request', me.auth, { phone, purpose: 'delete-account' });
  expect(otp.status).toBe(200);
  const verified = await api('post', '/auth/otp/verify', me.auth, { challengeId: otp.body.challengeId, code: TEST_CODE });
  expect(verified.body.next).toBe('delete-account');
  return verified.body.verificationToken;
}

const count = async (table, userId) => (await t.db(table).where({ user_id: userId }).count({ n: '*' }))[0].n;

describe('delete account (store requirement)', () => {
  test('request → verify → DELETE /me answers 204 and ends every session', async () => {
    const me = await signUp(t.app);
    const verificationToken = await verifiedDeletion(me);
    const res = await api('delete', '/me', me.auth, { verificationToken });
    expect(res.status).toBe(204);

    expect((await api('get', '/me', me.auth)).status).toBe(401);
    expect((await api('get', '/cart', me.auth)).status).toBe(401);
    const refresh = await api('post', '/auth/refresh', null, { refreshToken: me.tokens.refreshToken });
    expect(refresh.status).toBe(401);
  });

  test('personal data is removed; delivered orders stay without personal details', async () => {
    const me = await signInDemo(t);
    const order = await placeTestOrder(t, me);
    await advance(t, order.number, 'Delivered');
    await api('get', `/orders/${order.id}`, me.auth); // syncs the delivered status
    const userId = me.user.id;

    const verificationToken = await verifiedDeletion(me);
    expect((await api('delete', '/me', me.auth, { verificationToken })).status).toBe(204);

    for (const table of ['addresses', 'carts', 'favorites', 'saved_cards', 'notifications', 'refresh_tokens']) {
      expect(await count(table, userId), table).toBe(0);
    }
    const user = await t.db('users').where({ id: userId }).first();
    expect(user).toMatchObject({ phone: null, name: 'Deleted customer', email: null, avatar: null, password_hash: null, gender: null });
    expect(user.deleted_at).not.toBeNull();

    const orders = await t.db('orders').where({ user_id: userId });
    expect(orders.length).toBeGreaterThan(0);
    for (const row of orders) {
      expect(row.delivery_phone).toBe('');
      const address = typeof row.address === 'string' ? JSON.parse(row.address) : row.address;
      expect(Object.keys(address)).toEqual(['city']);
    }
  });

  test('the same number can create a new account afterwards', async () => {
    const me = await signUp(t.app, { phone: '551112233' });
    const verificationToken = await verifiedDeletion(me);
    await api('delete', '/me', me.auth, { verificationToken });
    const again = await signUp(t.app, { phone: '551112233' });
    expect(again.user.phone).toBe('551112233');
    expect(again.user.id).not.toBe(me.user.id);
  });

  test('an order still on its way blocks deletion with 409 order_in_progress', async () => {
    const me = await signInDemo(t);
    await placeTestOrder(t, me);
    const verificationToken = await verifiedDeletion(me);
    const res = await api('delete', '/me', me.auth, { verificationToken });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('order_in_progress');
    expect((await api('get', '/me', me.auth)).status).toBe(200);
  });

  test('a code can only be asked for the signed-in customer’s own number', async () => {
    const me = await signUp(t.app);
    const res = await api('post', '/auth/otp/request', me.auth, { phone: '561234567', purpose: 'delete-account' });
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ code: 'wrong_phone', field: 'phone' });
  });

  test('DELETE /me without a verified code → 400 unverified', async () => {
    const me = await signUp(t.app);
    const missing = await api('delete', '/me', me.auth, {});
    expect(missing.body.code).toBe('unverified');
    const otp = await api('post', '/auth/otp/request', me.auth, { phone: me.user.phone, purpose: 'delete-account' });
    const notVerified = await api('delete', '/me', me.auth, { verificationToken: otp.body.challengeId });
    expect(notVerified.status).toBe(400);
    expect(notVerified.body.code).toBe('unverified');
  });

  test('signed out → 401 for both the code request and the deletion', async () => {
    expect((await api('post', '/auth/otp/request', null, { phone: '501234821', purpose: 'delete-account' })).status).toBe(401);
    expect((await api('delete', '/me', null, { verificationToken: 'x' })).status).toBe(401);
  });
});
