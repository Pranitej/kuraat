/**
 * Card payments on RSOF's payment page (19 Nov 2026). RSOF is the master of orders and now of card money too:
 *   1. the order is placed in RSOF first (the payment link needs its order number) — our payment row is "pending"
 *   2. the kuraat server asks RSOF for the payment link (create or get) and the app opens it
 *   3. the customer pays on RSOF's page; nothing comes back to us by itself (no webhook, no "paid" field on the order)
 *   4. asking again is how we learn it: RSOF answers AlreadyPaid → our row becomes "captured" with paid_at
 * Only orders placed in our app with "card" are paid this way (our payment row says what was chosen).
 */
import { conflict, notFound, unavailable } from '../../http/errors.js';
import { toPaymentLink, toRofPhone } from '../../rof/adapter.js';
import { isRofError } from '../../rof/errors.js';
import { notify } from '../notifications/service.js';

export const CARD_UNAVAILABLE = "Online payment isn't available right now. Choose cash on delivery or pay at the branch.";
const PAGE_UNAVAILABLE = "We couldn't open the payment page. Please try again in a moment.";
const NOT_READY = "Online payment isn't ready for this order yet. Please try again in a few minutes.";
const NOT_PAYABLE = "This order can't be paid online any more. Please contact us if you need help.";

// A "pending" answer is shared for a few seconds: the app asks when a screen opens and again each time the
// customer comes back from the payment page, and those often land together.
const PENDING_ANSWER_MS = 5_000;
const RECENT_MAX = 2000;
// Payment states that can still become "paid".
const OPEN = ['pending'];
// The "is card payment working?" check (see available()).
const PROBE = { orderNumber: 1, phone: '966000000000' };
const PROBE_OK_MS = 5 * 60_000;
const PROBE_FAIL_MS = 60_000;

const sar = (n) => `SAR ${Number(n).toFixed(2)}`;

export function createOnlinePayments(ctx) {
  const client = ctx.paymentLinks ?? null;
  const asking = new Map(); // payment id → Promise<answer>: same-moment asks share one RSOF call
  const recent = new Map(); // payment id → { at, answer } for "pending" answers

  /** Records "paid" once (the status condition makes it happen exactly once) and tells the customer. */
  async function markPaid(payment, order) {
    const now = ctx.clock.now();
    await ctx.db.transaction(async (trx) => {
      const changed = await trx('payments').where({ id: payment.id }).whereIn('status', OPEN).update({ status: 'captured', paid_at: now, updated_at: now });
      if (!changed) return;
      const link = { kind: 'order', id: order.id };
      await notify(trx, order.user_id, { type: 'payment', title: 'Payment received', body: `${sar(payment.amount)} paid for order #KR-${order.rof_order_number}.`, link }, now);
    });
    ctx.logger.info(`[payments] KR-${order.rof_order_number} is paid (RSOF answered AlreadyPaid)`);
  }

  /** One RSOF call → { status: 'paid' } or { status: 'pending', link, expiresAt, amount, currency }; AppError otherwise. */
  async function askRsof(payment, order) {
    if (!client) throw unavailable('payment_unavailable', CARD_UNAVAILABLE);
    const number = `KR-${order.rof_order_number}`;
    // RSOF matches the link to the order by its number AND the phone the order was created with: the account's
    // number, saved on our order row when it was placed (it cannot change, but the saved one is what RSOF has).
    const phone = order.delivery_phone || (await ctx.db('users').where({ id: order.user_id }).first())?.phone;
    if (!phone) throw conflict('not_payable', NOT_PAYABLE);
    let answer;
    try {
      answer = toPaymentLink(await client.createLink({ orderNumber: order.rof_order_number, phone: toRofPhone(phone) }), { baseUrl: ctx.config.rof.baseUrl });
    } catch (error) {
      if (!isRofError(error)) throw error;
      // RSOF's payment API is down or refuses our key: stop offering card for a minute (see available()).
      if (error.kind !== 'rejected') probe = { at: ctx.clock.now().getTime(), ok: false, pending: null };
      // A refused key is our set-up problem: loud in the log, the same calm message for the customer.
      ctx.logger[error.kind === 'auth' ? 'error' : 'warn'](`[payments] payment link for ${number} failed (${error.kind}): ${error.message}`);
      throw unavailable('payment_unavailable', PAGE_UNAVAILABLE);
    }
    switch (answer.outcome) {
      case 'AlreadyPaid':
        await markPaid(payment, order);
        return { status: 'paid' };
      case 'LinkReady':
        if (!answer.link) {
          ctx.logger.warn(`[payments] RSOF answered LinkReady for ${number} without a usable https link`);
          throw unavailable('payment_unavailable', PAGE_UNAVAILABLE);
        }
        if (answer.amount !== null && Math.abs(answer.amount - Number(payment.amount)) > 0.009) {
          // RSOF charges its own amount (it is the master); ours is what the customer saw at checkout.
          ctx.logger.warn(`[payments] RSOF asks ${answer.amount} for ${number}; the app showed ${payment.amount}`);
        }
        return { status: 'pending', link: answer.link, expiresAt: answer.expiresAt, amount: answer.amount ?? Number(payment.amount), currency: answer.currency ?? 'SAR' };
      case 'NoPayableOrder':
        ctx.logger.warn(`[payments] RSOF has no payable order for ${number} (cancelled, or the phone does not match)`);
        throw conflict('not_payable', NOT_PAYABLE);
      case 'NotReady':
        ctx.logger.warn(`[payments] RSOF says ${number} or its payment settings are not ready`);
        throw unavailable('payment_not_ready', NOT_READY);
      default: // 'Error': temporary on RSOF's side
        ctx.logger.warn(`[payments] RSOF could not make a payment link for ${number} right now`);
        throw unavailable('payment_unavailable', PAGE_UNAVAILABLE);
    }
  }

  /** The RSOF answer for one pending card payment, shared by same-moment callers and kept briefly. */
  function ask(payment, order) {
    const kept = recent.get(payment.id);
    if (kept && ctx.clock.now().getTime() - kept.at < PENDING_ANSWER_MS) return Promise.resolve(kept.answer);
    let pending = asking.get(payment.id);
    if (!pending) {
      pending = askRsof(payment, order)
        .then((answer) => {
          if (answer.status === 'pending') {
            // Bounded: the oldest answer goes first (a later ask simply asks RSOF again).
            if (recent.size >= RECENT_MAX) recent.delete(recent.keys().next().value);
            recent.set(payment.id, { at: ctx.clock.now().getTime(), answer });
          } else recent.delete(payment.id);
          return answer;
        })
        .finally(() => asking.delete(payment.id));
      asking.set(payment.id, pending);
    }
    return pending;
  }

  // Is card payment working right now? The key must be set and RSOF's payment-link API must answer with it.
  // Checked with a request that matches no order (order 1 with the phone 966000000000, which no customer has):
  // RSOF finds no payable order and creates nothing. Remembered 5 minutes when it works, 1 minute when not, so
  // a launch where RSOF's API is not live yet (UAT answered 404 on 19 Nov 2026) or the key is wrong simply shows
  // card as unavailable — instead of placing card orders nobody can pay.
  let probe = { at: Number.NEGATIVE_INFINITY, ok: false, pending: null };
  async function checkRsof() {
    try {
      const raw = await client.createLink({ orderNumber: PROBE.orderNumber, phone: PROBE.phone });
      if (raw.outcome === 'NotReady' || raw.outcome === 'Error') {
        ctx.logger.warn(`[payments] card payments are off: RSOF's payment-link API answered ${raw.outcome}`);
        return false;
      }
      return true;
    } catch (error) {
      // "rejected" = RSOF read the request with our key and refused its content: the API and the key work.
      if (isRofError(error, 'rejected')) return true;
      ctx.logger[isRofError(error, 'auth') ? 'error' : 'warn'](`[payments] card payments are off: ${error.message}`);
      return false;
    }
  }

  return {
    /** False when no payment API key is set: card orders are refused before anything is created. */
    ready: Boolean(client),

    /** Card payment can be offered now (key set and RSOF's payment-link API answering). Never throws. */
    async available() {
      if (!client) return false;
      const now = ctx.clock.now().getTime();
      if (now - probe.at < (probe.ok ? PROBE_OK_MS : PROBE_FAIL_MS)) return probe.ok;
      if (!probe.pending) {
        probe.pending = checkRsof().then((ok) => {
          if (ok && !probe.ok) ctx.logger.info('[payments] card payments are on (RSOF payment-link API answered)');
          probe = { at: ctx.clock.now().getTime(), ok, pending: null };
          return ok;
        });
      }
      return probe.pending;
    },

    /**
     * POST /orders/:id/pay — the payment page for one of the customer's app orders, or "paid".
     * @returns {Promise<{ status: 'paid' } | { status: 'pending', link: string, expiresAt: string|null, amount: number, currency: string }>}
     */
    async pay(userId, id) {
      const order = await ctx.db('orders').where({ user_id: userId }).andWhere((q) => q.where({ id }).orWhere({ rof_order_id: id })).first();
      if (!order) throw notFound('not_found', 'We could not find this order.');
      const payment = await ctx.db('payments').where({ order_id: order.id }).first();
      if (!payment || payment.method !== 'card') throw conflict('not_payable', 'This order is not paid online.');
      if (payment.status === 'captured') return { status: 'paid' };
      if (!OPEN.includes(payment.status)) throw conflict('not_payable', NOT_PAYABLE);
      return ask(payment, order);
    },

    /** Right after placing a card order: the link, or null if RSOF could not give one yet (the app's "Pay now" asks again). */
    async firstLink(payment, order) {
      try {
        return await ask(payment, order);
      } catch (error) {
        ctx.logger.warn(`[payments] no payment link yet for KR-${order.rof_order_number}: ${error.message}`);
        return null;
      }
    },

    /**
     * Before a pending card order is recorded as cancelled: did the customer pay in the meantime?
     * @returns {Promise<'paid'|'unpaid'|'unknown'|null>} null = not a pending card payment. 'paid' is recorded
     *   (captured + paid_at) so the cancellation becomes a refund to come. 'unknown' (RSOF down, or the order is
     *   already cancelled in RSOF and RSOF no longer says) — the customer is told "if you already paid…".
     */
    async settleBeforeCancel(order) {
      const payment = await ctx.db('payments').where({ order_id: order.id }).first();
      if (!payment || payment.method !== 'card' || !OPEN.includes(payment.status)) return null;
      recent.delete(payment.id);
      try {
        const answer = await askRsof(payment, order);
        return answer.status === 'paid' ? 'paid' : 'unpaid';
      } catch (error) {
        ctx.logger.warn(`[payments] could not confirm whether KR-${order.rof_order_number} was paid before it was cancelled (${error.message}) — check RSOF`);
        return 'unknown';
      }
    },
  };
}
