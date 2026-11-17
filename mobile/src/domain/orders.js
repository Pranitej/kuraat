/**
 * Order display helpers (pure) for the server's orders: status from RSOF folded into the four
 * tracking steps (+ cancelled), with real or estimated times. Times are shown in Saudi time.
 */
import { formatDayMonth, formatTime, formatTime12, formatWindow, isSameDay } from './format.js';

const DAY_MS = 24 * 3600 * 1000;

/** '' for today, 'Tomorrow, ' or '8 Nov, ' otherwise. */
function dayPrefix(value, now) {
  if (isSameDay(value, now)) return '';
  return isSameDay(value, new Date(new Date(now).getTime() + DAY_MS)) ? 'Tomorrow, ' : `${formatDayMonth(value)}, `;
}

/** { id, label, step, cancelled, ongoing, tone } — tone for the status tag (dark · light · alert). */
export function orderStatusView(order) {
  const { id, label, step = 0, cancelled = false } = order.status;
  return { id, label, step, cancelled, ongoing: !cancelled && step < 3, tone: cancelled ? 'alert' : step >= 3 ? 'light' : 'dark' };
}

function stepTime(s, now) {
  if (!s.time) return '';
  const prefix = dayPrefix(s.time, now);
  if (!s.estimated) return `${prefix}${formatTime(s.time)}`;
  if (s.id === 'delivered' && s.timeEnd) return `Estimated ${formatWindow(s.time, s.timeEnd, now).replace(/^Today, /, '')}`;
  if (s.id === 'out_for_delivery') return `Estimated ${prefix}${formatTime12(s.time, { compact: false })}`;
  return `Estimated ${prefix}${formatTime(s.time)}`;
}

/** Rows for the tracking timeline (PDF screen 22); a cancelled order ends with "Order cancelled". */
export function orderTimelineView(order, now = new Date()) {
  const rows = order.steps.map((s) => ({ id: s.id, title: s.title, state: s.state, time: stepTime(s, now) }));
  if (!order.status.cancelled) return rows;
  const reached = rows.filter((r) => r.state !== 'todo');
  const at = order.cancelledAt;
  return [...reached, { id: 'cancelled', title: 'Order cancelled', state: 'cancelled', time: at ? `${dayPrefix(at, now)}${formatTime(at)}` : '' }];
}

export function orderItemCount(order) {
  return order.items.reduce((s, i) => s + i.qty, 0);
}

export function paymentLabel(payment) {
  if (!payment) return '';
  if (payment.method === 'card') return `${payment.brand} •••• ${payment.last4}`;
  if (payment.method === 'cod') return 'Cash on delivery';
  return ''; // a method no longer offered (e.g. an old UPI test order): no label rather than a wrong one
}
