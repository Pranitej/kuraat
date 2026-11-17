/**
 * Order as the app sees it (design spec §6.5): our totals and payment + ROF's status and timeline,
 * folded into the four tracking steps of the design (+ a cancelled state).
 */
import { FALLBACK_BY_STEP, canCancel, canResendCode, statusInfo } from '../../rof/status.js';

const STEPS = [
  ['confirmed', 'Order confirmed'],
  ['preparing', 'Preparing at the branch'],
  ['out_for_delivery', 'Out for delivery'],
  ['delivered', 'Delivered'],
];

const iso = (v) => (v ? new Date(v).toISOString() : null);

/** A photo link saved under the ROF address, served from the media address (ROF_MEDIA_BASE_URL). */
function rebase(url, media) {
  if (!url || !media?.from || !media.to || media.from === media.to) return url ?? null;
  return url.startsWith(`${media.from}/`) ? media.to + url.slice(media.from.length) : url;
}

function steps(row) {
  const cancelled = Boolean(row.cancelled);
  const step = row.step ?? 0;
  const times = row.step_times || {};
  const est = row.estimates || {};
  const estimates = [null, est.preparingAt, est.outForDeliveryAt, est.windowStart];
  return STEPS.map(([id, title], i) => {
    const reached = times[i] !== undefined || (!cancelled && step >= i);
    let state = 'todo';
    if (cancelled) state = reached ? 'done' : 'todo';
    else if (step === 3 || i < step) state = 'done';
    else if (i === step) state = 'current';

    let time = times[i] ?? null;
    let estimated = false;
    let timeEnd = null;
    if (!time && i === 0) time = iso(row.created_at);
    if (!time && !reached && !cancelled) {
      time = estimates[i] ?? null;
      estimated = true;
      if (i === 3) timeEnd = est.windowEnd ?? null;
    }
    return { id, title, state, time, timeEnd, estimated };
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
  return { id: STEPS[step][0], code, label, group, step, cancelled };
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
    status: presentStatus(row),
    steps: steps(row),
    items: (row.lines || []).map((l) => ({ productId: l.productId, name: l.name, qty: l.qty, price: l.price, image: rebase(l.image, media) })),
    subtotal: row.subtotal,
    discount: row.discount,
    deliveryFee: row.delivery_fee,
    vat: row.vat,
    total: row.total,
    promoCode: row.promo_code ?? null,
    payment: payment
      ? {
          method: payment.method,
          brand: payment.brand ?? null,
          last4: payment.last4 ?? null,
          transactionId: payment.transaction_id ?? null,
          // Cash is paid at the door, so there is no payment time yet.
          paidAt: payment.method === 'cod' ? null : iso(payment.created_at),
        }
      : null,
    branch: branch ?? (row.branch_id ? { id: row.branch_id, name: row.branch_name } : null),
    distanceKm: row.distance_km ?? null,
    address: row.address,
    deliveryPhone: row.delivery_phone,
    window: { start: iso(row.window_start), end: iso(row.window_end) },
    canCancel: !cancelled && canCancel(row.rof_status),
    canResendCode: !cancelled && canResendCode(row.rof_status),
    createdAt: iso(row.created_at),
    cancelledAt: iso(row.cancelled_at),
  };
}
