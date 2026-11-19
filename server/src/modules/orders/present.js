/**
 * Order as the app sees it (design spec §6.5): our totals and payment + ROF's status and timeline,
 * folded into the four tracking steps of the design (+ a cancelled state).
 */
import { roundedDistance } from '../../lib/geo.js';
import { FALLBACK_BY_STEP, canCancel, canResendCode, paymentStatusInfo, statusInfo, stepOf, stepTimes } from '../../rof/status.js';

const DELIVERY_STEPS = [
  ['confirmed', 'Order confirmed'],
  ['preparing', 'Preparing at the branch'],
  ['out_for_delivery', 'Out for delivery'],
  ['delivered', 'Delivered'],
];
// Branch pickup (design 2026-11-18 §5.3): the third step is the order waiting at the counter.
const PICKUP_STEPS = [
  ['confirmed', 'Order confirmed'],
  ['preparing', 'Preparing at the branch'],
  ['ready_for_pickup', 'Ready for pickup'],
  ['picked_up', 'Picked up'],
];
const stepsFor = (row) => (row.fulfilment === 'pickup' ? PICKUP_STEPS : DELIVERY_STEPS);

const iso = (v) => (v ? new Date(v).toISOString() : null);

/** A photo link saved under the ROF address, served from the media address (ROF_MEDIA_BASE_URL). */
function rebase(url, media) {
  if (!url || !media?.from || !media.to || media.from === media.to) return url ?? null;
  return url.startsWith(`${media.from}/`) ? media.to + url.slice(media.from.length) : url;
}

/**
 * Each step carries only a REAL time: when the order was placed, or when RSOF's timeline reached the
 * step. A step not reached yet has no time — the old "Estimated …" times were made up by our own fixed
 * rules (RSOF sends no estimates), so they are no longer shown. `timeEnd`/`estimated` stay in the reply
 * (always null/false) so older app builds keep working.
 */
function steps(row) {
  const cancelled = Boolean(row.cancelled);
  const step = row.step ?? 0;
  const times = row.step_times || {};
  return stepsFor(row).map(([id, title], i) => {
    const reached = times[i] !== undefined || (!cancelled && step >= i);
    let state = 'todo';
    if (cancelled) state = reached ? 'done' : 'todo';
    else if (step === 3 || i < step) state = 'done';
    else if (i === step) state = 'current';
    const time = times[i] ?? (i === 0 ? iso(row.created_at) : null);
    return { id, title, state, time, timeEnd: null, estimated: false };
  });
}

/**
 * The status block the apps show and filter by: label + group from ROF's status (design 2026-11-18
 * §5.1); for a status we do not know, from the last known step. ROF names never reach the screen.
 */
function presentStatus(row) {
  const cancelled = Boolean(row.cancelled);
  const step = row.step ?? 0;
  const code = row.rof_status ?? null;
  if (cancelled) return { id: 'cancelled', code, label: 'Cancelled', group: 'cancelled', step, cancelled };
  const info = statusInfo(code, row.fulfilment ?? 'delivery');
  const { label, group } = info && info.step !== 'cancelled' ? info : FALLBACK_BY_STEP[step];
  return { id: stepsFor(row)[step][0], code, label, group, step, cancelled };
}

/**
 * How the customer pays, for the apps — never whether they have paid (online payments are RSOF's business):
 *   online    — paid on RSOF's payment page (the Orders page shows RSOF's own status)
 *   later     — cash on delivery / pay at the branch: paid when the order arrives / is collected
 *   cancelled — the order was cancelled
 */
function paymentStatus(payment) {
  if (payment.status === 'voided' || payment.status === 'refunded') return 'cancelled';
  if (payment.method === 'cod' || payment.method === 'branch') return 'later';
  return 'online';
}

function paymentView(payment) {
  if (!payment) return null;
  const status = paymentStatus(payment);
  return {
    method: payment.method,
    status,
    // Card brand and last digits exist only on older simulated payments: RSOF's payment page keeps the card.
    brand: payment.brand ?? null,
    last4: payment.last4 ?? null,
    transactionId: payment.transaction_id ?? null,
    // Only older simulated card payments have a payment time; online payments are RSOF's (we do not track them).
    paidAt: payment.last4 ? iso(payment.created_at) : null,
    // The payment page is never stored: POST /orders and POST /orders/:id/pay hand it out fresh from RSOF.
    link: null,
    linkExpiresAt: null,
  };
}

/**
 * @param {object} row       orders table row
 * @param {{ payment?: object, branch?: object|null, media?: { from: string, to: string } }} extra
 *   payments row; branch from the branch service; media = where saved photo links are served from
 */
export function presentOrder(row, { payment = null, branch = null, media = null } = {}) {
  const cancelled = Boolean(row.cancelled);
  return {
    id: row.id,
    number: `KR-${row.rof_order_number}`,
    fulfilment: row.fulfilment ?? 'delivery',
    status: presentStatus(row),
    steps: steps(row),
    items: (row.lines || []).map((l) => ({ productId: l.productId, name: l.name, qty: l.qty, price: l.price, image: rebase(l.image, media) })),
    subtotal: row.subtotal,
    total: row.total,
    payment: paymentView(payment),
    paymentStatus: null, // RSOF's payment status comes with the order read from RSOF (presentRofOrder)
    branch: branch ?? (row.branch_id ? { id: row.branch_id, name: row.branch_name } : null),
    // ROF picks the branch now (design 2026-11-18 §5.2): measure from the delivery address to it.
    distanceKm: row.distance_km ?? (branch?.location && row.address?.location ? roundedDistance(row.address.location, branch.location) : null),
    address: row.address ?? null,
    deliveryPhone: row.delivery_phone,
    window: { start: iso(row.window_start), end: iso(row.window_end) }, // nulls for pickup
    canCancel: !cancelled && canCancel(row.rof_status),
    canResendCode: !cancelled && canResendCode(row.rof_status),
    createdAt: iso(row.created_at),
    cancelledAt: iso(row.cancelled_at),
  };
}

/**
 * An order exactly as RSOF has it (adapter's toOrderDetail) in the same reply shape as presentOrder.
 * RSOF is the master of orders: nothing is calculated by us. The total is the sum of the line prices
 * RSOF stamped (there is no delivery fee, VAT or discount); payment is null until it moves to RSOF.
 * link / payment: only for an order placed in our app. RSOF has no payment yet, so what the customer paid
 * at checkout (our saved record), the address and the delivery window are added on top of RSOF's order.
 * Status, items, prices, branch and times always stay RSOF's. Such an order keeps our id so the apps see one order.
 */
export function presentRofOrder(order, { branch = null, link = null, payment = null, media = null } = {}) {
  const linked = Boolean(link);
  const step = stepOf(order.status, order.fulfilment);
  const cancelled = step === 'cancelled';
  const times = stepTimes(order.timeline, order.fulfilment);
  // The step/status helpers read a stored-row shape; RSOF's order maps onto it directly.
  const row = {
    fulfilment: order.fulfilment,
    cancelled,
    step: typeof step === 'number' ? step : 0,
    step_times: times,
    rof_status: order.status,
    created_at: order.createdAt,
  };
  // RSOF's address line usually names the city already ("…, Al Khobar 34445"): add it only when it does not.
  const city = order.city && !order.address.includes(order.city) ? order.city : null;
  const view = {
    id: order.rofOrderId,
    number: `KR-${order.orderNumber}`,
    fulfilment: order.fulfilment,
    status: presentStatus(row),
    steps: steps(row),
    // Every status CHANGE RSOF recorded, oldest first (a cancelled order that RSOF later reopens keeps its "Cancelled").
    // RSOF's free-text notes are internal (staff user names, system messages such as "the company has no active WhatsApp
    // number"): they never reach the customer, and a row that only carries a note (same status before and after, e.g. a
    // payment-link log line) is not a step. The first row (the order being placed) always stays.
    history: order.timeline
      .filter((r, i) => i === 0 || r.from == null || r.from !== r.status)
      .map((r) => ({ r, info: statusInfo(r.status, order.fulfilment) }))
      .filter(({ info }) => info)
      .map(({ r, info }) => ({ id: info.name, label: info.label, group: info.group, cancelled: info.step === 'cancelled', time: iso(r.at), note: null })),
    items: order.lines.map((l) => ({ productId: l.productId, name: l.name, qty: l.qty, price: l.price, image: null })),
    subtotal: order.total,
    total: order.total,
    payment: null,
    // RSOF's own payment status (e.g. Paid / Payment pending / Payment failed), shown as is: RSOF handles the payment.
    paymentStatus: paymentStatusInfo(order.paymentStatus),
    branch: branch ?? (order.branchId ? { id: order.branchId, name: order.branchName } : null),
    distanceKm: null,
    address: order.fulfilment === 'pickup' ? null : { line: order.address, district: null, city, postcode: null, location: null },
    deliveryPhone: order.phone ? `+${order.phone}` : null,
    window: { start: null, end: null },
    canCancel: linked && !cancelled && canCancel(order.status),
    canResendCode: linked && !cancelled && canResendCode(order.status),
    createdAt: iso(order.createdAt),
    cancelledAt: iso(times.cancelled),
  };
  if (!link) return view;
  const saved = link.lines || [];
  return {
    ...view,
    id: link.id,
    items: view.items.map((i) => ({ ...i, image: rebase(saved.find((l) => l.productId === i.productId)?.image, media) })),
    payment: paymentView(payment),
    address: link.address ?? view.address,
    distanceKm: link.distance_km ?? (branch?.location && link.address?.location ? roundedDistance(link.address.location, branch.location) : null),
    deliveryPhone: link.delivery_phone ?? view.deliveryPhone,
    window: { start: iso(link.window_start), end: iso(link.window_end) },
  };
}
