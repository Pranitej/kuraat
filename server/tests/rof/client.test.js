import request from 'supertest';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { BRANCH_IDS, PRODUCT_IDS } from '../../mock-rof/seed.js';
import { createRofClient } from '../../src/rof/client.js';
import { RofError } from '../../src/rof/errors.js';
import { createMockRofHarness } from '../helpers/mockRof.js';

let nowMs;
let rof;
let server;

function client(overrides = {}) {
  const { email, password } = rof.store.data.credentials;
  return createRofClient({ baseUrl: server.baseUrl, email, password, timeoutMs: 2000, now: () => nowMs, ...overrides });
}

beforeEach(async () => {
  nowMs = Date.parse('2026-11-15T09:00:00Z');
  rof = createMockRofHarness({ now: () => new Date(nowMs) });
  server = await rof.listen();
});
afterEach(async () => {
  await server.close();
});

describe('ROF client — login and token', () => {
  test('logs in once for 10 concurrent calls', async () => {
    const c = client();
    await Promise.all(Array.from({ length: 10 }, () => c.listCategories()));
    expect(rof.store.data.loginCount).toBe(1);
  });

  test('renews the token when it is within 5 minutes of expiry', async () => {
    const c = client();
    await c.listCategories();
    nowMs += 54 * 60 * 1000; // 6 min left → still valid
    await c.listCategories();
    expect(rof.store.data.loginCount).toBe(1);
    nowMs += 2 * 60 * 1000; // 4 min left → renew first
    await c.listCategories();
    expect(rof.store.data.loginCount).toBe(2);
  });

  test('re-logs in and retries once after a 401', async () => {
    const c = client();
    await c.listCategories();
    await request(rof.app).post('/__dev/rotate-token-secret');
    const { items } = await c.listCategories();
    expect(items).toHaveLength(4);
    expect(rof.store.data.loginCount).toBe(2);
  });

  test('wrong credentials → RofError auth', async () => {
    const c = client({ password: 'wrong' });
    await expect(c.listCategories()).rejects.toMatchObject({ name: 'RofError', kind: 'auth' });
  });

  test('getTenantId returns the tenant from login', async () => {
    expect(await client().getTenantId()).toBe(rof.store.data.tenantId);
  });
});

describe('ROF client — replies and failures', () => {
  test('success:false becomes RofError rejected with the ROF message', async () => {
    const error = await client().getProduct('00000000-0000-0000-0000-000000000000').catch((e) => e);
    expect(error).toBeInstanceOf(RofError);
    expect(error).toMatchObject({ kind: 'rejected', message: 'Product not found' });
  });

  test('timeout becomes RofError unavailable', async () => {
    await request(rof.app).post('/__dev/faults').send({ createOrderDelayMs: 600 });
    const c = client({ timeoutMs: 200 });
    const error = await c
      .createOrder({ customerName: 'A', phoneNumber: '966501234821', items: [{ productId: PRODUCT_IDS.classic, quantity: 1 }] })
      .catch((e) => e);
    expect(error).toMatchObject({ name: 'RofError', kind: 'unavailable' });
  });

  test('ROF down (503) becomes RofError unavailable', async () => {
    const c = client();
    await c.listCategories();
    await request(rof.app).post('/__dev/faults').send({ down: true });
    await expect(c.listCategories()).rejects.toMatchObject({ kind: 'unavailable' });
  });

  test('unreachable host becomes RofError unavailable', async () => {
    const c = client({ baseUrl: 'http://127.0.0.1:1' });
    await expect(c.listCategories()).rejects.toMatchObject({ kind: 'unavailable' });
  });

  test('listBranches reads GET /api/branches and keeps only the hubs itself (ROF ignores the filter)', async () => {
    const { items } = await client().listBranches();
    expect(items).toHaveLength(6);
    expect(items.every((b) => b.isHubBranch)).toBe(true);
    expect((await client().listBranches({ hubOnly: false })).items).toHaveLength(7);
  });

  test('listBranches walks every page, so a long branch list is not cut at ROF\'s default of 10', async () => {
    const { items } = await client({ pageSize: 2 }).listBranches({ hubOnly: false });
    expect(items).toHaveLength(7);
    expect(new Set(items.map((b) => b.id)).size).toBe(7);
  });

  test('listBranches drops closed and deleted branches', async () => {
    rof.store.data.branches.find((b) => b.id === BRANCH_IDS.corniche).isActive = false;
    const { items } = await client().listBranches();
    expect(items.map((b) => b.id)).not.toContain(BRANCH_IDS.corniche);
  });

  test('listStockBalances returns every product × branch row across pages; productId narrows it', async () => {
    const all = await client({ pageSize: 4 }).listStockBalances();
    expect(all.items.length).toBeGreaterThan(10);
    expect(all.items.every((r) => 'available' in r && 'branchId' in r)).toBe(true);
    const praline = await client().listStockBalances({ productId: PRODUCT_IDS.praline });
    expect(praline.items.every((r) => r.productId === PRODUCT_IDS.praline)).toBe(true);
    expect(praline.items.find((r) => r.branchId === BRANCH_IDS.corniche).available).toBe(0);
  });

  test('listProducts returns items and totalCount; search is passed through', async () => {
    const all = await client().listProducts();
    expect(all.totalCount).toBe(7);
    const found = await client().listProducts({ search: 'cinnamon' });
    expect(found.items.map((p) => p.id)).toEqual([PRODUCT_IDS.cinnamon]);
  });

  test('order calls: create, assign, read, timeline, cancel', async () => {
    const c = client();
    const created = await c.createOrder({
      customerName: 'Sara',
      phoneNumber: '966501234821',
      items: [{ productId: PRODUCT_IDS.classic, quantity: 1 }],
    });
    const branchId = (await c.listBranches()).items[0].id;
    await c.assignBranch(created.id, branchId);
    expect((await c.getOrder(created.id)).status).toBe('AssignedToBranch');
    expect((await c.getOrderTimeline(created.id)).map((r) => r.statusTo)).toEqual(['Created', 'AssignedToBranch']);
    await c.cancelOrder(created.id);
    expect((await c.getOrder(created.id)).status).toBe('Canceled');
    await expect(c.resendDeliveryOtp(created.id)).rejects.toMatchObject({ kind: 'rejected' });
  });

  test('shareOrderLocation: the fake ROF auto-assigns the nearest hub with stock', async () => {
    const c = client();
    const created = await c.createOrder({ customerName: 'Sara', phoneNumber: '966501234821', items: [{ productId: PRODUCT_IDS.classic, quantity: 1 }] });
    await c.shareOrderLocation(created.id, { lat: 26.2874, lng: 50.2085 });
    const order = await c.getOrder(created.id);
    expect(order.status).toBe('AssignedToBranch');
    expect(order.assignedToBranch).toBe(BRANCH_IDS.corniche);
    expect((await c.getOrderTimeline(created.id)).map((r) => r.statusTo)).toEqual(['Created', 'SharedLocationManually', 'AssignedToBranch']);
  });

  test('shareOrderLocation: Praline is out of stock at Corniche, so Dhahran gets it', async () => {
    const c = client();
    const created = await c.createOrder({ customerName: 'Sara', phoneNumber: '966501234821', items: [{ productId: PRODUCT_IDS.praline, quantity: 1 }] });
    await c.shareOrderLocation(created.id, { lat: 26.2874, lng: 50.2085 });
    expect((await c.getOrder(created.id)).assignedToBranch).toBe(BRANCH_IDS.dhahran);
  });

  test('shareOrderLocation: no hub has the stock → left for staff (SharedLocationManually)', async () => {
    const c = client();
    const created = await c.createOrder({ customerName: 'Sara', phoneNumber: '966501234821', items: [{ productId: PRODUCT_IDS.classic, quantity: 50 }] });
    for (const id of Object.values(BRANCH_IDS)) if (rof.store.data.stock[PRODUCT_IDS.classic][id] !== undefined) rof.store.data.stock[PRODUCT_IDS.classic][id] = 10;
    await c.shareOrderLocation(created.id, { lat: 26.2874, lng: 50.2085 });
    const order = await c.getOrder(created.id);
    expect(order.status).toBe('SharedLocationManually');
    expect(order.assignedToBranch ?? null).toBeNull();
  });
});
