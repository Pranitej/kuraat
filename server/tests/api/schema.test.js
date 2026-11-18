import bcrypt from 'bcryptjs';
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { DEMO_PASSWORD, DEMO_PHONE, seedDemo } from '../helpers/demoCustomer.js';
import { createTestContext } from '../helpers/context.js';

let t;
beforeAll(async () => {
  t = await createTestContext();
});
beforeEach(async () => {
  await t.reset();
});
afterAll(async () => {
  await t?.close();
});

const TABLES = [
  'users',
  'refresh_tokens',
  'otp_challenges',
  'addresses',
  'carts',
  'favorites',
  'saved_cards',
  'orders',
  'payments',
  'notifications',
];

describe('schema', () => {
  test('all tables exist after migrate', async () => {
    for (const table of TABLES) expect(await t.db.schema.hasTable(table), table).toBe(true);
  });

  test('migration 003: last known customer location and whether the order pin reached ROF', async () => {
    for (const column of ['last_lat', 'last_lng', 'last_location_at']) expect(await t.db.schema.hasColumn('users', column), column).toBe(true);
    expect(await t.db.schema.hasColumn('orders', 'location_shared')).toBe(true);
  });

  test('migration 004: pickup columns, nullable address/window, branch payments', async () => {
    expect(await t.db.schema.hasColumn('orders', 'fulfilment')).toBe(true);
    const { userId } = await seedDemo(t.db, { now: t.clock.now(), hashCost: 4 });
    const now = t.clock.now();
    const orderId = '00000000-0000-4000-8000-0000000000b1';
    await t.db('orders').insert({
      id: orderId, user_id: userId, rof_order_id: 'r-1', rof_order_number: 1, rof_status: 'Created', fulfilment: 'pickup',
      address: null, delivery_phone: '501234821', lines: '[]', subtotal: 1, discount: 0, delivery_fee: 0, vat: 0, total: 1,
      window_start: null, window_end: null, estimates: '{}', created_at: now, updated_at: now,
    });
    await t.db('payments').insert({
      id: '00000000-0000-4000-8000-0000000000b2', user_id: userId, order_id: orderId, idempotency_key: '00000000-0000-4000-8000-0000000000b3',
      method: 'branch', status: 'captured', amount: 1, created_at: now, updated_at: now,
    });
    expect((await t.db('orders').where({ id: orderId }).first()).fulfilment).toBe('pickup');
    expect((await t.db('payments').first()).method).toBe('branch');
  });

  test('money columns are DECIMAL(10,2) and come back as numbers', async () => {
    const { userId } = await seedDemo(t.db, { now: t.clock.now(), hashCost: 4 });
    await t.db('payments').insert({
      id: '00000000-0000-4000-8000-000000000001',
      user_id: userId,
      idempotency_key: '00000000-0000-4000-8000-0000000000aa',
      method: 'card',
      status: 'authorized',
      amount: 328.5,
      created_at: t.clock.now(),
      updated_at: t.clock.now(),
    });
    const row = await t.db('payments').first();
    expect(row.amount).toBe(328.5);
  });
});

describe('seedDemo', () => {
  test('creates the demo user with a hashed password, 3 addresses (Home default), a welcome note and an empty cart', async () => {
    const { userId } = await seedDemo(t.db, { now: t.clock.now(), hashCost: 4 });
    const user = await t.db('users').where({ id: userId }).first();
    expect(user).toMatchObject({ phone: DEMO_PHONE, name: 'Sara Al-Mutairi', gender: 'female', email: 'sara.m@example.com' });
    expect(await bcrypt.compare(DEMO_PASSWORD, user.password_hash)).toBe(true);

    const addresses = await t.db('addresses').where({ user_id: userId }).orderBy('created_at');
    expect(addresses.map((a) => a.label)).toEqual(['Home', 'Office', 'Parents’ home']);
    expect(addresses.filter((a) => a.is_default)).toHaveLength(1);
    expect(addresses[0]).toMatchObject({ is_default: 1, city: 'Al Khobar', lat: 26.348558, lng: 50.193673 });

    expect(await t.db('notifications').where({ user_id: userId, type: 'welcome' })).toHaveLength(1);
    const cart = await t.db('carts').where({ user_id: userId }).first();
    expect(cart.items).toEqual([]);
  });

  test('is idempotent', async () => {
    const first = await seedDemo(t.db, { now: t.clock.now(), hashCost: 4 });
    const second = await seedDemo(t.db, { now: t.clock.now(), hashCost: 4 });
    expect(second.userId).toBe(first.userId);
    expect(await t.db('users')).toHaveLength(1);
    expect(await t.db('addresses')).toHaveLength(3);
  });

  test('addresses are deleted with their user', async () => {
    const { userId } = await seedDemo(t.db, { now: t.clock.now(), hashCost: 4 });
    await t.db('users').where({ id: userId }).delete();
    expect(await t.db('addresses')).toHaveLength(0);
    expect(await t.db('carts')).toHaveLength(0);
  });
});
