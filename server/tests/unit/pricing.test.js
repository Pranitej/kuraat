import { describe, expect, test } from 'vitest';
import { computeTotals, findPromo, priceCart } from '../../src/modules/cart/pricing.js';

const lines = [
  { price: 185, qty: 1 }, // Truffle Box · Classic
  { price: 64, qty: 2 }, // Butter Croissant Box
];

describe('computeTotals (prices include 15 % VAT)', () => {
  test('Classic ×1 + Croissant Box ×2: 313 + 15 delivery = 328, VAT 42.78', () => {
    expect(computeTotals(lines, null)).toEqual({ count: 3, subtotal: 313, discount: 0, delivery: 15, total: 328, vat: 42.78 });
  });

  test('KURAAT10 takes 31.30 off the sweets', () => {
    expect(computeTotals(lines, findPromo('kuraat10'))).toMatchObject({ discount: 31.3, delivery: 15, total: 296.7 });
  });

  test('FREEDELIVERY removes the delivery fee', () => {
    expect(computeTotals(lines, findPromo(' FREEDELIVERY '))).toMatchObject({ discount: 0, delivery: 0, total: 313 });
  });

  test('empty cart costs nothing', () => {
    expect(computeTotals([], null)).toEqual({ count: 0, subtotal: 0, discount: 0, delivery: 0, total: 0, vat: 0 });
  });

  test('pricesIncludeVat false: VAT 49.20 added on top → total 377.20', () => {
    expect(computeTotals(lines, null, { pricesIncludeVat: false })).toMatchObject({ vat: 49.2, total: 377.2 });
  });
});

describe('priceCart', () => {
  const products = {
    p1: { id: 'p1', name: 'Truffle Box · Classic', price: 185, images: ['http://x/a.jpg'], meta: '30 pcs · 480 g', inStock: true, maxQuantity: 20 },
    p2: { id: 'p2', name: 'Butter Croissant Box', price: 64, images: [], meta: null, inStock: true, maxQuantity: 5 },
    p3: { id: 'p3', name: 'Cinnamon Roll', price: 22, images: [], meta: null, inStock: false, maxQuantity: 0 },
  };
  const getProduct = async (id) => products[id] ?? null;

  test('prices lines and flags unavailable, out of stock, reduced quantity and price changes', async () => {
    const cart = await priceCart(
      {
        items: [
          { productId: 'p1', qty: 1, lastPrice: 180 },
          { productId: 'p2', qty: 8, lastPrice: 64 },
          { productId: 'p3', qty: 1, lastPrice: 22 },
          { productId: 'gone', qty: 1, lastPrice: 10 },
        ],
        promoCode: null,
      },
      { getProduct, isFirstOrder: true },
    );
    expect(cart.items.map((l) => [l.productId, l.qty, l.available, l.warning])).toEqual([
      ['p1', 1, true, 'price_changed'],
      ['p2', 5, true, 'qty_reduced'],
      ['p3', 1, false, 'out_of_stock'],
      ['gone', 1, false, 'unavailable'],
    ]);
    expect(cart.items[0]).toMatchObject({ lineTotal: 185, product: { id: 'p1', name: 'Truffle Box · Classic', price: 185, image: 'http://x/a.jpg', meta: '30 pcs · 480 g' } });
    expect(cart.items[3].product).toBeNull();
    expect(cart.totals).toMatchObject({ count: 6, subtotal: 505, total: 520 });
    expect(cart.promo).toBeNull();
  });

  test('WELCOME15 only on a first order; unknown codes are refused', async () => {
    const items = [{ productId: 'p1', qty: 1, lastPrice: 185 }];
    const first = await priceCart({ items, promoCode: 'WELCOME15' }, { getProduct, isFirstOrder: true });
    expect(first.promo).toEqual({ code: 'WELCOME15', label: '15% off your first order', valid: true });
    expect(first.totals.discount).toBe(27.75);

    const later = await priceCart({ items, promoCode: 'WELCOME15' }, { getProduct, isFirstOrder: false });
    expect(later.promo).toEqual({ code: 'WELCOME15', label: '15% off your first order', valid: false, error: 'This code is for your first order only.' });
    expect(later.totals.discount).toBe(0);

    const unknown = await priceCart({ items, promoCode: 'nope' }, { getProduct, isFirstOrder: true });
    expect(unknown.promo).toEqual({ code: 'NOPE', label: null, valid: false, error: "This code isn't valid." });
  });
});
