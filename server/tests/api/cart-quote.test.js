import request from 'supertest';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { BRANCH_IDS, PRODUCT_IDS } from '../../mock-rof/seed.js';
import { signInDemo } from '../helpers/auth.js';
import { createTestContext } from '../helpers/context.js';

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

const api = (method, path, body) => {
  const req = request(t.app)[method](`/api/v1${path}`).set('Authorization', me.auth);
  return body === undefined ? req : req.send(body);
};
const rofProduct = (key) => t.mockRof.store.data.products.find((p) => p.id === PRODUCT_IDS[key]);
const pdfCart = { items: [{ productId: PRODUCT_IDS.classic, qty: 1 }, { productId: PRODUCT_IDS.croissant, qty: 2 }] };

describe('cart', () => {
  test('starts empty', async () => {
    const res = await api('get', '/cart');
    expect(res.body).toEqual({ items: [], promo: null, totals: { count: 0, subtotal: 0, discount: 0, delivery: 0, total: 0, vat: 0 } });
  });

  test('PUT stores and prices the PDF cart; GET returns the same', async () => {
    const put = await api('put', '/cart', { ...pdfCart, promoCode: null });
    expect(put.status).toBe(200);
    expect(put.body.totals).toEqual({ count: 3, subtotal: 313, discount: 0, delivery: 15, total: 328, vat: 42.78 });
    expect(put.body.items[0]).toMatchObject({ productId: PRODUCT_IDS.classic, qty: 1, available: true, warning: null, lineTotal: 185 });
    expect((await api('get', '/cart')).body.totals.total).toBe(328);
  });

  test('promo codes are applied and remembered; WELCOME15 works on a first order', async () => {
    const res = await api('put', '/cart', { ...pdfCart, promoCode: 'welcome15' });
    expect(res.body.promo).toMatchObject({ code: 'WELCOME15', valid: true });
    expect(res.body.totals.discount).toBe(46.95);
    expect((await api('get', '/cart')).body.promo.code).toBe('WELCOME15');
  });

  test('a deactivated product shows as unavailable and leaves the totals', async () => {
    await api('put', '/cart', pdfCart);
    rofProduct('croissant').status = 'Inactive';
    const res = await api('get', '/cart');
    expect(res.body.items[1]).toMatchObject({ available: false, warning: 'unavailable', product: null });
    expect(res.body.totals).toMatchObject({ count: 1, subtotal: 185, total: 200 });
  });

  test('quantity is capped at stock (qty_reduced) and price changes are flagged', async () => {
    await api('put', '/cart', { items: [{ productId: PRODUCT_IDS.croissant, qty: 8 }] });
    for (const branchId of Object.keys(t.mockRof.store.data.stock[PRODUCT_IDS.croissant])) {
      t.mockRof.store.data.stock[PRODUCT_IDS.croissant][branchId] = 1;
    }
    rofProduct('croissant').sellingPrice = 70;
    const res = await api('get', '/cart');
    expect(res.body.items[0]).toMatchObject({ qty: 6, warning: 'qty_reduced', product: { price: 70 } });
    const again = await api('get', '/cart');
    expect(again.body.items[0]).toMatchObject({ qty: 6 });
  });

  test('a price change since the customer last saw the cart is flagged', async () => {
    await api('put', '/cart', pdfCart);
    rofProduct('classic').sellingPrice = 190;
    const res = await api('get', '/cart');
    expect(res.body.items[0]).toMatchObject({ warning: 'price_changed', lineTotal: 190 });
  });

  test('invalid quantities are refused', async () => {
    const res = await api('put', '/cart', { items: [{ productId: PRODUCT_IDS.classic, qty: 0 }] });
    expect(res.body).toMatchObject({ code: 'invalid', field: 'items.0.qty' });
  });
});

describe('checkout quote', () => {
  const homeId = async () => (await api('get', '/addresses')).body.find((a) => a.label === 'Home').id;

  test('picks the nearest hub for the Home address with a Saudi-time delivery window', async () => {
    await api('put', '/cart', pdfCart);
    const res = await api('post', '/checkout/quote', { addressId: await homeId() });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      branch: { id: BRANCH_IDS.corniche, name: 'Kuraat · Al Khobar Corniche' },
      distanceKm: 5.8,
      isNearest: true,
      inStock: null,
      window: { start: '2026-11-15T14:00:00.000Z', end: '2026-11-15T16:00:00.000Z' },
    });
  });

  test('with the inventory check on, Praline skips Corniche (no stock) and ships from Dhahran', async () => {
    t.ctx.config.rof.inventoryCheck = true;
    await api('put', '/cart', { items: [{ productId: PRODUCT_IDS.praline, qty: 1 }] });
    const res = await api('post', '/checkout/quote', { addressId: await homeId() });
    expect(res.body).toMatchObject({ branch: { id: BRANCH_IDS.dhahran }, isNearest: false, inStock: true, distanceKm: 7.4 });
  });

  test('productIds can be given instead of the cart (product page "Delivered from")', async () => {
    t.ctx.config.rof.inventoryCheck = true;
    const res = await api('post', '/checkout/quote', { addressId: await homeId(), productIds: [PRODUCT_IDS.praline] });
    expect(res.body.branch.id).toBe(BRANCH_IDS.dhahran);
  });

  test("unknown or someone else's address → 404", async () => {
    const res = await api('post', '/checkout/quote', { addressId: '00000000-0000-4000-8000-000000000000' });
    expect(res.status).toBe(404);
  });
});
