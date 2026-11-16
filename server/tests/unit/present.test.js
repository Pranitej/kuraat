import { describe, expect, test } from 'vitest';
import { presentOrder } from '../../src/modules/orders/present.js';

const row = (lines) => ({
  id: 'o1',
  rof_order_number: 20418,
  step: 0,
  cancelled: 0,
  lines,
  subtotal: 185,
  discount: 0,
  delivery_fee: 15,
  vat: 26.09,
  total: 200,
  address: { city: 'Al Khobar' },
  delivery_phone: '501234821',
  window_start: '2026-11-16T14:00:00.000Z',
  window_end: '2026-11-16T16:00:00.000Z',
  estimates: {},
  rof_status: 'Confirmed',
  created_at: '2026-11-16T09:21:00.000Z',
});

describe('order photos', () => {
  const media = { from: 'http://localhost:8080', to: 'http://192.168.1.10:8080' };

  test('photo links saved with the RSOF address are served from the media address', () => {
    const order = presentOrder(row([{ productId: 'p1', name: 'A', qty: 1, price: 185, image: 'http://localhost:8080/uploads/products/a.jpg' }]), { media });
    expect(order.items[0].image).toBe('http://192.168.1.10:8080/uploads/products/a.jpg');
  });

  test('other links and missing photos are left as they are', () => {
    const order = presentOrder(
      row([
        { productId: 'p1', name: 'A', qty: 1, price: 185, image: 'https://cdn.example.com/a.jpg' },
        { productId: 'p2', name: 'B', qty: 1, price: 90, image: null },
      ]),
      { media },
    );
    expect(order.items.map((i) => i.image)).toEqual(['https://cdn.example.com/a.jpg', null]);
  });

  test('without a media setting nothing changes', () => {
    const order = presentOrder(row([{ productId: 'p1', name: 'A', qty: 1, price: 185, image: 'http://localhost:8080/uploads/a.jpg' }]));
    expect(order.items[0].image).toBe('http://localhost:8080/uploads/a.jpg');
  });
});
