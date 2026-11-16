import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { BRANCH_IDS, PRODUCT_IDS } from '../../mock-rof/seed.js';
import { signInDemo } from '../helpers/auth.js';
import { createTestContext } from '../helpers/context.js';

let t;
let me;
let homeId;
beforeEach(async () => {
  t = await createTestContext({ withRof: true, rofTimeoutMs: 800 });
  await t.reset();
  me = await signInDemo(t);
  homeId = (await api('get', '/addresses')).body.find((a) => a.label === 'Home').id;
});
afterEach(async () => {
  await t?.close();
});

function api(method, path, body) {
  const req = request(t.app)[method](`/api/v1${path}`).set('Authorization', me.auth);
  return body === undefined ? req : req.send(body);
}
const rofOrders = () => t.mockRof.store.data.orders;
const fault = (faults) => request(t.mockRof.app).post('/__dev/faults').send(faults);
const visa = { method: 'card', card: { number: '4242 4242 4242 4242', expiry: '12/29', cvv: '123' } };
const pdfCart = { items: [{ productId: PRODUCT_IDS.classic, qty: 1 }, { productId: PRODUCT_IDS.croissant, qty: 2 }] };
const place = (overrides = {}) =>
  api('post', '/orders', { addressId: homeId, deliveryPhone: '501234821', payment: visa, idempotencyKey: randomUUID(), ...overrides });
const payment = () => t.db('payments').first();

describe('placing an order', () => {
  test('happy path: KR-20418, assigned to the nearest hub, totals stored, notifications, cart emptied', async () => {
    await api('put', '/cart', pdfCart);
    const res = await place();
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      number: 'KR-20418',
      status: { id: 'confirmed', label: 'Confirmed', step: 0, cancelled: false },
      items: [
        { productId: PRODUCT_IDS.classic, name: 'Truffle Box · Classic', qty: 1, price: 185 },
        { productId: PRODUCT_IDS.croissant, name: 'Butter Croissant Box', qty: 2, price: 64 },
      ],
      subtotal: 313,
      discount: 0,
      deliveryFee: 15,
      vat: 42.78,
      total: 328,
      payment: { method: 'card', brand: 'Visa', last4: '4242' },
      branch: { id: BRANCH_IDS.corniche, name: 'Kuraat · Al Khobar Corniche' },
      distanceKm: 5.8,
      deliveryPhone: '501234821',
      window: { start: '2026-11-15T14:00:00.000Z', end: '2026-11-15T16:00:00.000Z' },
      canCancel: true,
      canResendCode: false,
    });
    expect(res.body.steps.map((s) => [s.id, s.state, s.estimated])).toEqual([
      ['confirmed', 'current', false],
      ['preparing', 'todo', true],
      ['out_for_delivery', 'todo', true],
      ['delivered', 'todo', true],
    ]);

    expect(rofOrders()).toHaveLength(1);
    expect(rofOrders()[0]).toMatchObject({ status: 'AssignedToBranch', assignedToBranch: BRANCH_IDS.corniche });
    expect((await payment()).status).toBe('captured');
    const notes = await t.db('notifications').where({ user_id: me.user.id }).whereNot({ type: 'welcome' }).orderBy('created_at');
    expect(notes.map((n) => [n.type, n.title])).toEqual([
      ['payment', 'Payment received'],
      ['order', 'Order #KR-20418 confirmed'],
    ]);
    expect(notes[1].body).toBe('It will be delivered from Kuraat · Al Khobar Corniche.');
    expect((await api('get', '/cart')).body.items).toEqual([]);
  });

  test('the ROF payload uses the delivery phone, MobileApp source and Delivery fulfilment', async () => {
    await api('put', '/cart', pdfCart);
    await place({ deliveryPhone: '559876543' });
    expect(rofOrders()[0]).toMatchObject({
      customerName: 'Sara Al-Mutairi',
      phoneNumber: '966559876543',
      customerEmail: 'sara.m@example.com',
      address: 'Building 14, King Fahd Rd, Al Rakah, Al Khobar 34445',
      city: 'Al Khobar',
      remarks: 'Landmark: Near Al Rakah Park · Account phone: +966 50 123 4821',
      source: 'MobileApp',
      fulfillmentType: 'Delivery',
      items: [
        { productId: PRODUCT_IDS.classic, quantity: 1 },
        { productId: PRODUCT_IDS.croissant, quantity: 2 },
      ],
    });
  });

  test('Praline: Corniche refuses (no stock), Dhahran accepts', async () => {
    await api('put', '/cart', { items: [{ productId: PRODUCT_IDS.praline, qty: 1 }] });
    const res = await place();
    expect(res.status).toBe(201);
    expect(res.body.branch.id).toBe(BRANCH_IDS.dhahran);
    expect(res.body.distanceKm).toBe(7.4);
    expect((await t.db('notifications').where({ type: 'order' }).first()).body).toBe('It will be delivered from Kuraat · Dhahran · King Abdulaziz Rd.');
  });

  test('the same idempotencyKey twice → the same order and exactly one ROF order', async () => {
    await api('put', '/cart', pdfCart);
    const idempotencyKey = randomUUID();
    const first = await place({ idempotencyKey });
    const second = await place({ idempotencyKey });
    expect(second.status).toBe(200);
    expect(second.body.id).toBe(first.body.id);
    expect(rofOrders()).toHaveLength(1);
    expect(await t.db('payments')).toHaveLength(1);
  });

  test('a declined card → 402, no ROF order; retrying the same key with another card works', async () => {
    await api('put', '/cart', pdfCart);
    const idempotencyKey = randomUUID();
    const declined = await place({ idempotencyKey, payment: { ...visa, card: { ...visa.card, number: '4000 0000 0000 0002' } } });
    expect(declined.status).toBe(402);
    expect(declined.body).toMatchObject({ code: 'card_declined', field: 'card' });
    expect(rofOrders()).toHaveLength(0);
    expect((await payment()).status).toBe('failed');
    const retry = await place({ idempotencyKey });
    expect(retry.status).toBe(201);
    expect(rofOrders()).toHaveLength(1);
  });

  test('ROF refuses the order → 409 rof_rejected with the ROF message, payment voided', async () => {
    await api('put', '/cart', pdfCart);
    await fault({ createOrderReject: 'Only 3 of "Truffle Box · Classic" available (requested 5)' });
    const res = await place();
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ message: 'Only 3 of "Truffle Box · Classic" available (requested 5)', code: 'rof_rejected', field: null });
    expect((await payment()).status).toBe('voided');
    expect(await t.db('orders')).toHaveLength(0);
  });

  test('no nearby branch has stock → the ROF order is cancelled, 409 not_available_nearby', async () => {
    const stock = t.mockRof.store.data.stock[PRODUCT_IDS.classic];
    for (const branchId of Object.keys(stock)) stock[branchId] = branchId === BRANCH_IDS.jeddah ? 50 : 0;
    await api('put', '/cart', { items: [{ productId: PRODUCT_IDS.classic, qty: 1 }] });
    const res = await place();
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('not_available_nearby');
    expect(rofOrders()[0].status).toBe('Canceled');
    expect(await t.db('orders')).toHaveLength(0);
    expect((await payment()).status).toBe('voided');
  });

  test('ROF create times out → 503 order_unconfirmed, payment needs_review, never retried', async () => {
    await api('put', '/cart', pdfCart);
    await fault({ createOrderDelayMs: 1500 });
    const idempotencyKey = randomUUID();
    const res = await place({ idempotencyKey });
    expect(res.status).toBe(503);
    expect(res.body.code).toBe('order_unconfirmed');
    expect((await payment()).status).toBe('needs_review');
    const again = await place({ idempotencyKey });
    expect(again.status).toBe(503);
    expect(again.body.code).toBe('order_unconfirmed');
    await new Promise((r) => setTimeout(r, 1800));
    expect(rofOrders()).toHaveLength(1); // ROF did create it once; we never sent a second create
  });

  test('cart changed since the customer saw it → 409 cart_changed, cart untouched', async () => {
    await api('put', '/cart', pdfCart);
    t.mockRof.store.data.products.find((p) => p.id === PRODUCT_IDS.classic).sellingPrice = 195;
    const res = await place();
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('cart_changed');
    expect(res.body.message).toContain('Truffle Box · Classic');
    expect(rofOrders()).toHaveLength(0);
    expect((await api('get', '/cart')).body.items).toHaveLength(2);
  });

  test('cash on delivery: no payment notification, payment captured without a transaction id', async () => {
    await api('put', '/cart', pdfCart);
    const res = await place({ payment: { method: 'cod' } });
    expect(res.status).toBe(201);
    expect(res.body.payment).toEqual({ method: 'cod', brand: null, last4: null, upiId: null, transactionId: null, paidAt: null });
    expect(await payment()).toMatchObject({ status: 'captured', transaction_id: null });
    expect(await t.db('notifications').where({ type: 'payment' })).toHaveLength(0);
  });

  test('saveCard remembers brand and last 4 only', async () => {
    await api('put', '/cart', pdfCart);
    await place({ payment: { ...visa, saveCard: true } });
    expect((await api('get', '/cards')).body).toEqual([{ id: expect.any(String), brand: 'Visa', last4: '4242', expiry: '12/29' }]);
  });

  test('promo codes in the cart are applied to the order', async () => {
    await api('put', '/cart', { ...pdfCart, promoCode: 'KURAAT10' });
    const res = await place();
    expect(res.body).toMatchObject({ discount: 31.3, total: 296.7, promoCode: 'KURAAT10' });
  });

  test('empty cart → 400 empty_cart; unknown address → 404', async () => {
    expect((await place()).body.code).toBe('empty_cart');
    await api('put', '/cart', pdfCart);
    expect((await place({ addressId: randomUUID() })).status).toBe(404);
  });
});
