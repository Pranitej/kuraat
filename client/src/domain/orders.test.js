// Runs in America/New_York (vitest.config.js, UTC-5 in November): every label is in the device zone, not Saudi time.
// The 12/24-hour style follows the device: these use a 24-hour device unless a test says otherwise.
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { setClockReader } from './format.js';
import { ORDER_FILTERS, PICKUP, cancelRefundText, filterOrders, isPickup, orderHistoryView, orderItemCount, orderStatusView, orderTimelineView, paidLater, paymentLabel } from './orders.js';

beforeEach(() => setClockReader(() => true));
afterEach(() => setClockReader(null));

const NOW = new Date('2026-11-15T09:30:00Z'); // 04:30 in New York
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
    step('out_for_delivery', 'Out for delivery', 'todo', null),
    step('delivered', 'Delivered', 'todo', null),
  ],
};
// What an older server sent: made-up times on the steps ahead, flagged `estimated`.
const withEstimates = {
  ...preparing,
  steps: [
    ...preparing.steps.slice(0, 2),
    step('out_for_delivery', 'Out for delivery', 'todo', '2026-11-15T13:30:00Z', { estimated: true }),
    step('delivered', 'Delivered', 'todo', '2026-11-15T14:00:00Z', { estimated: true, timeEnd: '2026-11-15T16:00:00Z' }),
  ],
};

describe('orderTimelineView', () => {
  test('reached steps show their real time in the device time zone; steps ahead show no time', () => {
    expect(orderTimelineView(preparing, NOW).map((s) => s.time)).toEqual(['04:21', '04:25', '', '']);
    expect(orderTimelineView(preparing, NOW).map((s) => s.state)).toEqual(['done', 'current', 'todo', 'todo']);
  });

  test('a time an older server still marks as estimated is never shown', () => {
    expect(orderTimelineView(withEstimates, NOW).map((s) => s.time)).toEqual(['04:21', '04:25', '', '']);
  });

  test('a 12-hour device gets AM/PM on every real time', () => {
    setClockReader(() => false);
    expect(orderTimelineView(preparing, NOW).map((s) => s.time)).toEqual(['4:21 AM', '4:25 AM', '', '']);
  });

  test('times from other days get the date in front', () => {
    const older = {
      ...preparing,
      steps: [
        step('confirmed', 'Order confirmed', 'done', '2026-11-08T10:05:00Z'),
        step('preparing', 'Preparing at the branch', 'current', '2026-11-14T15:00:00Z'),
      ],
    };
    expect(orderTimelineView(older, NOW).map((s) => s.time)).toEqual(['8 Nov, 05:05', '14 Nov, 10:00']);
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
      ['confirmed', 'done', '04:21'],
      ['cancelled', 'cancelled', '04:40'],
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

  test('the group comes from the server; an order needing attention reads as an alert', () => {
    const order = { status: { id: 'confirmed', label: 'Being reviewed', group: 'attention', step: 0, cancelled: false } };
    expect(orderStatusView(order)).toMatchObject({ group: 'attention', tone: 'alert', ongoing: true });
  });

  test('orderStatusView falls back to a group from step when the reply has none (older copy)', () => {
    expect(orderStatusView({ status: { id: 'out_for_delivery', label: 'Out for delivery', step: 2, cancelled: false } }).group).toBe('on_the_way');
    expect(orderStatusView({ status: { id: 'confirmed', label: 'Confirmed', step: 0, cancelled: false } }).group).toBe('placed');
    expect(orderStatusView({ status: { id: 'cancelled', label: 'Cancelled', step: 1, cancelled: true } }).group).toBe('cancelled');
  });
});

describe('order status filter (design 2026-11-18 §5.4)', () => {
  const order = (id, group, step = 0) => ({ id, status: { id: 'x', label: 'x', group, step, cancelled: group === 'cancelled' } });
  const ORDERS = [order('a', 'placed'), order('b', 'preparing', 1), order('c', 'completed', 3), order('d', 'cancelled'), order('e', 'ready', 2)];

  test('the dropdown options, in order', () => {
    expect(ORDER_FILTERS).toEqual([
      { id: 'all', label: 'All orders' },
      { id: 'placed', label: 'Placed' },
      { id: 'attention', label: 'Needs attention' },
      { id: 'preparing', label: 'Preparing' },
      { id: 'ready', label: 'Ready for pickup' },
      { id: 'on_the_way', label: 'On the way' },
      { id: 'completed', label: 'Completed' },
      { id: 'cancelled', label: 'Cancelled' },
    ]);
  });

  test('all keeps every order; a group keeps only its orders', () => {
    expect(filterOrders(ORDERS, 'all').map((o) => o.id)).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(filterOrders(ORDERS, 'completed').map((o) => o.id)).toEqual(['c']);
    expect(filterOrders(ORDERS, 'ready').map((o) => o.id)).toEqual(['e']);
    expect(filterOrders(ORDERS, 'on_the_way')).toEqual([]);
  });
});

describe('small helpers', () => {
  test('item count and payment label', () => {
    expect(orderItemCount(preparing)).toBe(3);
    expect(paymentLabel({ method: 'card', brand: 'Visa', last4: '4242' })).toBe('Visa •••• 4242');
    expect(paymentLabel({ method: 'cod' })).toBe('Cash on delivery');
    expect(paymentLabel({ method: 'upi', upiId: 'sara@bank' })).toBe('');
  });
});

describe('pickup (design 2026-11-18 §5.3)', () => {
  test('isPickup: only orders the server marks as pickup; old orders are delivery', () => {
    expect(isPickup({ fulfilment: 'pickup' })).toBe(true);
    expect(isPickup({ fulfilment: 'delivery' })).toBe(false);
    expect(isPickup({})).toBe(false);
    expect(isPickup(null)).toBe(false);
  });

  test('pay at branch has its own label', () => {
    expect(paymentLabel({ method: 'branch' })).toBe('Pay at branch');
    expect(paymentLabel({ method: 'cod' })).toBe('Cash on delivery');
  });

  test('the counter help names the plain RSOF number and the phone', () => {
    expect(PICKUP.counterHelp('KR-20418')).toBe('Staff can find it by the number 20418 or your phone number.');
    expect(PICKUP.counterHelp('20418')).toBe('Staff can find it by the number 20418 or your phone number.');
  });
});

describe('paid later, and what the cancel dialog promises (review: Important 1)', () => {
  test('cash on delivery and pay at branch are paid later; a card is not', () => {
    expect(paidLater({ method: 'cod' })).toBe(true);
    expect(paidLater({ method: 'branch' })).toBe(true);
    expect(paidLater({ method: 'card' })).toBe(false);
    expect(paidLater(null)).toBe(false);
  });

  test('nothing is refunded when nothing was charged', () => {
    for (const method of ['cod', 'branch']) {
      expect(cancelRefundText({ payment: { method }, total: 313 })).toBe('Nothing has been charged.');
    }
    expect(cancelRefundText({ payment: null, total: 313 })).toBe('Nothing has been charged.');
  });

  test('a card payment is refunded to the card', () => {
    expect(cancelRefundText({ payment: { method: 'card', brand: 'Visa', last4: '4242' }, total: 313 })).toBe('We will refund SAR 313.00 to Visa •••• 4242.');
  });
});

describe('orderHistoryView (every status RSOF recorded)', () => {
  const history = [
    { id: 'Created', label: 'Order placed', group: 'placed', cancelled: false, time: '2026-11-15T09:00:00.000Z' },
    { id: 'Canceled', label: 'Cancelled', group: 'cancelled', cancelled: true, time: '2026-11-15T09:10:00.000Z' },
    { id: 'Preparing', label: 'Preparing', group: 'preparing', cancelled: false, time: '2026-11-15T09:20:00.000Z' },
  ];

  test('lists every status with its time, oldest first; the cancelled one stays even though RSOF reopened the order', () => {
    const rows = orderHistoryView({ history }, NOW);
    expect(rows.map((r) => [r.title, r.cancelled, r.time])).toEqual([
      ['Order placed', false, '04:00'],
      ['Cancelled', true, '04:10'],
      ['Preparing', false, '04:20'],
    ]);
    expect(new Set(rows.map((r) => r.id)).size).toBe(3);
  });

  test('a note RSOF wrote for a change is kept, otherwise empty', () => {
    const rows = orderHistoryView({ history: [{ ...history[0], note: 'Reopened by staff' }, history[1]] }, NOW);
    expect(rows.map((r) => r.note)).toEqual(['Reopened by staff', '']);
  });

  test('a status without a time has an empty time, and an order without history has no rows', () => {
    expect(orderHistoryView({ history: [{ ...history[0], time: null }] }, NOW)[0].time).toBe('');
    expect(orderHistoryView({}, NOW)).toEqual([]);
  });
});
