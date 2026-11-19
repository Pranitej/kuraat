/**
 * Orders after placement: list, detail, live status from ROF, cancel, delivery-code resend
 * (design spec §6.8; guide §8 option A, §9, §12 polling).
 *
 * ROF is the source of truth for status; our row caches the last known status, step and step times
 * so lists and notifications work even while ROF is unreachable.
 */
import { conflict, notFound, tooManyRequests } from '../../http/errors.js';
import { toOrderDetail, toOrderSnapshot, toPhoneOrderIds, toRofPhone, toTimeline } from '../../rof/adapter.js';
import { isRofError } from '../../rof/errors.js';
import { canCancel, canResendCode, stepOf, stepTimes } from '../../rof/status.js';
import { notify } from '../notifications/service.js';
import { presentOrder, presentRofOrder } from './present.js';

const RESEND_SECONDS = 60;
const DETAIL_CACHE_MAX = 2000;
const LIST_CONCURRENCY = 5;
const sar = (n) => `SAR ${Number(n).toFixed(2)}`;

const paidLater = (payment) => payment.method === 'cod' || payment.method === 'branch';

/**
 * The "cancelled" notification. Online payments are RSOF's business (it holds the money and knows whether the
 * customer paid), so the message promises nothing about the money beyond "the store handles your refund".
 */
function cancellationBody(payment) {
  // Cash on delivery and pay-at-the-branch were never charged: nothing to refund.
  if (!payment || paidLater(payment)) return 'Your order was cancelled.';
  // Older simulated card payments (before 19 Nov 2026) carry the card's last digits; "your original payment method"
  // covers old UPI test orders.
  if (payment.last4) return `Your order was cancelled. ${sar(payment.amount)} will be refunded to ${payment.brand} •••• ${payment.last4}.`;
  return 'Your order was cancelled. If you already paid online, the store will handle your refund.';
}

/** The payment record of a cancelled order: voided (an old simulated card payment: refunded, it was never real money). */
async function refundFor(trx, payment, now) {
  if (!payment || !['captured', 'authorized', 'pending'].includes(payment.status)) return;
  const status = !paidLater(payment) && payment.last4 ? 'refunded' : 'voided';
  await trx('payments').where({ id: payment.id }).update({ status, updated_at: now });
}

export function createOrdersService(ctx) {
  // Our record of an order placed in the app is only a pointer (who placed it, its RSOF order id and what
  // we charged). The apps name an order by its RSOF id; older links and the checkout screens use ours.
  const findRow = (userId, id) =>
    ctx.db('orders').where({ user_id: userId }).andWhere((q) => q.where({ id }).orWhere({ rof_order_id: id })).first();
  const paymentFor = (orderId) => ctx.db('payments').where({ order_id: orderId }).first();
  // Photo links saved in orders point at ROF_BASE_URL; the apps load them from the media base.
  const media = { from: ctx.config.rof.baseUrl, to: ctx.config.rof.mediaBaseUrl };

  async function present(row) {
    const payment = await paymentFor(row.id);
    const branch = row.branch_id ? await ctx.branches.getBranch(row.branch_id).catch(() => null) : null;
    return presentOrder(row, { payment, branch, media });
  }

  // One RSOF read per order at a time: the tracking screen, the orders list, the poller and a second
  // tab often ask for the same order at the same moment — they share the read instead of each paying
  // two RSOF calls. Each caller still handles errors and saves the result itself.
  const reading = new Map(); // order id → Promise<[snapshot, timeline]>
  function readFromRof(row) {
    let pending = reading.get(row.id);
    if (!pending) {
      pending = Promise.all([
        ctx.rof.getOrder(row.rof_order_id).then(toOrderSnapshot),
        ctx.rof.getOrderTimeline(row.rof_order_id).then(toTimeline),
      ]).finally(() => reading.delete(row.id));
      reading.set(row.id, pending);
    }
    return pending;
  }

  /**
   * The orders page reads RSOF only (RSOF is the master of orders). Every order is re-read once it is
   * older than the caller allows, delivered and cancelled ones too: RSOF staff can change a status after
   * the fact (e.g. cancelled → preparing) and the page must follow. Same-moment reads share one RSOF call.
   */
  const details = new Map(); // rof order id → { at, order }
  const readingDetail = new Map(); // rof order id → Promise<order>
  const phoneLists = new Map(); // rof phone → { at, ids }
  const readingPhone = new Map(); // rof phone → Promise<ids>

  function readOrder(rofId, maxAgeMs) {
    const cached = details.get(rofId);
    if (cached && ctx.clock.now().getTime() - cached.at < maxAgeMs) return Promise.resolve(cached.order);
    let pending = readingDetail.get(rofId);
    if (!pending) {
      pending = ctx.rof
        .getOrder(rofId)
        .then(toOrderDetail)
        .then((order) => {
          if (order.rawStatus !== null) {
            ctx.logger.warn(`[orders] KR-${order.orderNumber} has unknown ROF status ${JSON.stringify(order.rawStatus)}; showing its last known status`);
          }
          if (details.size >= DETAIL_CACHE_MAX) details.delete(details.keys().next().value);
          details.set(rofId, { at: ctx.clock.now().getTime(), order });
          return order;
        })
        .finally(() => readingDetail.delete(rofId));
      readingDetail.set(rofId, pending);
    }
    return pending;
  }

  function readPhoneOrderIds(phone, maxAgeMs) {
    const cached = phoneLists.get(phone);
    if (cached && ctx.clock.now().getTime() - cached.at < maxAgeMs) return Promise.resolve(cached.ids);
    let pending = readingPhone.get(phone);
    if (!pending) {
      pending = ctx.rof
        .listOrdersByPhone(phone)
        .then(toPhoneOrderIds)
        .then((ids) => {
          phoneLists.set(phone, { at: ctx.clock.now().getTime(), ids });
          return ids;
        })
        .finally(() => readingPhone.delete(phone));
      readingPhone.set(phone, pending);
    }
    return pending;
  }

  /** The customer's mobile number in RSOF's format (country code, no "+"): the account's number. */
  async function rofPhoneOf(userId) {
    const user = await ctx.db('users').where({ id: userId }).first();
    return user?.phone ? toRofPhone(user.phone) : null;
  }

  /** A few RSOF reads at a time, in order. An order RSOF no longer knows is skipped; any other failure stops the page. */
  async function readOrders(ids, maxAgeMs) {
    const found = new Array(ids.length).fill(null);
    let next = 0;
    async function worker() {
      while (next < ids.length) {
        const at = next++;
        try {
          found[at] = await readOrder(ids[at], maxAgeMs);
        } catch (error) {
          if (!isRofError(error, 'rejected')) throw error;
          ctx.logger.warn(`[orders] RSOF would not return order ${ids[at]}: ${error.message}`);
        }
      }
    }
    await Promise.all(Array.from({ length: Math.min(LIST_CONCURRENCY, ids.length) }, worker));
    return found.filter(Boolean);
  }

  /** One order for the apps, from RSOF. An order we hold no record of must carry the customer's own number. */
  async function view(userId, id, maxAgeMs) {
    const link = await findRow(userId, id);
    let order;
    try {
      order = await readOrder(link?.rof_order_id ?? id, maxAgeMs);
    } catch (error) {
      if (isRofError(error, 'rejected')) throw notFound('not_found', 'We could not find this order.');
      throw error;
    }
    if (!link && order.phone !== (await rofPhoneOf(userId))) throw notFound('not_found', 'We could not find this order.');
    const branch = order.branchId ? await ctx.branches.getBranch(order.branchId).catch(() => null) : null;
    return presentRofOrder(order, { branch, link, payment: link ? await paymentFor(link.id) : null, media });
  }

  /**
   * Re-reads ROF unless the row was synced less than maxAgeMs ago. ROF errors keep the last known
   * row — except for the refresh button (failIfUnavailable), which must say RSOF could not be reached.
   */
  async function refresh(row, { maxAgeMs = 0, failIfUnavailable = false } = {}) {
    const now = ctx.clock.now();
    if (row.last_synced_at && now.getTime() - new Date(row.last_synced_at).getTime() < maxAgeMs) return row;
    let snapshot;
    let timeline;
    try {
      [snapshot, timeline] = await readFromRof(row);
    } catch (error) {
      if (!isRofError(error)) throw error;
      ctx.logger.warn(`[orders] could not refresh KR-${row.rof_order_number} from ROF (${error.kind}): ${error.message}`);
      if (failIfUnavailable && error.kind !== 'rejected') throw error;
      return row;
    }

    const step = stepOf(snapshot.status, row.fulfilment ?? 'delivery');
    if (step === null) {
      ctx.logger.warn(`[orders] KR-${row.rof_order_number} has unknown ROF status ${JSON.stringify(snapshot.rawStatus)}; keeping step ${row.step}`);
    }
    const number = `KR-${row.rof_order_number}`;
    const link = { kind: 'order', id: row.id };

    // Lock the row: the poller, an open tracking screen and a cancel can refresh the same order at
    // once; deciding notifications on the locked row sends each one exactly once.
    return ctx.db.transaction(async (trx) => {
      const current = await trx('orders').where({ id: row.id }).forUpdate().first();
      const cancelled = Boolean(current.cancelled) || step === 'cancelled';
      const numericStep = typeof step === 'number' ? step : current.step;
      const times = { ...(current.step_times || {}), ...stepTimes(timeline, row.fulfilment ?? 'delivery') };
      const changes = {
        // An unknown code or a blank status comes back as null: keep the last name we knew
        // (rof_status is NOT NULL, and "keep the last step" applies to the label too).
        rof_status: snapshot.status ?? current.rof_status,
        rof_status_at: (snapshot.status ?? current.rof_status) !== current.rof_status ? now : current.rof_status_at,
        step: numericStep,
        cancelled,
        cancelled_at: cancelled ? current.cancelled_at || (times.cancelled ? new Date(times.cancelled) : now) : null,
        branch_id: snapshot.branchId ?? current.branch_id,
        branch_name: snapshot.branchName ?? current.branch_name,
        step_times: times,
        last_synced_at: now,
        updated_at: now,
      };

      // One notification per milestone; a jump straight to the end skips the middle one. A pickup
      // order is "ready for pickup" and "picked up" — it never has a courier.
      const pickup = current.fulfilment === 'pickup';
      const middle = pickup ? 'ready_for_pickup' : 'out_for_delivery';
      const last = pickup ? 'picked_up' : 'delivered';
      const notified = [...(current.notified || [])];
      const due = [];
      if (cancelled && !notified.includes('cancelled')) due.push('cancelled');
      if (!cancelled && numericStep === 3 && !notified.includes(last)) due.push(last);
      if (!cancelled && numericStep === 2 && !notified.includes(middle)) due.push(middle);
      if (due.includes(last) && !notified.includes(middle)) notified.push(middle);
      notified.push(...due);

      const branchName = changes.branch_name || 'the branch';
      await trx('orders')
        .where({ id: row.id })
        .update({ ...changes, step_times: JSON.stringify(times), notified: JSON.stringify(notified) });
      for (const type of due) {
        if (type === 'ready_for_pickup') {
          await notify(trx, row.user_id, { type, title: `Order #${number} is ready for pickup`, body: `Collect it from ${branchName}.`, link }, now);
        } else if (type === 'picked_up') {
          await notify(trx, row.user_id, { type, title: `Order #${number} picked up`, body: `Picked up from ${branchName}. Enjoy!`, link }, now);
        } else if (type === 'out_for_delivery') {
          await notify(trx, row.user_id, { type, title: `Order #${number} is on its way`, body: `Your courier has left ${branchName}.`, link }, now);
        } else if (type === 'delivered') {
          await notify(trx, row.user_id, { type, title: `Order #${number} delivered`, body: `Delivered from ${branchName}. Enjoy!`, link }, now);
        } else {
          const payment = await trx('payments').where({ order_id: row.id }).first();
          await refundFor(trx, payment, now);
          await notify(trx, row.user_id, { type, title: `Order #${number} cancelled`, body: cancellationBody(payment), link }, now);
        }
      }
      return { ...current, ...changes, notified };
    });
  }

  // The refresh button (design 2026-11-18 §5.4): a forced ROF re-read at most once per 10 s per
  // customer; presses in between are answered from the usual cache.
  const FORCE_EVERY_MS = 10_000;
  const forcedAt = new Map();
  function maxAge(userId, refreshAsked, usualMs) {
    if (!refreshAsked) return usualMs;
    const now = ctx.clock.now().getTime();
    const last = forcedAt.get(userId);
    if (last !== undefined && now - last < FORCE_EVERY_MS) return usualMs;
    forcedAt.set(userId, now);
    return 0;
  }

  /** A forced refresh that fails gives the customer's 10 s slot back, so "Try again" really tries. */
  async function whileForced(userId, forced, work) {
    try {
      return await work();
    } catch (error) {
      if (forced) forcedAt.delete(userId);
      throw error;
    }
  }

  async function mine(userId, id) {
    const row = await findRow(userId, id);
    if (!row) throw notFound('not_found', 'We could not find this order.');
    return row;
  }

  return {
    refresh,
    present,

    /**
     * Every order of the customer's mobile number, from RSOF (placed in the apps, on WhatsApp or by RSOF
     * staff), newest first. tab: ongoing (not delivered, not cancelled) · delivered · all.
     * refresh: re-read RSOF now (throttled), not within the 30 s cache.
     */
    async list(userId, tab = 'all', { refresh: refreshAsked = false } = {}) {
      const phone = await rofPhoneOf(userId);
      if (!phone) return [];
      const maxAgeMs = maxAge(userId, refreshAsked, 30_000);
      const forced = refreshAsked && maxAgeMs === 0;
      const orders = await whileForced(userId, forced, async () => readOrders(await readPhoneOrderIds(phone, maxAgeMs), maxAgeMs));
      // RSOF matches a number loosely (its last digits): show only orders that carry exactly this number.
      const shown = orders
        .filter((o) => o.phone === phone)
        .filter((o) => {
          const step = stepOf(o.status, o.fulfilment);
          if (tab === 'ongoing') return step !== 'cancelled' && step !== 3;
          if (tab === 'delivered') return step === 3;
          return true;
        })
        .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
      // Orders placed in our app also have our checkout record (what was charged); RSOF has none of that.
      const links = shown.length ? await ctx.db('orders').where({ user_id: userId }).whereIn('rof_order_id', shown.map((o) => o.rofOrderId)) : [];
      const payments = links.length ? await ctx.db('payments').whereIn('order_id', links.map((r) => r.id)) : [];
      return shown.map((o) => {
        const link = links.find((r) => r.rof_order_id === o.rofOrderId) ?? null;
        return presentRofOrder(o, { link, payment: link ? payments.find((p) => p.order_id === link.id) : null, media });
      });
    },

    // Always RSOF's current word (within the short cache): staff may change any status, even a finished one.
    async get(userId, id, { refresh: refreshAsked = false } = {}) {
      const maxAgeMs = maxAge(userId, refreshAsked, 15_000);
      return whileForced(userId, refreshAsked && maxAgeMs === 0, () => view(userId, id, maxAgeMs));
    },

    async cancel(userId, id) {
      const row = await refresh(await mine(userId, id));
      if (row.cancelled || !canCancel(row.rof_status)) throw conflict('cannot_cancel', 'This order can no longer be cancelled.');
      try {
        await ctx.rof.cancelOrder(row.rof_order_id);
      } catch (error) {
        if (isRofError(error, 'rejected')) {
          ctx.logger.warn(`[orders] RSOF refused to cancel KR-${row.rof_order_number}: ${error.message}`);
          throw conflict('cannot_cancel', 'This order can no longer be cancelled.');
        }
        throw error;
      }
      const now = ctx.clock.now();
      await ctx.db.transaction(async (trx) => {
        // A concurrent refresh may already have recorded this cancellation (and refunded).
        const current = await trx('orders').where({ id: row.id }).forUpdate().first();
        if ((current.notified || []).includes('cancelled')) return;
        const notified = [...(current.notified || []), 'cancelled'];
        const payment = await trx('payments').where({ order_id: row.id }).first();
        await refundFor(trx, payment, now);
        await trx('orders')
          .where({ id: row.id })
          .update({
            cancelled: true,
            cancelled_at: now,
            rof_status: 'Canceled',
            rof_status_at: now,
            step_times: JSON.stringify({ ...(current.step_times || {}), cancelled: now.toISOString() }),
            notified: JSON.stringify(notified),
            updated_at: now,
          });
        await notify(
          trx,
          row.user_id,
          { type: 'cancelled', title: `Order #KR-${row.rof_order_number} cancelled`, body: cancellationBody(payment), link: { kind: 'order', id: row.id } },
          now,
        );
      });
      return view(userId, id, 0);
    },

    async resendCode(userId, id) {
      const row = await refresh(await mine(userId, id));
      if (row.cancelled || !canResendCode(row.rof_status)) {
        throw conflict('cannot_resend', 'The delivery code can be resent only while your order is out for delivery.');
      }
      const now = ctx.clock.now();
      const wait = row.code_resent_at ? new Date(row.code_resent_at).getTime() + RESEND_SECONDS * 1000 - now.getTime() : 0;
      if (wait > 0) throw tooManyRequests('resend_too_soon', `You can resend the code in ${Math.ceil(wait / 1000)} seconds.`);
      try {
        await ctx.rof.resendDeliveryOtp(row.rof_order_id);
      } catch (error) {
        if (isRofError(error, 'rejected')) {
          ctx.logger.warn(`[orders] RSOF refused to resend the code of KR-${row.rof_order_number}: ${error.message}`);
          throw conflict('cannot_resend', 'The delivery code can be resent only while your order is out for delivery.');
        }
        throw error;
      }
      await ctx.db('orders').where({ id: row.id }).update({ code_resent_at: now, updated_at: now });
      return { sent: true, resendAt: new Date(now.getTime() + RESEND_SECONDS * 1000).toISOString() };
    },
  };
}
