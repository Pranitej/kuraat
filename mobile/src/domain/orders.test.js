// Runs in America/New_York (vitest.config.js): every label must still be Saudi time.
import { describe, expect, test } from 'vitest';
import { orderItemCount, orderStatusView, orderTimelineView, paymentLabel } from './orders.js';

const NOW = new Date('2026-11-15T09:30:00Z'); // 12:30 in Saudi Arabia
const step = (id, title, state, time, extra = {}) => ({ id, title, state, time, timeEnd: null, estimated: false, ...extra });

const preparing = {
  status: { id: 'preparing', label: 'Preparing', step: 1, cancelled: false },
  cancelledAt: null,
  items: [
    { productId: 'p1', qty: 2 },
    { productId: 'p2', qty: 1 },
  ],
  steps: [
    step('confirmed', 'Order confirmed', 'done', '2026-11-15T09:21:00Z'),
    step('preparing', 'Preparing at the branch', 'current', '2026-11-15T09:25:00Z'),
    step('out_for_delivery', 'Out for delivery', 'todo', '2026-11-15T13:30:00Z', { estimated: true }),
    step('delivered', 'Delivered', 'todo', '2026-11-15T14:00:00Z', { estimated: true, timeEnd: '2026-11-15T16:00:00Z' }),
  ],
};

describe('orderTimelineView', () => {
  test('reached steps show their time, the rest their estimate — in Saudi time', () => {
    expect(orderTimelineView(preparing, NOW).map((s) => s.time)).toEqual(['12:21', '12:25', 'Estimated 4:30 PM', 'Estimated 5:00 – 7:00 PM']);
    expect(orderTimelineView(preparing, NOW).map((s) => s.state)).toEqual(['done', 'current', 'todo', 'todo']);
  });

  test('other days get the date in front, tomorrow says so', () => {
    const later = {
      ...preparing,
      steps: [
        step('confirmed', 'Order confirmed', 'done', '2026-11-08T10:05:00Z'),
        step('preparing', 'Preparing at the branch', 'todo', '2026-11-16T07:00:00Z', { estimated: true }),
      ],
    };
    expect(orderTimelineView(later, NOW).map((s) => s.time)).toEqual(['8 Nov, 13:05', 'Estimated Tomorrow, 10:00']);
  });

  test('a cancelled order shows the steps it reached, then a cancelled row', () => {
    const cancelled = {
      ...preparing,
      status: { id: 'cancelled', label: 'Cancelled', step: 0, cancelled: true },
      cancelledAt: '2026-11-15T09:40:00Z',
      steps: preparing.steps.map((s, i) => ({ ...s, state: i === 0 ? 'done' : 'todo', estimated: false, time: i === 0 ? s.time : null })),
    };
    const rows = orderTimelineView(cancelled, NOW);
    expect(rows.map((r) => [r.id, r.state, r.time])).toEqual([
      ['confirmed', 'done', '12:21'],
      ['cancelled', 'cancelled', '12:40'],
    ]);
    expect(rows[1].title).toBe('Order cancelled');
  });
});

describe('orderStatusView', () => {
  test('ongoing orders are dark, delivered light, cancelled alert', () => {
    expect(orderStatusView(preparing)).toMatchObject({ id: 'preparing', label: 'Preparing', ongoing: true, tone: 'dark' });
    expect(orderStatusView({ status: { id: 'delivered', label: 'Delivered', step: 3, cancelled: false } })).toMatchObject({ ongoing: false, tone: 'light' });
    expect(orderStatusView({ status: { id: 'cancelled', label: 'Cancelled', step: 0, cancelled: true } })).toMatchObject({ ongoing: false, tone: 'alert', cancelled: true });
  });
});

describe('small helpers', () => {
  test('item count and payment label', () => {
    expect(orderItemCount(preparing)).toBe(3);
    expect(paymentLabel({ method: 'card', brand: 'Visa', last4: '4242' })).toBe('Visa •••• 4242');
    expect(paymentLabel({ method: 'upi', upiId: 'sara@bank' })).toBe('UPI · sara@bank');
    expect(paymentLabel({ method: 'cod' })).toBe('Cash on delivery');
  });
});
