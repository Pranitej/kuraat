import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { BRANCH_IDS, PRODUCT_IDS } from '../support/rof-double/seed.js';
import { RofError } from '../../src/rof/errors.js';
import { signInDemo } from '../helpers/auth.js';
import { createTestContext } from '../helpers/context.js';
import { TEST_PROMOS } from '../helpers/promos.js';

let t;
let me;
let homeId;
beforeEach(async () => {
  t = await createTestContext({ withRof: true, rofTimeoutMs: 800, configOverrides: { promos: TEST_PROMOS } });
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
  test('happy path: ROF gets the pin and assigns the nearest hub; totals stored, notifications, cart emptied', async () => {
    await api('put', '/cart', pdfCart);
    const res = await place();
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      number: 'KR-20418',
      status: { id: 'confirmed', code: 'AssignedToBranch', label: 'Sent to branch', group: 'placed', step: 0, cancelled: false },
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
    expect(rofOrders()[0]).toMatchObject({ status: 'AssignedToBranch', assignedToBranch: BRANCH_IDS.corniche, latitude: 26.348558, longitude: expect.any(Number) });
    // ROF assigned it from the pin — we never call assign/branch any more.
    expect(rofOrders()[0].timeline.map((r) => [r.statusTo, r.remarks])).toEqual([
      ['Created', 'Order created'],
      ['SharedLocationManually', 'Location shared by customer'],
      ['AssignedToBranch', 'Assigned to branch automatically'],
    ]);
    expect((await t.db('orders').first()).location_shared).toBeTruthy();
    expect((await payment()).status).toBe('captured');
    const notes = await t.db('notifications').where({ user_id: me.user.id }).whereNot({ type: 'welcome' }).orderBy('created_at');
    expect(notes.map((n) => [n.type, n.title])).toEqual([
      ['payment', 'Payment received'],
      ['order', 'Order #KR-20418 confirmed'],
    ]);
    expect(notes[1].body).toBe('It will be delivered from Kuraat · Al Khobar Corniche.');
    expect((await api('get', '/cart')).body.items).toEqual([]);
  });

  test('the ROF payload: delivery phone, MobileApp, Delivery, orderType 0, country/province, money in remarks', async () => {
    await api('put', '/cart', pdfCart);
    await place({ deliveryPhone: '559876543' });
    expect(rofOrders()[0]).toMatchObject({
      customerName: 'Sara Al-Mutairi',
      phoneNumber: '966559876543',
      customerEmail: 'sara.m@example.com',
      address: 'Building 14, King Fahd Rd, Al Rakah, Al Khobar 34445',
      city: 'Al Khobar',
      remarks: 'Landmark: Near Al Rakah Park · Account phone: +966 50 123 4821 · Paid by card',
      source: 'MobileApp',
      fulfillmentType: 'Delivery',
      orderType: 0,
      country: 'Saudi Arabia',
      province: 'Eastern Province',
      items: [
        { productId: PRODUCT_IDS.classic, quantity: 1 },
        { productId: PRODUCT_IDS.croissant, quantity: 2 },
      ],
    });
  });

  test('Praline: ROF assigns Dhahran (Corniche has no Praline)', async () => {
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

  test('an unexpected error while sending the pin never fails or locks a paid order (review: Important 1)', async () => {
    await api('put', '/cart', pdfCart);
    t.ctx.rof.shareOrderLocation = async () => {
      throw new TypeError('pin bug');
    };
    const idempotencyKey = randomUUID();
    const res = await place({ idempotencyKey });
    expect(res.status).toBe(201);
    expect((await payment()).status).toBe('captured');
    expect((await t.db('orders').first()).location_shared).toBeFalsy();
    expect((await api('get', '/cart')).body.items).toEqual([]);
    expect(t.logs.some(([level, line]) => level === 'error' && line.includes('pin bug'))).toBe(true);
    // a retry with the same key is the same order, not "in progress" forever
    const again = await place({ idempotencyKey });
    expect(again.status).toBe(200);
    expect(again.body.id).toBe(res.body.id);
  });

  test('the pin call timing out still places the order', async () => {
    await api('put', '/cart', pdfCart);
    t.ctx.rof.shareOrderLocation = async () => {
      throw new RofError('unavailable', 'ROF did not answer in time');
    };
    const res = await place();
    expect(res.status).toBe(201);
    expect(res.body.branch).toBeNull();
    expect((await payment()).status).toBe('captured');
  });

  test('no hub has the stock → still placed; ROF leaves it for staff, no branch yet, cancel allowed', async () => {
    const stock = t.mockRof.store.data.stock[PRODUCT_IDS.classic];
    for (const branchId of Object.keys(stock)) stock[branchId] = 0;
    t.mockRof.store.data.products.find((p) => p.id === PRODUCT_IDS.classic).allowOversell = true;
    await api('put', '/cart', { items: [{ productId: PRODUCT_IDS.classic, qty: 1 }] });
    const res = await place();
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ branch: null, distanceKm: null, canCancel: true, status: { code: 'SharedLocationManually', label: 'Location received' } });
    expect((await payment()).status).toBe('captured');
    expect((await t.db('notifications').where({ type: 'order' }).first()).body).toBe("Your order screen shows the branch once it's confirmed.");
    expect((await api('post', `/orders/${res.body.id}/cancel`)).status).toBe(200);
  });

  test('pin share fails → the order is still placed and paid; location_shared false, warning logged', async () => {
    await api('put', '/cart', pdfCart);
    await fault({ locationReject: 'Location service unavailable' });
    const res = await place();
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ branch: null, status: { code: 'Created', label: 'Order placed' } });
    expect((await payment()).status).toBe('captured');
    expect((await t.db('orders').first()).location_shared).toBeFalsy();
    expect(t.logs.some(([level, line]) => level === 'warn' && line.includes('pin') && line.includes('Location service unavailable'))).toBe(true);
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
    expect(res.body.payment).toEqual({ method: 'cod', brand: null, last4: null, transactionId: null, paidAt: null });
    expect(await payment()).toMatchObject({ status: 'captured', transaction_id: null });
    expect(await t.db('notifications').where({ type: 'payment' })).toHaveLength(0);
  });

  test('UPI is not offered in Saudi Arabia → 400 invalid; nothing charged, no ROF order', async () => {
    await api('put', '/cart', pdfCart);
    const res = await place({ payment: { method: 'upi', upiId: 'sara@okaxis' } });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ code: 'invalid', field: 'payment.method', message: 'Choose card or cash on delivery.' });
    expect(await payment()).toBeUndefined();
    expect(rofOrders()).toHaveLength(0);
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

  test('RSOF assigns a branch that is not a hub (e.g. the master branch): the order shows its details after a refresh (review: Important 2)', async () => {
    await api('put', '/cart', { items: [{ productId: PRODUCT_IDS.classic, qty: 1 }] });
    await fault({ locationReject: 'Location not accepted' });
    const placed = await place();
    expect(placed.body.branch).toBeNull();
    const rofId = rofOrders()[0].id;
    t.mockRof.store.data.stock[PRODUCT_IDS.classic][BRANCH_IDS.warehouse] = 5;
    const assigned = await t.mockRof.call('put', `/api/orders/${rofId}/assign/branch?BranchId=${BRANCH_IDS.warehouse}`);
    expect(assigned.body.success).toBe(true);
    t.clock.advance(60_000);
    const res = await api('get', `/orders/${placed.body.id}?refresh=true`);
    expect(res.status).toBe(200);
    expect(res.body.branch).toMatchObject({ id: BRANCH_IDS.warehouse, name: expect.any(String), address: expect.any(String), location: { lat: expect.any(Number), lng: expect.any(Number) } });
    expect(res.body.distanceKm).toEqual(expect.any(Number));
  });

  describe('branch pickup (design 2026-11-18 §5.3)', () => {
    const placePickup = (overrides = {}) =>
      api('post', '/orders', { fulfilment: 'pickup', deliveryPhone: '501234821', payment: { method: 'branch' }, idempotencyKey: randomUUID(), ...overrides });
    const setLocation = (lat, lng) => t.db('users').where({ id: me.user.id }).update({ last_lat: lat, last_lng: lng });

    test('pay at branch: no fee, no address, ROF gets Pickup and the pin from the last known location', async () => {
      await api('put', '/cart', pdfCart);
      await setLocation(26.2874, 50.2085);
      const res = await placePickup();
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        fulfilment: 'pickup',
        address: null,
        window: { start: null, end: null },
        deliveryFee: 0,
        total: 313,
        payment: { method: 'branch', brand: null, last4: null, transactionId: null, paidAt: null },
        branch: { id: BRANCH_IDS.corniche },
        status: { code: 'AssignedToBranch', label: 'Sent to branch' },
      });
      expect(res.body.steps.map((x) => x.title)).toEqual(['Order confirmed', 'Preparing at the branch', 'Ready for pickup', 'Picked up']);
      expect(rofOrders()[0]).toMatchObject({
        fulfillmentType: 'Pickup',
        address: 'Branch pickup',
        city: 'Al Khobar',
        remarks: 'Collect SAR 313.00 (pay at branch)',
        latitude: 26.2874,
        longitude: 50.2085,
      });
      expect((await payment()).method).toBe('branch');
      expect((await payment()).status).toBe('captured');
      const row = await t.db('orders').first();
      expect([row.fulfilment, row.address, row.window_start, row.delivery_fee]).toEqual(['pickup', null, null, 0]);
      const note = await t.db('notifications').where({ type: 'order' }).first();
      expect(note.body).toBe('Collect it from Kuraat · Al Khobar Corniche.');
      expect(await t.db('notifications').where({ type: 'payment' })).toHaveLength(0);
    });

    test('pay now by card: same order, card payment captured', async () => {
      await api('put', '/cart', pdfCart);
      await setLocation(26.2874, 50.2085);
      const res = await placePickup({ payment: visa });
      expect(res.status).toBe(201);
      expect(res.body.payment).toMatchObject({ method: 'card', brand: 'Visa', last4: '4242' });
      expect(rofOrders()[0].remarks).toBe('Paid by card');
    });

    test('with no saved location the default address gives the pin', async () => {
      await api('put', '/cart', pdfCart);
      const res = await placePickup();
      expect(res.status).toBe(201);
      expect(rofOrders()[0].latitude).toBe(26.348558);
    });

    test('no location and no address at all → still placed, no pin call, branch pending', async () => {
      await api('put', '/cart', pdfCart);
      await t.db('addresses').where({ user_id: me.user.id }).delete();
      const res = await placePickup();
      expect(res.status).toBe(201);
      expect(res.body.branch).toBeNull();
      expect(rofOrders()[0].latitude).toBeNull();
      expect(rofOrders()[0]).not.toHaveProperty('city', 'Al Khobar');
      expect((await t.db('orders').first()).location_shared).toBeNull();
    });

    test.each([
      ['pickup with an address', { addressId: 'whatever' }, 'addressId'],
      ['pickup paid cash on delivery', { payment: { method: 'cod' } }, 'payment.method'],
    ])('%s → 400 invalid on %s, nothing charged and no ROF order', async (_name, overrides, field) => {
      await api('put', '/cart', pdfCart);
      const res = await placePickup(overrides);
      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({ code: 'invalid', field });
      expect(await t.db('payments')).toHaveLength(0);
      expect(rofOrders()).toHaveLength(0);
    });

    test('delivery without an address, or paying at the branch, is refused too', async () => {
      await api('put', '/cart', pdfCart);
      const noAddress = await api('post', '/orders', { deliveryPhone: '501234821', payment: visa, idempotencyKey: randomUUID() });
      expect(noAddress.status).toBe(400);
      expect(noAddress.body).toMatchObject({ code: 'invalid', field: 'addressId' });
      const atBranch = await place({ payment: { method: 'branch' } });
      expect(atBranch.status).toBe(400);
      expect(atBranch.body).toMatchObject({ code: 'invalid', field: 'payment.method' });
      expect(await t.db('payments')).toHaveLength(0);
      expect(rofOrders()).toHaveLength(0);
    });

    test('cancelling a pay-at-branch order voids the payment — nothing was charged', async () => {
      await api('put', '/cart', pdfCart);
      await setLocation(26.2874, 50.2085);
      const placed = await placePickup();
      const res = await api('post', `/orders/${placed.body.id}/cancel`);
      expect(res.status).toBe(200);
      expect((await payment()).status).toBe('voided');
      expect((await t.db('notifications').where({ type: 'cancelled' }).first()).body).toBe('Your order was cancelled.');
    });
  });
});
