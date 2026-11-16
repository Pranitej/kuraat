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

/** The payment part of the order request. Card details go to the server once and are never stored. */
export function toPaymentBody(method, { card, upiId, saveCard } = {}) {
  if (method === 'card') return { method: 'card', card: { number: onlyDigits(card.number), expiry: card.expiry, cvv: card.cvv }, saveCard: Boolean(saveCard) };
  if (method === 'upi') return { method: 'upi', upiId: (upiId || '').trim() };
  return { method: 'cod' };
}
