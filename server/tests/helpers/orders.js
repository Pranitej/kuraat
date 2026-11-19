/** Test helper: put items in the cart and place an order through the API. */
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { PRODUCT_IDS } from '../support/rof-double/seed.js';

/** A card order: placed in RSOF first, then paid on RSOF's payment page (`payOnRsof` plays the customer paying). */
export const CARD = { method: 'card' };

export async function placeTestOrder(t, me, { items = [{ productId: PRODUCT_IDS.classic, qty: 1 }], payment = CARD } = {}) {
  const api = (method, path, body) => request(t.app)[method](`/api/v1${path}`).set('Authorization', me.auth).send(body);
  await api('put', '/cart', { items });
  const addresses = await request(t.app).get('/api/v1/addresses').set('Authorization', me.auth);
  const home = addresses.body.find((a) => a.isDefault);
  const res = await api('post', '/orders', { addressId: home.id, payment, idempotencyKey: randomUUID() });
  if (res.status !== 201) throw new Error(`place order ${res.status} ${JSON.stringify(res.body)}`);
  return res.body;
}

/** Plays branch staff in the RSOF stand-in. */
export const advance = (t, number, status) =>
  request(t.mockRof.app)
    .post(`/__dev/orders/${String(number).replace('KR-', '')}/advance`)
    .send(status ? { status } : {});

/** Plays the customer paying on RSOF's payment page for this order. */
export const payOnRsof = (t, number) => request(t.mockRof.app).post(`/__dev/orders/${String(number).replace('KR-', '')}/pay`);

/** A pickup order paid at the branch (the pin comes from the customer's default address). */
export async function placePickupTestOrder(t, me, { items = [{ productId: PRODUCT_IDS.classic, qty: 1 }], payment = { method: 'branch' } } = {}) {
  const api = (method, path, body) => request(t.app)[method](`/api/v1${path}`).set('Authorization', me.auth).send(body);
  await api('put', '/cart', { items });
  const res = await api('post', '/orders', { fulfilment: 'pickup', payment, idempotencyKey: randomUUID() });
  if (res.status !== 201) throw new Error(`place pickup order ${res.status} ${JSON.stringify(res.body)}`);
  return res.body;
}
