/** Orders on the server (server/README.md → Orders): placed in RSOF, tracked from RSOF. */
import { onlyDigits } from '@/domain';
import { CLIENT_CHANNEL } from '../lib/env.js';
import { apiRequest } from './api.js';

const path = (id) => `/orders/${encodeURIComponent(id)}`;

/** refresh: the refresh button — the server re-reads RSOF now (at most once per 10 s). */
export const listOrders = ({ refresh = false } = {}) => apiRequest(refresh ? '/orders?refresh=true' : '/orders');
export const getOrder = (id, { refresh = false } = {}) => apiRequest(refresh ? `${path(id)}?refresh=true` : path(id));

/**
 * Pays (simulated in UAT) and places the order for the server cart. Same key → same order, so a
 * retry after a time-out is safe. Waits up to 60 s: the server may try RSOF more than once.
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

/** @returns {Promise<{ sent: boolean, resendAt: string }>} */
export const resendCode = (id) => apiRequest(`${path(id)}/resend-code`, { method: 'POST' });

/**
 * Payment methods (Saudi Arabia: card — incl. Mada — cash on delivery, and pay at the branch for
 * pickup; no UPI). Each way of getting the order offers two of them.
 */
export const PAYMENT_METHODS = ['card', 'cod', 'branch'];

/** Delivery pays card or cash; pickup pays card now or at the branch. */
export const methodsFor = (fulfilment) => (fulfilment === 'pickup' ? ['card', 'branch'] : ['card', 'cod']);

/** The remembered method if this way of getting the order still offers it, else card. */
export const offeredMethod = (method, fulfilment) => (methodsFor(fulfilment).includes(method) ? method : 'card');

/** The payment part of the order request. Card details go to the server once and are never stored. */
export function toPaymentBody(method, { card, saveCard } = {}) {
  if (method === 'card') return { method: 'card', card: { number: onlyDigits(card.number), expiry: card.expiry, cvv: card.cvv }, saveCard: Boolean(saveCard) };
  if (method === 'cod') return { method: 'cod' };
  if (method === 'branch') return { method: 'branch' };
  // Never fall back to cash: an unknown method is a bug, not a cash-on-delivery order.
  throw new Error(`Unknown payment method: ${method}`);
}
