/** Order status + timeline (pure). Status is derived from the order's schedule and the clock. */

import { formatDayMonth, formatTime, formatTime12, formatWindow, isSameDay } from './format.js';

/** '' for today, 'Tomorrow, ' or '8 Nov, ' otherwise. */
function dayPrefix(value, now) {
  if (isSameDay(value, now)) return '';
  const t = new Date(now);
  t.setDate(t.getDate() + 1);
  return isSameDay(value, t) ? 'Tomorrow, ' : `${formatDayMonth(value)}, `;
}

export const ORDER_STATUS = {
  confirmed: { id: 'confirmed', label: 'Confirmed', tone: 'dark', ongoing: true, step: 0 },
  preparing: { id: 'preparing', label: 'Preparing', tone: 'dark', ongoing: true, step: 1 },
  out_for_delivery: { id: 'out_for_delivery', label: 'Out for delivery', tone: 'dark', ongoing: true, step: 2 },
  delivered: { id: 'delivered', label: 'Delivered', tone: 'light', ongoing: false, step: 3 },
};

export function orderStatus(order, now = new Date()) {
  const t = now.getTime();
  const at = (k) => new Date(order.schedule[k]).getTime();
  if (t >= at('deliveredAt')) return ORDER_STATUS.delivered;
  if (t >= at('outForDeliveryAt')) return ORDER_STATUS.out_for_delivery;
  if (t >= at('preparingAt')) return ORDER_STATUS.preparing;
  return ORDER_STATUS.confirmed;
}

/** Timeline rows for the order detail screen (PDF screen 22). */
export function orderTimeline(order, now = new Date()) {
  const status = orderStatus(order, now);
  const s = order.schedule;
  const state = (step) => (status.step > step ? 'done' : status.step === step ? 'current' : 'todo');
  const steps = [
    { id: 'confirmed', title: 'Order confirmed', time: `${dayPrefix(s.createdAt, now)}${formatTime(s.createdAt)}`, state: 'done' },
    {
      id: 'preparing',
      title: 'Preparing at the branch',
      time: status.step >= 1 ? `${dayPrefix(s.preparingAt, now)}${formatTime(s.preparingAt)}` : `Estimated ${dayPrefix(s.preparingAt, now)}${formatTime(s.preparingAt)}`,
      state: state(1),
    },
    {
      id: 'out_for_delivery',
      title: 'Out for delivery',
      time: status.step >= 2 ? `${dayPrefix(s.outForDeliveryAt, now)}${formatTime(s.outForDeliveryAt)}` : `Estimated ${dayPrefix(s.outForDeliveryAt, now)}${formatTime12(s.outForDeliveryAt, { compact: false })}`,
      state: state(2),
    },
    {
      id: 'delivered',
      title: 'Delivered',
      time: status.step >= 3 ? `${dayPrefix(s.deliveredAt, now)}${formatTime(s.deliveredAt)}` : `Estimated ${formatWindow(s.windowStart, s.windowEnd, now).replace(/^Today, /, '')}`,
      state: status.step >= 3 ? 'done' : 'todo',
    },
  ];
  // When delivered, every step is done
  if (status.step >= 3) steps.forEach((st) => (st.state = 'done'));
  return steps;
}

export function orderItemCount(order) {
  return order.items.reduce((s, i) => s + i.qty, 0);
}

export function paymentLabel(payment) {
  if (!payment) return '';
  if (payment.method === 'card') return `${payment.brand} •••• ${payment.last4}`;
  if (payment.method === 'upi') return `UPI · ${payment.upiId}`;
  return 'Cash on delivery';
}
