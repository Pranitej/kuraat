/** Test helper: put items in the cart and place an order through the API. */
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { PRODUCT_IDS } from '../../mock-rof/seed.js';

export const VISA = { method: 'card', card: { number: '4242 4242 4242 4242', expiry: '12/29', cvv: '123' } };

export async function placeTestOrder(t, me, { items = [{ productId: PRODUCT_IDS.classic, qty: 1 }], payment = VISA } = {}) {
  const api = (method, path, body) => request(t.app)[method](`/api/v1${path}`).set('Authorization', me.auth).send(body);
  await api('put', '/cart', { items });
  const addresses = await request(t.app).get('/api/v1/addresses').set('Authorization', me.auth);
  const home = addresses.body.find((a) => a.isDefault);
  const res = await api('post', '/orders', { addressId: home.id, deliveryPhone: '501234821', payment, idempotencyKey: randomUUID() });
  if (res.status !== 201) throw new Error(`place order ${res.status} ${JSON.stringify(res.body)}`);
  return res.body;
}

/** Plays branch staff in the fake ROF. */
export const advance = (t, number, status) =>
  request(t.mockRof.app)
    .post(`/__dev/orders/${String(number).replace('KR-', '')}/advance`)
    .send(status ? { status } : {});

/** A pickup order paid at the branch (the pin comes from the customer's default address). */
export async function placePickupTestOrder(t, me, { items = [{ productId: PRODUCT_IDS.classic, qty: 1 }], payment = { method: 'branch' } } = {}) {
  const api = (method, path, body) => request(t.app)[method](`/api/v1${path}`).set('Authorization', me.auth).send(body);
  await api('put', '/cart', { items });
  const res = await api('post', '/orders', { fulfilment: 'pickup', deliveryPhone: '501234821', payment, idempotencyKey: randomUUID() });
  if (res.status !== 201) throw new Error(`place pickup order ${res.status} ${JSON.stringify(res.body)}`);
  return res.body;
}
