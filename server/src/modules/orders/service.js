/**
 * Orders after placement: list, detail, live status from ROF, cancel, delivery-code resend
 * (design spec §6.8; guide §8 option A, §9, §12 polling).
 *
 * ROF is the source of truth for status; our row caches the last known status, step and step times
 * so lists and notifications work even while ROF is unreachable.
 */
import { conflict, notFound, tooManyRequests } from '../../http/errors.js';
import { toOrderSnapshot, toTimeline } from '../../rof/adapter.js';
import { isRofError } from '../../rof/errors.js';
import { canCancel, canResendCode, stepOf, stepTimes } from '../../rof/status.js';
import { notify } from '../notifications/service.js';
import { presentOrder } from './present.js';

const RESEND_SECONDS = 60;
const sar = (n) => `SAR ${Number(n).toFixed(2)}`;

function cancellationBody(payment) {
  if (!payment || payment.method === 'cod') return 'Your order was cancelled.';
  // Cards only today; "your original payment method" covers payments made before UPI was removed.
  const via = payment.method === 'card' ? `${payment.brand} •••• ${payment.last4}` : 'your original payment method';
  return `Your order was cancelled. ${sar(payment.amount)} will be refunded to ${via}.`;
}

/** ROF never refunds (guide §9.4): our backend does — simulated in UAT. */
async function refundFor(trx, payment, now) {
  if (!payment || !['captured', 'authorized'].includes(payment.status)) return;
  await trx('payments').where({ id: payment.id }).update({ status: payment.method === 'cod' ? 'voided' : 'refunded', updated_at: now });
}

export function createOrdersService(ctx) {
  const findRow = (userId, id) => ctx.db('orders').where({ user_id: userId, id }).first();
  const paymentFor = (orderId) => ctx.db('payments').where({ order_id: orderId }).first();
  // Photo links saved in orders point at ROF_BASE_URL; the apps load them from the media base.
  const media = { from: ctx.config.rof.baseUrl, to: ctx.config.rof.mediaBaseUrl };

  async function present(row) {
    const payment = await paymentFor(row.id);
    const branch = row.branch_id ? await ctx.branches.getBranch(row.branch_id).catch(() => null) : null;
    return presentOrder(row, { payment, branch, media });
  }

  /** Re-reads ROF unless the row was synced less than maxAgeMs ago. Never throws for ROF errors. */
  async function refresh(row, { maxAgeMs = 0 } = {}) {
    const now = ctx.clock.now();
    if (row.last_synced_at && now.getTime() - new Date(row.last_synced_at).getTime() < maxAgeMs) return row;
    let snapshot;
    let timeline;
    try {
      [snapshot, timeline] = await Promise.all([
        ctx.rof.getOrder(row.rof_order_id).then(toOrderSnapshot),
        ctx.rof.getOrderTimeline(row.rof_order_id).then(toTimeline),
      ]);
    } catch (error) {
      if (!isRofError(error)) throw error;
      ctx.logger.warn(`[orders] could not refresh KR-${row.rof_order_number} from ROF (${error.kind}): ${error.message}`);
      return row;
    }

    const step = stepOf(snapshot.status);
    if (step === null) ctx.logger.warn(`[orders] KR-${row.rof_order_number} has unknown ROF status ${snapshot.status}; keeping step ${row.step}`);
    const number = `KR-${row.rof_order_number}`;
    const link = { kind: 'order', id: row.id };

    // Lock the row: the poller, an open tracking screen and a cancel can refresh the same order at
    // once; deciding notifications on the locked row sends each one exactly once.
    return ctx.db.transaction(async (trx) => {
      const current = await trx('orders').where({ id: row.id }).forUpdate().first();
      const cancelled = Boolean(current.cancelled) || step === 'cancelled';
      const numericStep = typeof step === 'number' ? step : current.step;
      const times = { ...(current.step_times || {}), ...stepTimes(timeline) };
      const changes = {
        rof_status: snapshot.status,
        rof_status_at: snapshot.status !== current.rof_status ? now : current.rof_status_at,
        step: numericStep,
        cancelled,
        cancelled_at: cancelled ? current.cancelled_at || (times.cancelled ? new Date(times.cancelled) : now) : null,
        branch_id: snapshot.branchId ?? current.branch_id,
        branch_name: snapshot.branchName ?? current.branch_name,
        step_times: times,
        last_synced_at: now,
        updated_at: now,
      };

      // One notification per milestone; a jump straight to Delivered skips "on its way".
      const notified = [...(current.notified || [])];
      const due = [];
      if (cancelled && !notified.includes('cancelled')) due.push('cancelled');
      if (!cancelled && numericStep === 3 && !notified.includes('delivered')) due.push('delivered');
      if (!cancelled && numericStep === 2 && !notified.includes('out_for_delivery')) due.push('out_for_delivery');
      if (due.includes('delivered') && !notified.includes('out_for_delivery')) notified.push('out_for_delivery');
      notified.push(...due);

      const branchName = changes.branch_name || 'the branch';
      await trx('orders')
        .where({ id: row.id })
        .update({ ...changes, step_times: JSON.stringify(times), notified: JSON.stringify(notified) });
      for (const type of due) {
        if (type === 'out_for_delivery') {
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

  async function mine(userId, id) {
    const row = await findRow(userId, id);
    if (!row) throw notFound('not_found', 'We could not find this order.');
    return row;
  }

  return {
    refresh,
    present,

    /** tab: ongoing (not delivered, not cancelled) · delivered (step 3) · all. Newest first. */
    async list(userId, tab = 'all') {
      const rows = await ctx.db('orders')
        .where({ user_id: userId })
        .orderBy([
          { column: 'created_at', order: 'desc' },
          { column: 'id', order: 'desc' },
        ])
        .limit(100);
      const fresh = await Promise.all(rows.map((r) => (!r.cancelled && (r.step ?? 0) < 3 ? refresh(r, { maxAgeMs: 30_000 }) : r)));
      const shown = fresh.filter((r) => {
        if (tab === 'ongoing') return !r.cancelled && (r.step ?? 0) < 3;
        if (tab === 'delivered') return !r.cancelled && r.step === 3;
        return true;
      });
      const payments = shown.length ? await ctx.db('payments').whereIn('order_id', shown.map((r) => r.id)) : [];
      return shown.map((r) => presentOrder(r, { payment: payments.find((p) => p.order_id === r.id), media }));
    },

    async get(userId, id) {
      return present(await refresh(await mine(userId, id), { maxAgeMs: 15_000 }));
    },

    async cancel(userId, id) {
      const row = await refresh(await mine(userId, id));
      if (row.cancelled || !canCancel(row.rof_status)) throw conflict('cannot_cancel', 'This order can no longer be cancelled.');
      try {
        await ctx.rof.cancelOrder(row.rof_order_id);
      } catch (error) {
        if (isRofError(error, 'rejected')) throw conflict('cannot_cancel', error.message);
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
      return present(await findRow(userId, id));
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
        if (isRofError(error, 'rejected')) throw conflict('cannot_resend', error.message);
        throw error;
      }
      await ctx.db('orders').where({ id: row.id }).update({ code_resent_at: now, updated_at: now });
      return { sent: true, resendAt: new Date(now.getTime() + RESEND_SECONDS * 1000).toISOString() };
    },
  };
}
