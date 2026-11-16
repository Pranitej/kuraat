import jwt from 'jsonwebtoken';
import request from 'supertest';
import { beforeEach, describe, expect, test } from 'vitest';
import { createMockRof } from '../../mock-rof/app.js';
import { BRANCH_IDS, PRODUCT_IDS, TENANT_ID, createSeed } from '../../mock-rof/seed.js';
import { createStore } from '../../mock-rof/store.js';

let store;
let app;
let nowMs;

async function login() {
  const { email, password } = store.data.credentials;
  const res = await request(app).post('/api/auth/login').send({ email, password });
  return res.body.data.token;
}

beforeEach(() => {
  store = createStore({ data: createSeed() });
  nowMs = Date.parse('2026-11-15T09:00:00Z');
  app = createMockRof({ store, now: () => new Date(nowMs) });
});

describe('fake ROF — login', () => {
  test('returns a JWT that expires in 60 minutes and the tenant id', async () => {
    const { email, password } = store.data.credentials;
    const res = await request(app).post('/api/auth/login').send({ email, password });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.tenantId).toBe(TENANT_ID);
    const payload = jwt.decode(res.body.data.token);
    expect(payload.exp - payload.iat).toBe(3600);
  });

  test('wrong password → HTTP 200 with success:false', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: store.data.credentials.email, password: 'nope' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: false, message: 'Invalid email or password' });
  });

  test('the 6th login within a minute is refused with 429', async () => {
    for (let i = 0; i < 5; i += 1) await login();
    const { email, password } = store.data.credentials;
    const res = await request(app).post('/api/auth/login').send({ email, password });
    expect(res.status).toBe(429);
    expect(res.body.success).toBe(false);
  });

  test('calls without a valid token are 401', async () => {
    const res = await request(app).get('/api/category/all');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test('an expired token is 401', async () => {
    const token = await login();
    nowMs += 61 * 60 * 1000;
    const res = await request(app).get('/api/category/all').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(401);
  });
});

describe('fake ROF — catalogue', () => {
  test('categories use the list envelope', async () => {
    const token = await login();
    const res = await request(app).get('/api/category/all?PageIndex=1&PageSize=100').set('Authorization', `Bearer ${token}`);
    expect(res.body).toMatchObject({ success: true, message: 'Success', totalCount: 4, pageNumber: 1, pageSize: 100 });
    expect(res.body.data.map((c) => c.name)).toEqual(['Truffles', 'Cakes', 'Pastries', 'Breakfast']);
  });

  test('products list includes the inactive product and the guide fields', async () => {
    const token = await login();
    const res = await request(app).get('/api/products?PageIndex=1&PageSize=20').set('Authorization', `Bearer ${token}`);
    expect(res.body.totalCount).toBe(7);
    expect(res.body.data.some((p) => p.status === 'Inactive')).toBe(true);
    const classic = res.body.data.find((p) => p.id === PRODUCT_IDS.classic);
    expect(classic).toMatchObject({
      name: 'Truffle Box · Classic',
      status: 'Active',
      sellingPrice: 185,
      allowOversell: false,
      baseUnitName: 'Piece',
      categoryName: 'Truffles',
      primaryImageUrl: '/uploads/products/truffle-box-classic-1.jpg',
    });
    expect(classic.availableToSell).toBe(300);
    expect(classic.images).toBeUndefined();
  });

  test('Search and CategoryId filter products', async () => {
    const token = await login();
    const search = await request(app).get('/api/products?Search=croissant').set('Authorization', `Bearer ${token}`);
    expect(search.body.data.map((p) => p.id)).toEqual([PRODUCT_IDS.croissant]);
    const cakes = await request(app).get(`/api/products?CategoryId=${search.body.data[0].categoryId}`).set('Authorization', `Bearer ${token}`);
    expect(cakes.body.data.every((p) => p.categoryName === 'Pastries')).toBe(true);
  });

  test('product detail has images and customFieldDefinitions', async () => {
    const token = await login();
    const res = await request(app).get(`/api/products/${PRODUCT_IDS.classic}`).set('Authorization', `Bearer ${token}`);
    expect(res.body.success).toBe(true);
    expect(res.body.data.images).toHaveLength(3);
    expect(res.body.data.images[0]).toMatchObject({ isPrimary: true, displayOrder: 0 });
    expect(res.body.data.customFields).toMatchObject({ weight_g: 480, pieces: '30 pcs', featured: true });
    expect(res.body.data.customFieldDefinitions.find((d) => d.fieldKey === 'weight_g')).toMatchObject({ label: 'Net weight', dataType: 'number' });
  });

  test('unknown product → HTTP 200 with success:false', async () => {
    const token = await login();
    const res = await request(app).get('/api/products/00000000-0000-0000-0000-000000000000').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: false, message: 'Product not found' });
  });

  test('product images are served from /uploads', async () => {
    const res = await request(app).get('/uploads/products/truffle-box-classic-1.jpg');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/image\/jpeg/);
  });
});

describe('fake ROF — branches and inventory', () => {
  test('branches: all active, hub filter drops the warehouse, internal fields present', async () => {
    const token = await login();
    const all = await request(app).get(`/api/branches/tenant/${TENANT_ID}`).set('Authorization', `Bearer ${token}`);
    expect(all.body.data).toHaveLength(7);
    const hubs = await request(app).get(`/api/branches/tenant/${TENANT_ID}?isHubBranch=true`).set('Authorization', `Bearer ${token}`);
    expect(hubs.body.data).toHaveLength(6);
    expect(hubs.body.data.every((b) => b.branchType === 'hub' && b.isHubBranch === true)).toBe(true);
    expect(hubs.body.data[0]).toHaveProperty('dailyOrderLimit');
    expect(hubs.body.data[0]).toHaveProperty('latitude');
  });

  test('branch Search matches city', async () => {
    const token = await login();
    const res = await request(app).get(`/api/branches/tenant/${TENANT_ID}?Search=riyadh`).set('Authorization', `Bearer ${token}`);
    expect(res.body.data.map((b) => b.id)).toEqual([BRANCH_IDS.riyadh]);
  });

  test('wrong tenant → success:false', async () => {
    const token = await login();
    const res = await request(app).get('/api/branches/tenant/nope').set('Authorization', `Bearer ${token}`);
    expect(res.body).toEqual({ success: false, message: 'Tenant not found' });
  });

  test('single branch by id', async () => {
    const token = await login();
    const res = await request(app).get(`/api/branches/${BRANCH_IDS.corniche}`).set('Authorization', `Bearer ${token}`);
    expect(res.body.data).toMatchObject({ name: 'Kuraat · Al Khobar Corniche', city: 'Al Khobar', isHubBranch: true });
  });

  test('inventory: Praline has 0 at Corniche and 50 at Dhahran', async () => {
    const token = await login();
    const res = await request(app).get(`/api/inventory/product/${PRODUCT_IDS.praline}`).set('Authorization', `Bearer ${token}`);
    const byBranch = Object.fromEntries(res.body.data.map((r) => [r.branchId, r.quantity]));
    expect(byBranch[BRANCH_IDS.corniche]).toBe(0);
    expect(byBranch[BRANCH_IDS.dhahran]).toBe(50);
  });
});
