/** Regression tests for the final review findings (one per finding). */
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterEach, describe, expect, test } from 'vitest';
import { PRODUCT_IDS } from '../support/rof-double/seed.js';
import { loadConfig } from '../../src/config/env.js';
import { signInDemo } from '../helpers/auth.js';
import { createTestContext } from '../helpers/context.js';
import { VISA, advance, placeTestOrder } from '../helpers/orders.js';

let t;
afterEach(async () => {
  await t?.close();
  t = null;
});

describe('finding 1 — concurrent retries after a failed payment', () => {
  test('two simultaneous retries with the same key create exactly one ROF order', async () => {
    t = await createTestContext({ withRof: true });
    await t.reset();
    const me = await signInDemo(t);
    const api = (method, path, body) => request(t.app)[method](`/api/v1${path}`).set('Authorization', me.auth).send(body);
    await api('put', '/cart', { items: [{ productId: PRODUCT_IDS.classic, qty: 1 }] });
    const home = (await api('get', '/addresses')).body.find((a) => a.isDefault);
    const idempotencyKey = randomUUID();
    const body = (card) => ({ addressId: home.id, deliveryPhone: '501234821', payment: { ...VISA, card }, idempotencyKey });
    expect((await api('post', '/orders', body({ ...VISA.card, number: '4000 0000 0000 0002' }))).status).toBe(402);

    const [a, b] = await Promise.all([api('post', '/orders', body(VISA.card)), api('post', '/orders', body(VISA.card))]);
    expect([a.status, b.status].sort()).toEqual([201, 409]);
    expect(t.mockRof.store.data.orders).toHaveLength(1);
  });
});

describe('finding 2 — concurrent status refreshes', () => {
  test('two refreshes of the same change send one notification', async () => {
    t = await createTestContext({ withRof: true });
    await t.reset();
    const me = await signInDemo(t);
    const order = await placeTestOrder(t, me);
    await advance(t, order.number, 'OutForDelivery');
    const row = await t.db('orders').first();
    await Promise.all([t.ctx.orders.refresh(row), t.ctx.orders.refresh(row), t.ctx.orders.refresh(row)]);
    expect(await t.db('notifications').where({ type: 'out_for_delivery' })).toHaveLength(1);
  });

  test('a staff cancellation seen while the customer cancels is notified and refunded once', async () => {
    t = await createTestContext({ withRof: true });
    await t.reset();
    const me = await signInDemo(t);
    const order = await placeTestOrder(t, me);
    const row = await t.db('orders').first();
    await Promise.all([
      request(t.app).post(`/api/v1/orders/${order.id}/cancel`).set('Authorization', me.auth),
      (async () => {
        await advance(t, order.number, 'Canceled').catch(() => {});
        await t.ctx.orders.refresh(row);
      })(),
    ]);
    expect(await t.db('notifications').where({ type: 'cancelled' })).toHaveLength(1);
  });
});

describe('finding 3 — test login codes in production', () => {
  const env = {
    DATABASE_URL: 'mysql://u:p@h:3307/d',
    JWT_ACCESS_SECRET: 'a'.repeat(32),
    JWT_REFRESH_SECRET: 'b'.repeat(32),
    ROF_BASE_URL: 'https://rofuat.rsof.com.sa',
    ROF_EMAIL: 'x@y.z',
    ROF_PASSWORD: 'p',
    NODE_ENV: 'production',
    OTP_MODE: 'test',
  };
  test('refuses to start in production with OTP_MODE=test unless explicitly allowed (UAT)', () => {
    expect(() => loadConfig(env)).toThrow(/OTP_MODE=test/);
    expect(loadConfig({ ...env, OTP_ALLOW_TEST_IN_PRODUCTION: 'true' }).otp.mode).toBe('test');
  });
});

describe('finding 4 — rate limits behind a proxy', () => {
  test('with TRUST_PROXY, each client IP has its own login limit', async () => {
    t = await createTestContext({ configOverrides: { authRateLimitPerMinute: 2, trustProxy: '1' } });
    const signin = (ip) =>
      request(t.app).post('/api/v1/auth/signin').set('X-Forwarded-For', ip).send({ phone: '501234821', password: 'x' });
    await signin('203.0.113.1');
    await signin('203.0.113.1');
    expect((await signin('203.0.113.1')).status).toBe(429);
    expect((await signin('203.0.113.2')).status).not.toBe(429);
  });

  test('TRUST_PROXY is read from the environment', () => {
    const base = {
      DATABASE_URL: 'mysql://u:p@h:3307/d',
      JWT_ACCESS_SECRET: 'a'.repeat(32),
      JWT_REFRESH_SECRET: 'b'.repeat(32),
      ROF_BASE_URL: 'http://localhost:8080',
      ROF_EMAIL: 'x@y.z',
      ROF_PASSWORD: 'p',
    };
    expect(loadConfig(base).trustProxy).toBe(false);
    expect(loadConfig({ ...base, TRUST_PROXY: '1' }).trustProxy).toBe('1');
  });
});
