import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { createOrderPoller } from '../../src/jobs/orderPoller.js';
import { signInDemo } from '../helpers/auth.js';
import { createTestContext } from '../helpers/context.js';
import { advance, placePickupTestOrder, placeTestOrder } from '../helpers/orders.js';

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

const statusNotes = () => t.db('notifications').whereIn('type', ['out_for_delivery', 'delivered', 'cancelled']).orderBy('created_at');

describe('order status poller', () => {
  test('one notification per new status, never twice', async () => {
    const order = await placeTestOrder(t, me);
    const poller = createOrderPoller({ ctx: t.ctx, intervalMs: 60_000 });

    await advance(t, order.number, 'OutForDelivery');
    t.clock.advance(60_000);
    await poller.tick();
    await poller.tick();
    t.clock.advance(60_000);
    await advance(t, order.number, 'Delivered');
    await poller.tick();
    t.clock.advance(60_000);
    await poller.tick();

    const notes = await statusNotes();
    expect(notes.map((n) => [n.type, n.title, n.body])).toEqual([
      ['out_for_delivery', `Order #${order.number} is on its way`, 'Your courier has left Kuraat · Al Khobar Corniche.'],
      ['delivered', `Order #${order.number} delivered`, 'Delivered from Kuraat · Al Khobar Corniche. Enjoy!'],
    ]);
    expect((await t.db('orders').first()).step).toBe(3);
  });

  test('a cancellation made by staff in ROF is noticed and notified', async () => {
    const order = await placeTestOrder(t, me);
    await advance(t, order.number, 'Canceled');
    t.clock.advance(60_000);
    await createOrderPoller({ ctx: t.ctx }).tick();
    expect((await statusNotes()).map((n) => n.type)).toEqual(['cancelled']);
    expect(Boolean((await t.db('orders').first()).cancelled)).toBe(true);
  });

  test('finished orders are not polled; ROF errors are logged, never thrown', async () => {
    const order = await placeTestOrder(t, me);
    await advance(t, order.number, 'Delivered');
    const poller = createOrderPoller({ ctx: t.ctx });
    t.clock.advance(60_000);
    await poller.tick(); // picks up Delivered
    const loginsBefore = t.mockRof.store.data.loginCount;
    const calls = [];
    const realGet = t.ctx.rof.getOrder;
    t.ctx.rof.getOrder = (...args) => {
      calls.push(args);
      return realGet(...args);
    };
    t.clock.advance(60_000);
    await poller.tick();
    expect(calls).toHaveLength(0);
    t.ctx.rof.getOrder = realGet;
    expect(t.mockRof.store.data.loginCount).toBe(loginsBefore);

    const second = await placeTestOrder(t, me);
    expect(second.number).toBe('KR-20419');
    await (await import('supertest')).default(t.mockRof.app).post('/__dev/faults').send({ down: true });
    t.clock.advance(60_000);
    await expect(poller.tick()).resolves.toBeUndefined();
    expect(t.logs.some(([level]) => level === 'warn')).toBe(true);
  });

  test('a pickup order is announced as ready for pickup and picked up, never "on its way" or "delivered"', async () => {
    const order = await placePickupTestOrder(t, me);
    const poller = createOrderPoller({ ctx: t.ctx, intervalMs: 60_000 });
    await advance(t, order.number, 'Prepared');
    t.clock.advance(60_000);
    await poller.tick();
    await poller.tick();
    await advance(t, order.number, 'PickUpByCustomer');
    t.clock.advance(60_000);
    await poller.tick();
    const notes = await t.db('notifications').whereIn('type', ['ready_for_pickup', 'picked_up', 'out_for_delivery', 'delivered']).orderBy('created_at');
    expect(notes.map((n) => [n.type, n.title, n.body])).toEqual([
      ['ready_for_pickup', `Order #${order.number} is ready for pickup`, 'Collect it from Kuraat · Al Khobar Corniche.'],
      ['picked_up', `Order #${order.number} picked up`, 'Picked up from Kuraat · Al Khobar Corniche. Enjoy!'],
    ]);
  });
});
