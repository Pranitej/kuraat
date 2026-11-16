import { describe, expect, test } from 'vitest';
import { cartLines, isCartBlocked, lineWarning } from './cart.js';

describe('lineWarning', () => {
  test('explains each server warning', () => {
    expect(lineWarning({ warning: 'unavailable', product: null })).toBe('No longer available. Remove it to continue.');
    expect(lineWarning({ warning: 'out_of_stock', product: { price: 28 } })).toBe('Out of stock. Remove it to continue.');
    expect(lineWarning({ warning: 'qty_reduced', qty: 3, maxQuantity: 3, product: { price: 28 } })).toBe('Only 3 left, so we changed the quantity.');
    expect(lineWarning({ warning: 'price_changed', product: { price: 190 } })).toBe('Price changed to SAR 190.00.');
  });

  test('no warning → null', () => {
    expect(lineWarning({ warning: null, product: { price: 1 } })).toBeNull();
  });
});

describe('isCartBlocked', () => {
  test('only lines that cannot be ordered block checkout', () => {
    expect(isCartBlocked([{ warning: 'price_changed' }, { warning: 'qty_reduced' }, { warning: null }])).toBe(false);
    expect(isCartBlocked([{ warning: null }, { warning: 'out_of_stock' }])).toBe(true);
    expect(isCartBlocked([{ warning: 'unavailable' }])).toBe(true);
  });
});

describe('cartLines', () => {
  const serverLine = {
    productId: 'p1',
    qty: 1,
    product: { id: 'p1', name: 'Truffle Box · Classic', price: 185, image: 'http://x/a.jpg', meta: '30 pcs · 480 g' },
    lineTotal: 185,
    available: true,
    maxQuantity: 20,
    warning: null,
  };
  const catalogProduct = { id: 'p2', name: 'Cinnamon Roll', price: 22, images: ['http://x/c.jpg'], meta: '1 pc · 140 g', inStock: true, maxQuantity: 12 };
  const getProduct = (id) => (id === 'p2' ? catalogProduct : null);

  test('uses the server line with the local quantity', () => {
    const [line] = cartLines([{ productId: 'p1', qty: 3 }], [serverLine], getProduct);
    expect(line).toMatchObject({ productId: 'p1', qty: 3, lineTotal: 555, product: serverLine.product, available: true, maxQuantity: 20 });
  });

  test('a product just added uses the catalogue until the server answers', () => {
    const [line] = cartLines([{ productId: 'p2', qty: 2 }], [], getProduct);
    expect(line).toEqual({
      productId: 'p2',
      qty: 2,
      product: { id: 'p2', name: 'Cinnamon Roll', price: 22, image: 'http://x/c.jpg', meta: '1 pc · 140 g' },
      lineTotal: 44,
      available: true,
      maxQuantity: 12,
      warning: null,
    });
  });

  test('a product neither knows is unavailable', () => {
    expect(cartLines([{ productId: 'gone', qty: 1 }], [], getProduct)[0]).toMatchObject({ product: null, available: false, warning: 'unavailable', lineTotal: 0 });
  });

  test('keeps the local order', () => {
    const lines = cartLines(
      [
        { productId: 'p2', qty: 1 },
        { productId: 'p1', qty: 1 },
      ],
      [serverLine],
      getProduct,
    );
    expect(lines.map((l) => l.productId)).toEqual(['p2', 'p1']);
  });

  test('an unavailable server line keeps zero total whatever the quantity', () => {
    const gone = { ...serverLine, available: false, warning: 'out_of_stock', lineTotal: 0, maxQuantity: 0 };
    expect(cartLines([{ productId: 'p1', qty: 2 }], [gone], getProduct)[0]).toMatchObject({ lineTotal: 0, warning: 'out_of_stock' });
  });
});
