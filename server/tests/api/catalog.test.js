import request from 'supertest';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { BRANCH_IDS, CATEGORY_IDS, PRODUCT_IDS } from '../../mock-rof/seed.js';
import { signInDemo } from '../helpers/auth.js';
import { createTestContext } from '../helpers/context.js';

let t;
let auth;
beforeEach(async () => {
  t = await createTestContext({ withRof: true, rofTimeoutMs: 500 });
  await t.reset();
  ({ auth } = await signInDemo(t));
});
afterEach(async () => {
  await t?.close();
});

const get = (path) => request(t.app).get(`/api/v1${path}`).set('Authorization', auth);
const goDown = () => request(t.mockRof.app).post('/__dev/faults').send({ down: true });

describe('catalogue', () => {
  test('categories in our shape', async () => {
    const res = await get('/categories');
    expect(res.status).toBe(200);
    expect(res.body.map((c) => c.name)).toEqual(['Truffles', 'Cakes', 'Pastries', 'Breakfast']);
    expect(res.body[0]).toEqual({ id: CATEGORY_IDS.truffles, name: 'Truffles', imageUrl: null });
  });

  test('products hide the inactive one and never expose ROF field names', async () => {
    const res = await get('/products');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(6);
    expect(res.body.find((p) => p.id === PRODUCT_IDS.inactive)).toBeUndefined();
    expect(JSON.stringify(res.body)).not.toMatch(/sellingPrice|availableToSell|primaryImageUrl|customFields/);
    const classic = res.body.find((p) => p.id === PRODUCT_IDS.classic);
    expect(classic).toMatchObject({ name: 'Truffle Box · Classic', price: 185, meta: '30 pcs · 480 g', featured: true, inStock: true });
    expect(classic.images[0]).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/uploads\/products\/truffle-box-classic-1\.jpg$/);
  });

  test('filter by category and search', async () => {
    expect((await get(`/products?categoryId=${CATEGORY_IDS.pastries}`)).body.map((p) => p.name).sort()).toEqual([
      'Butter Croissant Box',
      'Cinnamon Roll',
    ]);
    expect((await get('/products?search=cinnamon')).body.map((p) => p.id)).toEqual([PRODUCT_IDS.cinnamon]);
    // Search covers descriptions too: the Classic box mentions "pistachio praline".
    expect((await get('/products?search=praline')).body.map((p) => p.id).sort()).toEqual([PRODUCT_IDS.classic, PRODUCT_IDS.praline].sort());
  });

  test('product detail: gallery and detail rows in display order', async () => {
    const res = await get(`/products/${PRODUCT_IDS.classic}`);
    expect(res.body.images).toHaveLength(3);
    expect(res.body.subtitle).toBe('Signature gift box · Contains milk, nuts');
    expect(res.body.details.map((d) => d.label)).toEqual(['Net weight', 'Pieces', 'Dimensions (L × W × H)', 'Shelf life', 'Storage']);
    expect(res.body.details[0].value).toBe('480 g');
    expect(res.body.highlights).toEqual([
      { label: 'Weight', value: '480 g' },
      { label: 'Pieces', value: '30 pcs' },
      { label: 'Dimensions', value: '32 × 14 × 5 cm' },
    ]);
    expect(res.body.ingredients).toMatch(/^Chocolate, cream/);
    expect(res.body.allergens).toEqual(['Milk', 'Nuts', 'Soy', 'May contain gluten']);
  });

  test('inactive or unknown product → 404 not_found', async () => {
    expect((await get(`/products/${PRODUCT_IDS.inactive}`)).body.code).toBe('not_found');
    expect((await get('/products/00000000-0000-0000-0000-000000000000')).status).toBe(404);
  });

  test('requires sign-in', async () => {
    expect((await request(t.app).get('/api/v1/products')).status).toBe(401);
  });
});

describe('branches', () => {
  test('6 hub branches with hours and openNow; internal fields and the warehouse are dropped', async () => {
    const res = await get('/branches');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(6);
    expect(res.body.find((b) => b.id === BRANCH_IDS.warehouse)).toBeUndefined();
    expect(res.body.find((b) => b.id === BRANCH_IDS.corniche)).toEqual({
      id: BRANCH_IDS.corniche,
      name: 'Kuraat · Al Khobar Corniche',
      address: 'Prince Faisal bin Fahd Rd, Al Khobar 31952',
      city: 'Al Khobar',
      phone: '+966 13 555 0110',
      location: { lat: 26.305709, lng: 50.227336 },
      hours: { open: 10, close: 24 },
      openNow: true,
    });
    expect(JSON.stringify(res.body)).not.toMatch(/dailyOrderLimit|assignedOrdersToday|secondPriorityBranchId|parentBranchId/);
  });

  test('openNow follows Saudi time regardless of the server time zone (21:30Z = 00:30 Saudi → closed)', async () => {
    t.clock.set('2026-11-15T21:30:00Z');
    ({ auth } = await signInDemo(t)); // the earlier token expired when the clock moved
    const res = await get('/branches');
    expect(res.body.every((b) => b.openNow === false)).toBe(true);
  });
});

describe('when ROF is unavailable', () => {
  test('a warm cache keeps serving products, even after it goes stale', async () => {
    expect((await get('/products')).status).toBe(200);
    await goDown();
    t.clock.advance(5 * 60 * 1000);
    const res = await get('/products');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(6);
  });

  test('a cold cache answers 503 rof_unavailable with a friendly message', async () => {
    await goDown();
    const res = await get('/branches');
    expect(res.status).toBe(503);
    expect(res.body).toEqual({ message: "We can't reach the store right now. Please try again in a moment.", code: 'rof_unavailable', field: null });
  });
});
