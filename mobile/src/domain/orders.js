/**
 * Order display helpers (pure) for the server's orders: status from RSOF folded into the four
 * tracking steps (+ cancelled), with real times only (no made-up estimates). Times are shown in the device time zone.
 */
import { formatDayMonth, formatSAR, formatTime, isSameDay } from './format.js';

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
  phoneHelper: 'The mobile number of your account. We use it to reach you about your pickup.',
  likely: 'Likely pickup branch',
  payNow: 'Pay now',
  payNowSub: 'Pay online on a secure payment page',
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

/** A step's real time (placed, or reached in RSOF); a step not reached yet shows none — no estimates. */
function stepTime(s, now) {
  if (!s.time || s.estimated) return '';
  return `${dayPrefix(s.time, now)}${formatTime(s.time)}`;
}

/** Rows for the tracking timeline (PDF screen 22); a cancelled order ends with "Order cancelled". */
export function orderTimelineView(order, now = new Date()) {
  const rows = order.steps.map((s) => ({ id: s.id, title: s.title, state: s.state, time: stepTime(s, now) }));
  if (!order.status.cancelled) return rows;
  const reached = rows.filter((r) => r.state !== 'todo');
  const at = order.cancelledAt;
  return [...reached, { id: 'cancelled', title: 'Order cancelled', state: 'cancelled', time: at ? `${dayPrefix(at, now)}${formatTime(at)}` : '' }];
}

/** Every status change RSOF recorded, oldest first (the full history behind "View full history"); a cancelled step stays visible even if RSOF reopens the order. */
export function orderHistoryView(order, now = new Date()) {
  return (order.history ?? []).map((h, i) => ({
    id: `${h.id}-${i}`,
    title: h.label,
    cancelled: Boolean(h.cancelled),
    note: h.note ?? '',
    time: h.time ? `${dayPrefix(h.time, now)}${formatTime(h.time)}` : '',
  }));
}

export function orderItemCount(order) {
  return order.items.reduce((s, i) => s + i.qty, 0);
}

/** Cash on delivery and pay at branch are paid later: nothing is charged when the order is placed. */
export const paidLater = (payment) => payment?.method === 'cod' || payment?.method === 'branch';

/**
 * A card order placed in the app that is not paid yet: the customer pays on RSOF's secure payment page
 * (server/README.md → Card payments). Cancelled orders are never "waiting for payment".
 */
export const awaitingPayment = (order) => order?.payment?.method === 'card' && order.payment.status === 'pending' && !order.status?.cancelled;

/** Card payment on RSOF's secure payment page (19 Nov 2026), shared by the web and the app. */
export const CARD_PAYMENT = {
  title: 'Pay online',
  subtitle: 'Choose how to pay on a secure payment page',
  unavailable: 'Online payment is not available right now',
  waitingTitle: 'Complete your payment',
  waitingBody: (total) => `Your order is placed. Pay ${total} on the secure payment page to confirm it.`,
  pay: (total) => `Pay ${total}`,
  payNow: 'Pay now',
  returnHint: "The payment page opens in a window. When you're done, we update your order for you.",
  popupHint: "Finish your payment in the payment window. This page updates when you're done.",
  check: "I've paid · Check again",
  checking: 'Checking your payment…',
  // RSOF only says "paid" or "not paid yet" — there is no separate "failed" answer.
  notYet: 'Payment not completed. If you already paid, wait a moment and tap "I\'ve paid · Check again".',
  tryAgain: 'Try again',
  viewOrders: 'View my orders',
  waitingTag: 'Waiting for payment',
  paidTitle: 'Payment received',
  paidBody: (total) => `${total} paid online`,
};

/** What the "cancel this order?" dialog says about the money. */
export function cancelRefundText(order) {
  const payment = order.payment;
  if (!payment || paidLater(payment) || payment.status === 'pending') return 'Nothing has been charged.';
  // Older payments carry the card's last digits; payments on RSOF's page do not (RSOF keeps the card).
  if (payment.last4) return `We will refund ${formatSAR(order.total)} to ${paymentLabel(payment)}.`;
  return `Your ${formatSAR(order.total)} online payment will be refunded.`;
}

export function paymentLabel(payment) {
  if (!payment) return '';
  if (payment.method === 'card' && payment.last4) return `${payment.brand} •••• ${payment.last4}`;
  if (payment.method === 'card') {
    if (payment.status === 'paid') return 'Online · Paid';
    if (payment.status === 'pending') return `Online · ${CARD_PAYMENT.waitingTag}`;
    if (payment.status === 'refund_pending') return 'Online · Refund on its way';
    if (payment.status === 'cancelled') return 'Online · Not paid';
    return 'Online payment';
  }
  if (payment.method === 'cod') return 'Cash on delivery';
  if (payment.method === 'branch') return 'Pay at branch';
  return ''; // a method no longer offered (e.g. an old UPI test order): no label rather than a wrong one
}
