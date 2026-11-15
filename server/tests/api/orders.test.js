import request from 'supertest';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { signInDemo, signUp } from '../helpers/auth.js';
import { createTestContext } from '../helpers/context.js';
import { advance, placeTestOrder } from '../helpers/orders.js';

let t;
let me;
beforeEach(async () => {
  t = await createTestContext({ withRof: true });
  await t.reset();
  me = await signInDemo(t);
});
afterEach(async () => {
  await t?.close();
});

const api = (method, path, as = me.auth) => request(t.app)[method](`/api/v1${path}`).set('Authorization', as);
const minutes = (n) => t.clock.advance(n * 60_000);

describe('order detail and tracking', () => {
  test('reached steps show ROF times; the rest show our estimates', async () => {
    const order = await placeTestOrder(t, me);
    minutes(10);
    await advance(t, order.number, 'BranchAccepted');
    await advance(t, order.number, 'Preparing');
    const res = await api('get', `/orders/${order.id}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toEqual({ id: 'preparing', label: 'Preparing', step: 1, cancelled: false });
    expect(res.body.steps).toEqual([
      { id: 'confirmed', title: 'Order confirmed', state: 'done', time: '2026-11-15T09:21:00.000Z', timeEnd: null, estimated: false },
      { id: 'preparing', title: 'Preparing at the branch', state: 'current', time: '2026-11-15T09:31:00.000Z', timeEnd: null, estimated: false },
      { id: 'out_for_delivery', title: 'Out for delivery', state: 'todo', time: '2026-11-15T13:30:00.000Z', timeEnd: null, estimated: true },
      { id: 'delivered', title: 'Delivered', state: 'todo', time: '2026-11-15T14:00:00.000Z', timeEnd: '2026-11-15T16:00:00.000Z', estimated: true },
    ]);
    expect(res.body.canCancel).toBe(false);
    expect(res.body.branch).toMatchObject({ name: 'Kuraat · Al Khobar Corniche', phone: '+966 13 555 0110', location: { lat: 26.305709, lng: 50.227336 } });
  });

  test('a delivered order has every step done', async () => {
    const order = await placeTestOrder(t, me);
    minutes(1);
    await advance(t, order.number, 'Delivered');
    const res = await api('get', `/orders/${order.id}`);
    expect(res.body.status.id).toBe('delivered');
    expect(res.body.steps.every((s) => s.state === 'done')).toBe(true);
  });

  test('an unknown ROF status keeps the last known step', async () => {
    const order = await placeTestOrder(t, me);
    minutes(1);
    await advance(t, order.number, 'Preparing');
    expect((await api('get', `/orders/${order.id}`)).body.status.step).toBe(1);
    t.mockRof.store.data.orders[0].status = 'TransferRequested';
    minutes(1);
    const res = await api('get', `/orders/${order.id}`);
    expect(res.body.status.step).toBe(1);
    expect(t.logs.some(([level, line]) => level === 'warn' && line.includes('TransferRequested'))).toBe(true);
  });

  test('ROF down → the last known order is still shown', async () => {
    const order = await placeTestOrder(t, me);
    await request(t.mockRof.app).post('/__dev/faults').send({ down: true });
    minutes(1);
    const res = await api('get', `/orders/${order.id}`);
    expect(res.status).toBe(200);
    expect(res.body.number).toBe(order.number);
  });

  test("another user's order → 404", async () => {
    const order = await placeTestOrder(t, me);
    const other = await signUp(t.app);
    expect((await api('get', `/orders/${order.id}`, other.auth)).status).toBe(404);
  });
});

describe('order list tabs', () => {
  test('ongoing excludes delivered and cancelled; delivered = step 3; all = everything, newest first', async () => {
    const delivered = await placeTestOrder(t, me);
    minutes(1);
    const cancelled = await placeTestOrder(t, me);
    minutes(1);
    const ongoing = await placeTestOrder(t, me);
    await advance(t, delivered.number, 'Delivered');
    expect((await api('post', `/orders/${cancelled.id}/cancel`)).status).toBe(200);
    minutes(1);

    const ids = async (tab) => (await api('get', `/orders${tab ? `?tab=${tab}` : ''}`)).body.map((o) => o.id);
    expect(await ids('ongoing')).toEqual([ongoing.id]);
    expect(await ids('delivered')).toEqual([delivered.id]);
    expect(await ids('all')).toEqual([ongoing.id, cancelled.id, delivered.id]);
    expect(await ids()).toEqual([ongoing.id, cancelled.id, delivered.id]);
  });
});

describe('cancel', () => {
  test('in step 0: cancelled in ROF, refunded, notified', async () => {
    const order = await placeTestOrder(t, me);
    const res = await api('post', `/orders/${order.id}/cancel`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: { id: 'cancelled', label: 'Cancelled', cancelled: true }, canCancel: false });
    expect(t.mockRof.store.data.orders[0].status).toBe('Canceled');
    expect((await t.db('payments').first()).status).toBe('refunded');
    const note = await t.db('notifications').where({ type: 'cancelled' }).first();
    expect(note).toMatchObject({ title: `Order #${order.number} cancelled` });
    expect(note.body).toBe('Your order was cancelled. SAR 200.00 will be refunded to Visa •••• 4242.');
  });

  test('after Preparing → 409 cannot_cancel and nothing changes in ROF', async () => {
    const order = await placeTestOrder(t, me);
    await advance(t, order.number, 'Preparing');
    const res = await api('post', `/orders/${order.id}/cancel`);
    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ code: 'cannot_cancel', message: 'This order can no longer be cancelled.' });
    expect(t.mockRof.store.data.orders[0].status).toBe('Preparing');
  });

  test('cash on delivery is voided, not refunded', async () => {
    const order = await placeTestOrder(t, me, { payment: { method: 'cod' } });
    await api('post', `/orders/${order.id}/cancel`);
    expect((await t.db('payments').first()).status).toBe('voided');
    expect((await t.db('notifications').where({ type: 'cancelled' }).first()).body).toBe('Your order was cancelled.');
  });
});

describe('delivery code', () => {
  test('resend only while OutForDelivery; twice within 60 s → 429', async () => {
    const order = await placeTestOrder(t, me);
    expect((await api('post', `/orders/${order.id}/resend-code`)).body.code).toBe('cannot_resend');
    await advance(t, order.number, 'OutForDelivery');
    minutes(1);
    const first = await api('post', `/orders/${order.id}/resend-code`);
    expect(first.status).toBe(200);
    expect(first.body).toEqual({ sent: true, resendAt: '2026-11-15T09:23:00.000Z' });
    const second = await api('post', `/orders/${order.id}/resend-code`);
    expect(second.status).toBe(429);
    expect(second.body.code).toBe('resend_too_soon');
    minutes(1);
    expect((await api('post', `/orders/${order.id}/resend-code`)).status).toBe(200);
  });
});
