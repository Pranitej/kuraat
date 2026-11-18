import request from 'supertest';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { BRANCH_IDS, PRODUCT_IDS } from '../support/rof-double/seed.js';
import { signInDemo } from '../helpers/auth.js';
import { createTestContext } from '../helpers/context.js';
import { TEST_PROMOS } from '../helpers/promos.js';

let t;
let me;
beforeEach(async () => {
  t = await createTestContext({ withRof: true, configOverrides: { promos: TEST_PROMOS } });
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

  test('an invalid promo code is reported but not kept in the stored cart', async () => {
    const put = await api('put', '/cart', { ...pdfCart, promoCode: 'nope' });
    expect(put.body.promo).toMatchObject({ code: 'NOPE', valid: false, error: "This code isn't valid." });
    expect(put.body.totals.discount).toBe(0);
    expect((await api('get', '/cart')).body.promo).toBeNull();
  });

  test('a valid code replaced by an invalid one leaves no code stored', async () => {
    await api('put', '/cart', { ...pdfCart, promoCode: 'KURAAT10' });
    await api('put', '/cart', { ...pdfCart, promoCode: 'NOPE' });
    expect((await api('get', '/cart')).body.promo).toBeNull();
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

  describe('pickup (design 2026-11-18 §5.3)', () => {
    const AL_RAKAH = { lat: 26.2874, lng: 50.2085 };

    test('a location in the request: the nearest hub as an estimate and the cart priced without the delivery fee', async () => {
      await api('put', '/cart', pdfCart);
      const res = await api('post', '/checkout/quote', { fulfilment: 'pickup', location: AL_RAKAH });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        fulfilment: 'pickup',
        branch: { id: BRANCH_IDS.corniche },
        distanceKm: expect.any(Number),
        isNearest: true,
        totals: { subtotal: 313, delivery: 0, total: 313, vat: 40.83 },
      });
      expect(res.body).not.toHaveProperty('window');
    });

    test('without a location in the request the last known one is used', async () => {
      await api('put', '/cart', pdfCart);
      await t.db('users').where({ id: me.user.id }).update({ last_lat: AL_RAKAH.lat, last_lng: AL_RAKAH.lng });
      const res = await api('post', '/checkout/quote', { fulfilment: 'pickup' });
      expect(res.body.branch.id).toBe(BRANCH_IDS.corniche);
    });

    test('with no location at all the default address is used', async () => {
      await api('put', '/cart', pdfCart);
      const res = await api('post', '/checkout/quote', { fulfilment: 'pickup' });
      expect(res.body.branch.id).toBe(BRANCH_IDS.corniche);
    });

    test('nothing known about where the customer is: no branch estimate, totals still priced', async () => {
      await api('put', '/cart', pdfCart);
      await t.db('addresses').where({ user_id: me.user.id }).delete();
      const res = await api('post', '/checkout/quote', { fulfilment: 'pickup' });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ fulfilment: 'pickup', branch: null, distanceKm: null, totals: { total: 313 } });
    });

    test('a delivery quote still needs an address, and has no totals of its own', async () => {
      await api('put', '/cart', pdfCart);
      const missing = await api('post', '/checkout/quote', { fulfilment: 'delivery' });
      expect(missing.status).toBe(400);
      expect(missing.body).toMatchObject({ code: 'invalid', field: 'addressId' });
      const addressId = (await api('get', '/addresses')).body.find((a) => a.label === 'Home').id;
      const ok = await api('post', '/checkout/quote', { fulfilment: 'delivery', addressId });
      expect(ok.status).toBe(200);
      expect(ok.body).not.toHaveProperty('totals');
      expect(ok.body.window).toBeTruthy();
    });

    test('the branch estimate failing does not take the prices down (review: Important 2)', async () => {
      await api('put', '/cart', pdfCart);
      t.ctx.branches.listDeliveryBranches = async () => {
        throw new Error('branch list unavailable');
      };
      const res = await api('post', '/checkout/quote', { fulfilment: 'pickup', location: AL_RAKAH });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ fulfilment: 'pickup', branch: null, distanceKm: null, totals: { total: 313, delivery: 0 } });
      expect(t.logs.some(([level, line]) => level !== 'info' && line.includes('branch list unavailable'))).toBe(true);
    });

    test('an out-of-range location is refused', async () => {
      const res = await api('post', '/checkout/quote', { fulfilment: 'pickup', location: { lat: 200, lng: 0 } });
      expect(res.status).toBe(400);
    });
  });
});
