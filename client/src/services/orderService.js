/** Orders on the server (server/README.md → Orders): placed in RSOF, tracked from RSOF. */
import { CLIENT_CHANNEL } from '../lib/env.js';
import { apiRequest } from './api.js';

const path = (id) => `/orders/${encodeURIComponent(id)}`;

/** refresh: the refresh button — the server re-reads RSOF now (at most once per 10 s). */
export const listOrders = ({ refresh = false } = {}) => apiRequest(refresh ? '/orders?refresh=true' : '/orders');
export const getOrder = (id, { refresh = false } = {}) => apiRequest(refresh ? `${path(id)}?refresh=true` : path(id));

/**
 * Places the order for the server cart. Same key → same order, so a retry after a time-out is safe. Waits up to
 * 60 s: the server may try RSOF more than once. An online-payment order comes back with
 * RSOF's payment page in `payment.link` (null if RSOF had none — `payOrder` asks again). Whether the customer paid is RSOF's business.
 * A pickup order (design 2026-11-18 §5.3) has no delivery address, so none is sent.
 * @param {{ fulfilment?: 'delivery' | 'pickup', addressId?: string, payment: object, idempotencyKey: string }} input
 */
export const placeOrder = ({ fulfilment = 'delivery', addressId, payment, idempotencyKey }) =>
  apiRequest('/orders', {
    method: 'POST',
    body: {
      fulfilment,
      channel: CLIENT_CHANNEL,
      ...(fulfilment === 'pickup' ? {} : { addressId }),
      payment,
      idempotencyKey,
    },
    timeoutMs: 60_000,
  });

export const cancelOrder = (id) => apiRequest(`${path(id)}/cancel`, { method: 'POST' });

/**
 * A fresh RSOF payment page for an online-payment order (the Pay button when the order reply came without one).
 * Asked only when the customer taps; the kuraat server answers 409 'check the Orders page' if RSOF cannot give one.
 * @returns {Promise<{ link: string, expiresAt: string|null }>}
 */
export const payOrder = (id) => apiRequest(`${path(id)}/pay`, { method: 'POST' });

/** @returns {Promise<{ sent: boolean, resendAt: string }>} */
export const resendCode = (id) => apiRequest(`${path(id)}/resend-code`, { method: 'POST' });

/**
 * Payment methods (Saudi Arabia: card — incl. Mada — cash on delivery, and pay at the branch for
 * pickup; no UPI). Each way of getting the order offers two of them.
 */
export const PAYMENT_METHODS = ['card', 'cod', 'branch'];

/** Delivery pays card or cash; pickup pays card now or at the branch. */
export const methodsFor = (fulfilment) => (fulfilment === 'pickup' ? ['card', 'branch'] : ['card', 'cod']);

/**
 * The remembered method if this way of getting the order still offers it, else the first one on offer. Which are on
 * offer comes from the server's payment options: online payment (`cardAvailable`, works right now) and the two cash
 * ways (`cashAvailable`, switched on at all). With nothing on offer the answer is "card" (shown greyed out).
 */
export function offeredMethod(method, fulfilment, { cardAvailable = true, cashAvailable = true } = {}) {
  const offered = methodsFor(fulfilment).filter((m) => (m === 'card' ? cardAvailable : cashAvailable));
  return offered.includes(method) ? method : (offered[0] ?? 'card');
}

/** The payment part of the order request. A card is paid on RSOF's secure payment page afterwards: no card details are sent. */
export function toPaymentBody(method) {
  if (method === 'card' || method === 'cod' || method === 'branch') return { method };
  // Never fall back to cash: an unknown method is a bug, not a cash-on-delivery order.
  throw new Error(`Unknown payment method: ${method}`);
}
