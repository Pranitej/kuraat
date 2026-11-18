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

const GROUP_BY_STEP = ['placed', 'preparing', 'on_the_way', 'completed'];

/**
 * { id, label, group, step, cancelled, ongoing, tone } — tone for the status tag (dark · light ·
 * alert). The server sends the label and filter group (server/src/rof/status.js); a copy kept from
 * an older reply has no group, so it is worked out from the step.
 */
export function orderStatusView(order) {
  const { id, label, step = 0, cancelled = false } = order.status;
  const group = order.status.group || (cancelled ? 'cancelled' : GROUP_BY_STEP[step] || 'placed');
  const tone = cancelled || group === 'attention' ? 'alert' : step >= 3 ? 'light' : 'dark';
  return { id, label, group, step, cancelled, ongoing: !cancelled && step < 3, tone };
}

/** Orders from before pickup existed have no fulfilment: they are deliveries. */
export const isPickup = (order) => order?.fulfilment === 'pickup';

/** Branch pickup copy (design 2026-11-18 §5.3), shared by the web and the app. */
export const PICKUP = {
  switchLabel: 'How would you like your order?',
  delivery: 'Delivery',
  pickup: 'Branch pickup',
  note: 'Collect your order from the branch we confirm after you order — usually the nearest one with your items. Show your order number at the counter.',
  phoneLabel: 'Phone number for this order',
  phoneHelper: 'We use it to reach you about your pickup.',
  likely: 'Likely pickup branch',
  payNow: 'Pay now',
  payNowSub: 'Credit / debit card · Visa, Mastercard, Mada',
  payAtBranch: 'Pay at branch',
  payAtBranchSub: 'Pay when you collect your order',
  payAtBranchHint: (total) => `Please pay ${total} at the pickup counter when you collect your order.`,
  counterTitle: 'Show this at the pickup counter',
  /** The counter searches by RSOF's plain order number (no "KR-"), by phone, or by approval number. */
  counterHelp: (number) => `Staff can find it by the number ${String(number).replace(/^KR-/i, '')} or your phone number.`,
  confirmedLead: 'Pick up your order from',
  confirmedNote: 'Chosen near you. Stock is confirmed by the branch.',
  pickupFrom: 'Pick up from',
  pickedUpFrom: 'Picked up from',
  collectFrom: 'Collect from',
  confirmedCardLabel: 'Pickup',
  paidLater: (total) => `Pay ${total} at the branch when you collect your order`,
};

/**
 * ROF assigns the branch after the order is placed (design 2026-11-18 §5.2). Until then the order
 * screens show this in the places the branch normally goes (same components, DESIGN_SYSTEM rule 12).
 */
export const PENDING_BRANCH = {
  title: 'Branch being confirmed',
  body: 'We send your order to the nearest branch with everything in stock. Its name, phone and directions appear here once it accepts.',
  popupTitle: 'The nearest branch with your items',
  popupBody: "We'll show the branch here and on the tracking screen once it accepts.",
  popupNote: 'Chosen for your delivery address. Stock is confirmed by the branch.',
  sent: 'Sent to the nearest branch',
};

/** The My orders status dropdown (design 2026-11-18 §5.4); ids are the server's filter groups. */
export const ORDER_FILTERS = [
  { id: 'all', label: 'All orders' },
  { id: 'placed', label: 'Placed' },
  { id: 'attention', label: 'Needs attention' },
  { id: 'preparing', label: 'Preparing' },
  { id: 'ready', label: 'Ready for pickup' },
  { id: 'on_the_way', label: 'On the way' },
  { id: 'completed', label: 'Completed' },
  { id: 'cancelled', label: 'Cancelled' },
];

/** Orders shown for a dropdown choice ('all' or a filter group). */
export function filterOrders(orders = [], filterId = 'all') {
  if (filterId === 'all') return orders;
  return orders.filter((o) => orderStatusView(o).group === filterId);
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
  if (payment.method === 'branch') return 'Pay at branch';
  return ''; // a method no longer offered (e.g. an old UPI test order): no label rather than a wrong one
}
