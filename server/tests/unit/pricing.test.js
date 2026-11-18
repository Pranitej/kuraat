import { describe, expect, test } from 'vitest';
import { computeTotals, priceCart } from '../../src/modules/cart/pricing.js';

const lines = [
  { price: 185, qty: 1 }, // Truffle Box · Classic
  { price: 64, qty: 2 }, // Butter Croissant Box
];

describe('computeTotals (the product prices RSOF sends, nothing else)', () => {
  test('Classic ×1 + Croissant Box ×2 = 313: no delivery fee, no VAT line, no discount', () => {
    expect(computeTotals(lines)).toEqual({ count: 3, subtotal: 313, total: 313 });
  });

  test('empty cart costs nothing', () => {
    expect(computeTotals([])).toEqual({ count: 0, subtotal: 0, total: 0 });
  });

  test('prices with pence are added without rounding drift', () => {
    expect(computeTotals([{ price: 19.99, qty: 3 }, { price: 0.1, qty: 3 }])).toEqual({ count: 6, subtotal: 60.27, total: 60.27 });
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
      },
      { getProduct },
    );
    expect(cart.items.map((l) => [l.productId, l.qty, l.available, l.warning])).toEqual([
      ['p1', 1, true, 'price_changed'],
      ['p2', 5, true, 'qty_reduced'],
      ['p3', 1, false, 'out_of_stock'],
      ['gone', 1, false, 'unavailable'],
    ]);
    expect(cart.items[0]).toMatchObject({ lineTotal: 185, product: { id: 'p1', name: 'Truffle Box · Classic', price: 185, image: 'http://x/a.jpg', meta: '30 pcs · 480 g' } });
    expect(cart.items[3].product).toBeNull();
    expect(cart.totals).toEqual({ count: 6, subtotal: 505, total: 505 });
    expect(cart).not.toHaveProperty('promo');
  });
});
