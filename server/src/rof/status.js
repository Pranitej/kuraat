/**
 * ROF order status → what the customer sees (design 2026-11-18 §5.1). The ONLY place statuses are
 * mapped. ROF sends names on some endpoints and numbers on others (detail timeline, partner API):
 * every function here accepts either.
 *
 * Steps: 0 confirmed · 1 preparing · 2 out for delivery / ready for pickup · 3 delivered / picked up.
 * Groups feed the apps' status filter.
 */

export const STEP = { CONFIRMED: 0, PREPARING: 1, OUT_FOR_DELIVERY: 2, DELIVERED: 3 };

/** ROF's codes for customer orders (transfer statuses 20–27 are left out on purpose). */
export const STATUS_CODES = {
  0: 'Created',
  1: 'AwaitingLocation',
  2: 'SharedLocationManually',
  3: 'AssignedToBranch',
  4: 'NotAvailable',
  5: 'Preparing',
  6: 'Prepared',
  7: 'AssignedToTechnician',
  8: 'TechnicianAccepted',
  9: 'PickUpByTechnician',
  10: 'OutForDelivery',
  11: 'Delivered',
  12: 'Canceled',
  13: 'AssignedToAdmin',
  14: 'LocationNotSharedByCustomer',
  15: 'ReAssignedToTechnician',
  16: 'DeliveredWithoutOtp',
  17: 'PickUpByCustomer',
  18: 'BranchAccepted',
  19: 'ActionRequired',
};

const row = (step, label, group, pickup) => ({ step, label, group, pickup });

const BY_NAME = {
  Created: row(0, 'Order placed', 'placed'),
  AwaitingLocation: row(0, 'Confirming your location', 'placed'),
  SharedLocationManually: row(0, 'Location received', 'placed'),
  AssignedToBranch: row(0, 'Sent to branch', 'placed'),
  BranchAccepted: row(0, 'Branch accepted', 'placed'),
  NotAvailable: row(0, 'Checking availability', 'attention'),
  AssignedToAdmin: row(0, 'Being reviewed', 'attention'),
  LocationNotSharedByCustomer: row(0, 'Location needed', 'attention'),
  ActionRequired: row(0, 'Being reviewed', 'attention'),
  Preparing: row(1, 'Preparing', 'preparing'),
  Prepared: row(1, 'Packed, waiting for a rider', 'preparing', { step: 2, label: 'Ready for pickup', group: 'ready' }),
  AssignedToTechnician: row(1, 'Rider assigned', 'preparing'),
  TechnicianAccepted: row(1, 'Rider assigned', 'preparing'),
  ReAssignedToTechnician: row(1, 'Rider assigned', 'preparing'),
  PickUpByTechnician: row(2, 'Out for delivery', 'on_the_way'),
  OutForDelivery: row(2, 'Out for delivery', 'on_the_way'),
  Delivered: row(3, 'Delivered', 'completed'),
  DeliveredWithoutOtp: row(3, 'Delivered', 'completed'),
  PickUpByCustomer: row(3, 'Picked up', 'completed'),
  Canceled: row('cancelled', 'Cancelled', 'cancelled'),
};

/** Label and group shown for a status we do not know, from the order's last known step. */
export const FALLBACK_BY_STEP = [
  { label: 'Order placed', group: 'placed' },
  { label: 'Preparing', group: 'preparing' },
  { label: 'Out for delivery', group: 'on_the_way' },
  { label: 'Delivered', group: 'completed' },
];

const TERMINAL = new Set(['Delivered', 'DeliveredWithoutOtp', 'PickUpByCustomer', 'Canceled']);

/**
 * 5, "5" or "Preparing" → "Preparing". A number outside 0–19 (transfer codes) or a blank → null;
 * any other text is returned as it is (an unknown name, logged by the caller).
 */
export function normalizeStatus(value) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  if (!text) return null;
  if (/^\d+$/.test(text)) return STATUS_CODES[Number(text)] ?? null;
  return text;
}

/** { name, step, label, group } for a status (name or code), or null when we do not know it. */
export function statusInfo(value, fulfilment = 'delivery') {
  const name = normalizeStatus(value);
  const entry = name && Object.hasOwn(BY_NAME, name) ? BY_NAME[name] : null;
  if (!entry) return null;
  const { step, label, group } = fulfilment === 'pickup' && entry.pickup ? entry.pickup : entry;
  return { name, step, label, group };
}

/**
 * RSOF's `paymentStatus` on an order (null until a payment exists) → { code, label } for the customer. RSOF owns this
 * value, so nothing is computed from our side: a word we know gets a friendly label, any other word is shown as RSOF
 * wrote it (split into words), and a blank or numeric value shows nothing rather than a wrong label.
 */
const PAYMENT_LABELS = {
  paid: 'Paid',
  pending: 'Payment pending',
  unpaid: 'Payment pending',
  awaitingpayment: 'Payment pending',
  failed: 'Payment failed',
  declined: 'Payment failed',
  cancelled: 'Payment cancelled',
  canceled: 'Payment cancelled',
  expired: 'Payment expired',
  refunded: 'Refunded',
  partiallypaid: 'Partly paid',
  partiallyrefunded: 'Partly refunded',
};
export function paymentStatusInfo(value) {
  const code = value === null || value === undefined ? '' : String(value).trim();
  if (!code || /^\d+$/.test(code)) return null;
  const known = PAYMENT_LABELS[code.toLowerCase().replace(/[^a-z]/g, '')];
  if (known) return { code, label: known };
  const words = code.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').trim().toLowerCase();
  return { code, label: words.charAt(0).toUpperCase() + words.slice(1) };
}

/** 0–3, 'cancelled', or null for a status we do not know (e.g. transfer statuses 20–27). */
export const stepOf = (value, fulfilment = 'delivery') => statusInfo(value, fulfilment)?.step ?? null;

export const isTerminal = (value) => TERMINAL.has(normalizeStatus(value));

/** Customers may cancel only before the branch starts preparing (agreed default, spec §6.8). */
export const canCancel = (value) => stepOf(value) === STEP.CONFIRMED;

/** ROF resends the delivery code only while the order is OutForDelivery (guide §9.5). */
export const canResendCode = (value) => normalizeStatus(value) === 'OutForDelivery';

/**
 * When each step was reached: the first timeline row (oldest first) whose status belongs to it.
 * @param {{ status: string|number, at: string }[]} timeline
 */
export function stepTimes(timeline = [], fulfilment = 'delivery') {
  const times = {};
  for (const r of timeline) {
    const step = stepOf(r.status, fulfilment);
    if (step !== null && times[step] === undefined) times[step] = r.at;
  }
  return times;
}
