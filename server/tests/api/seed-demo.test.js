import request from 'supertest';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { DEMO_ORDERS, PRODUCT_IDS, createSeed } from '../../mock-rof/seed.js';
import { DEMO_PASSWORD, DEMO_PHONE, seedDemo } from '../../src/db/seedDemo.js';
import { createTestContext } from '../helpers/context.js';

const START = '2026-11-15T09:21:00.000Z';
let t;
beforeEach(async () => {
  t = await createTestContext({ withRof: true, rofData: createSeed({ now: new Date(START) }) });
  await t.reset();
});
afterEach(async () => {
  await t?.close();
});

const seed = (opts = {}) => seedDemo(t.db, { now: t.clock.now(), hashCost: 4, ctx: t.ctx, demoOrders: DEMO_ORDERS, ...opts });
async function get(path) {
  const signin = await request(t.app).post('/api/v1/auth/signin').send({ phone: DEMO_PHONE, password: DEMO_PASSWORD });
  return request(t.app).get(`/api/v1${path}`).set('Authorization', `Bearer ${signin.body.tokens.accessToken}`);
}
const pdfCart = [
  [PRODUCT_IDS.classic, 1],
  [PRODUCT_IDS.croissant, 2],
];
const cartLines = async () => (await get('/cart')).body.items.map((l) => [l.productId, l.qty]);

describe('demo seed with the fake ROF', () => {
  test('adds the two past orders as delivered, newest first, with the PDF totals', async () => {
    expect(await seed()).toMatchObject({ created: true, ordersAdded: 2, skipped: null });
    const list = (await get('/orders?tab=delivered')).body;
    expect(list.map((o) => [o.number, o.total, o.status.id])).toEqual([
      ['KR-20377', 93, 'delivered'],
      ['KR-20291', 200, 'delivered'],
    ]);
  });

  test('a past order reads like a real one: ROF times, items, branch and card', async () => {
    await seed();
    const [latest] = (await get('/orders')).body;
    const order = (await get(`/orders/${latest.id}`)).body;
    expect(order.createdAt).toBe('2026-11-08T10:05:00.000Z'); // 13:05 Saudi time, 7 days before
    expect(order.items).toEqual([
      expect.objectContaining({ productId: PRODUCT_IDS.cheesecake, name: 'Burnt Chocolate Cheesecake', qty: 2, price: 28 }),
      expect.objectContaining({ productId: PRODUCT_IDS.cinnamon, name: 'Cinnamon Roll', qty: 1, price: 22 }),
    ]);
    expect(order).toMatchObject({ subtotal: 78, deliveryFee: 15, total: 93, vat: 12.13, canCancel: false });
    expect(order.branch.name).toBe('Kuraat · Al Khobar Corniche');
    expect(order.payment).toMatchObject({ method: 'card', brand: 'Visa', last4: '4242', transactionId: 'TXN-61C0B7E2' });
    expect(order.steps.every((s) => s.state === 'done' && !s.estimated)).toBe(true);
    expect(order.steps.at(-1).time).toBe('2026-11-08T15:52:00.000Z');
    expect(order.address).toMatchObject({ label: 'Home', line: 'Building 14, King Fahd Rd' });
  });

  test('gives the demo customer the PDF cart', async () => {
    await seed();
    expect(await cartLines()).toEqual(pdfCart);
  });

  test('adds the PDF notifications and no order-status ones', async () => {
    await seed();
    const list = (await get('/notifications')).body;
    expect(list.map((n) => [n.type, n.title, n.read]).sort()).toEqual(
      [
        ['delivered', 'Order #KR-20377 delivered', true],
        ['product', 'New: Praline Truffle Box', false],
        ['security', 'Password updated', true],
        ['welcome', 'Welcome to kuraat', false],
      ].sort(),
    );
    expect(list.find((n) => n.type === 'product').link).toEqual({ kind: 'product', id: PRODUCT_IDS.praline });
  });

  test('is safe to run twice', async () => {
    await seed();
    expect(await seed()).toMatchObject({ created: false, ordersAdded: 0 });
    expect(await t.db('orders')).toHaveLength(2);
    expect(await t.db('payments')).toHaveLength(2);
    expect(await t.db('notifications')).toHaveLength(4);
  });

  test('adds the past orders and the cart later to a demo customer created without the ROF', async () => {
    expect(await seed({ ctx: null })).toMatchObject({ created: true, ordersAdded: 0, skipped: expect.stringMatching(/ROF/) });
    expect(await seed()).toMatchObject({ created: false, ordersAdded: 2, skipped: null });
    expect(await cartLines()).toEqual(pdfCart);
  });

  test('keeps a cart the customer already filled', async () => {
    await seed({ ctx: null });
    const signin = await request(t.app).post('/api/v1/auth/signin').send({ phone: DEMO_PHONE, password: DEMO_PASSWORD });
    await request(t.app)
      .put('/api/v1/cart')
      .set('Authorization', `Bearer ${signin.body.tokens.accessToken}`)
      .send({ items: [{ productId: PRODUCT_IDS.pancakes, qty: 3 }] });
    await seed();
    expect(await cartLines()).toEqual([[PRODUCT_IDS.pancakes, 3]]);
  });

  test('skips orders this ROF does not have, and then adds no extras', async () => {
    const unknown = [{ ...DEMO_ORDERS[0], id: 'd3000000-0000-4000-8000-000000099999' }];
    const result = await seed({ demoOrders: unknown });
    expect(result).toMatchObject({ created: true, ordersAdded: 0, skipped: expect.stringMatching(/not found/i) });
    expect(await cartLines()).toEqual([]);
    expect((await t.db('notifications')).map((n) => n.type)).toEqual(['welcome']);
  });

  test('skips with a reason when the ROF is unreachable', async () => {
    await request(t.mockRof.app).post('/__dev/faults').send({ down: true });
    const result = await seed();
    expect(result.ordersAdded).toBe(0);
    expect(result.skipped).toMatch(/reach/i);
  });
});
