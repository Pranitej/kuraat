/** Orders on the server (server/README.md → Orders): placed in RSOF, tracked from RSOF. */
import { onlyDigits } from '@/domain';
import { apiRequest } from './api.js';

const path = (id) => `/orders/${encodeURIComponent(id)}`;

export const listOrders = () => apiRequest('/orders');
export const getOrder = (id) => apiRequest(path(id));

/**
 * Pays (simulated in UAT) and places the order for the server cart. Same key → same order, so a
 * retry after a time-out is safe. Waits up to 60 s: the server may try RSOF more than once.
 */
export const placeOrder = ({ addressId, deliveryPhone, payment, idempotencyKey }) =>
  apiRequest('/orders', {
    method: 'POST',
    body: { addressId, deliveryPhone: onlyDigits(deliveryPhone), payment, idempotencyKey },
    timeoutMs: 60_000,
  });

export const cancelOrder = (id) => apiRequest(`${path(id)}/cancel`, { method: 'POST' });

/** @returns {Promise<{ sent: boolean, resendAt: string }>} */
export const resendCode = (id) => apiRequest(`${path(id)}/resend-code`, { method: 'POST' });

/** Payment methods offered (Saudi Arabia: card — incl. Mada — and cash on delivery; no UPI). */
export const PAYMENT_METHODS = ['card', 'cod'];

/** The payment part of the order request. Card details go to the server once and are never stored. */
export function toPaymentBody(method, { card, saveCard } = {}) {
  if (method === 'card') return { method: 'card', card: { number: onlyDigits(card.number), expiry: card.expiry, cvv: card.cvv }, saveCard: Boolean(saveCard) };
  if (method === 'cod') return { method: 'cod' };
  // Never fall back to cash: an unknown method is a bug, not a cash-on-delivery order.
  throw new Error(`Unknown payment method: ${method}`);
}
