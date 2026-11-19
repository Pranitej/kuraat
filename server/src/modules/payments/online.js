/**
 * Online payment on RSOF's payment page (19 Nov 2026). RSOF is the master of orders AND of the money, so the kuraat
 * server does only this:
 *   1. the order is placed in RSOF first (the payment link needs its order number)
 *   2. the kuraat server asks RSOF for the payment link ONCE and hands it to the app, which opens it
 *   3. that is all. Whether the customer paid is RSOF's business: we do not ask again, track it or show it. The apps
 *      tell the customer to check the Orders page, which shows RSOF's own status.
 * One more RSOF call: a cached "is online payment working?" check, so the option is greyed out when it is not.
 */
import { conflict, notFound, unavailable } from '../../http/errors.js';
import { toPaymentLink, toRofPhone } from '../../rof/adapter.js';
import { isRofError } from '../../rof/errors.js';

export const CARD_UNAVAILABLE = "Online payment isn't available right now. Choose cash on delivery or pay at the branch.";
const PAGE_UNAVAILABLE = "We couldn't open the payment page. Please try again in a moment.";
const NOT_READY = "Online payment isn't ready for this order yet. Please try again in a few minutes.";
// Already paid, cancelled or not matching: RSOF knows which, and the Orders page shows it.
const CHECK_ORDERS = 'Please check the Orders page for your payment status.';

// The "is online payment working?" check (see available()).
const PROBE = { orderNumber: 1, phone: '966000000000' };
const PROBE_OK_MS = 5 * 60_000;
const PROBE_FAIL_MS = 60_000;

export function createOnlinePayments(ctx) {
  const client = ctx.paymentLinks ?? null;

  // Is online payment working right now? The key must be set and RSOF's payment-link API must answer with it.
  // Checked with a request that matches no order (order 1 with the phone 966000000000, which no customer has):
  // RSOF finds no payable order and creates nothing. Remembered 5 minutes when it works, 1 minute when not, so a
  // missing key, a payment gateway not set up in RSOF yet or RSOF's API being down simply greys the option out —
  // instead of placing orders nobody can pay.
  let probe = { at: Number.NEGATIVE_INFINITY, ok: false, pending: null };
  async function checkRsof() {
    try {
      const raw = await client.createLink({ orderNumber: PROBE.orderNumber, phone: PROBE.phone });
      if (raw.outcome === 'NotReady' || raw.outcome === 'Error') {
        ctx.logger.warn(`[payments] online payment is off: RSOF answered ${raw.outcome}${raw.message ? ` (${raw.message})` : ''}`);
        return false;
      }
      return true;
    } catch (error) {
      // "rejected" = RSOF read the request with our key and refused its content: the API and the key work.
      if (isRofError(error, 'rejected')) return true;
      ctx.logger[isRofError(error, 'auth') ? 'error' : 'warn'](`[payments] online payment is off: ${error.message}`);
      return false;
    }
  }

  /** One RSOF call: the payment page of this order → { link, expiresAt }; an AppError with a customer-friendly message otherwise. */
  async function link(order) {
    if (!client) throw unavailable('payment_unavailable', CARD_UNAVAILABLE);
    const number = `KR-${order.rof_order_number}`;
    // RSOF matches the link to the order by its number AND the phone the order was created with: the account's
    // number, saved on our order row when it was placed.
    const phone = order.delivery_phone || (await ctx.db('users').where({ id: order.user_id }).first())?.phone;
    if (!phone) throw conflict('not_payable', CHECK_ORDERS);
    let answer;
    try {
      answer = toPaymentLink(await client.createLink({ orderNumber: order.rof_order_number, phone: toRofPhone(phone) }), { baseUrl: ctx.config.rof.baseUrl });
    } catch (error) {
      if (!isRofError(error)) throw error;
      // RSOF's payment API is down or refuses our key: stop offering online payment for a minute (see available()).
      if (error.kind !== 'rejected') probe = { at: ctx.clock.now().getTime(), ok: false, pending: null };
      ctx.logger[error.kind === 'auth' ? 'error' : 'warn'](`[payments] payment link for ${number} failed (${error.kind}): ${error.message}`);
      throw unavailable('payment_unavailable', PAGE_UNAVAILABLE);
    }
    if (answer.outcome === 'LinkReady' && answer.link) return { link: answer.link, expiresAt: answer.expiresAt };
    if (answer.outcome === 'LinkReady') ctx.logger.warn(`[payments] RSOF answered LinkReady for ${number} without a usable https link`);
    else ctx.logger.warn(`[payments] RSOF answered ${answer.outcome} for the payment link of ${number}`);
    if (answer.outcome === 'NotReady') throw unavailable('payment_not_ready', NOT_READY);
    if (answer.outcome === 'AlreadyPaid' || answer.outcome === 'NoPayableOrder') throw conflict('not_payable', CHECK_ORDERS);
    throw unavailable('payment_unavailable', PAGE_UNAVAILABLE); // 'Error', or a link that is not a safe web page
  }

  return {
    /** False when no payment API key is set: online orders are refused before anything is created. */
    ready: Boolean(client),

    /** Online payment can be offered now (key set and RSOF's payment-link API answering). Never throws. */
    async available() {
      if (!client) return false;
      const now = ctx.clock.now().getTime();
      if (now - probe.at < (probe.ok ? PROBE_OK_MS : PROBE_FAIL_MS)) return probe.ok;
      if (!probe.pending) {
        probe.pending = checkRsof().then((ok) => {
          if (ok && !probe.ok) ctx.logger.info('[payments] online payment is on (RSOF payment-link API answered)');
          probe = { at: ctx.clock.now().getTime(), ok, pending: null };
          return ok;
        });
      }
      return probe.pending;
    },

    /** POST /orders/:id/pay — a fresh payment page for one of the customer's online-payment orders (the "Pay" button after a reload). */
    async pay(userId, id) {
      const order = await ctx.db('orders').where({ user_id: userId }).andWhere((q) => q.where({ id }).orWhere({ rof_order_id: id })).first();
      if (!order) throw notFound('not_found', 'We could not find this order.');
      const payment = await ctx.db('payments').where({ order_id: order.id }).first();
      if (!payment || payment.method !== 'card') throw conflict('not_payable', 'This order is not paid online.');
      if (order.cancelled || payment.status === 'voided') throw conflict('not_payable', CHECK_ORDERS);
      return link(order);
    },

    /** Right after placing an online-payment order: the page, or null if RSOF could not give one (the Pay button asks again). */
    async firstLink(order) {
      try {
        return await link(order);
      } catch (error) {
        ctx.logger.warn(`[payments] no payment link yet for KR-${order.rof_order_number}: ${error.message}`);
        return null;
      }
    },
  };
}
