/** Checkout helpers: the server's delivery quote and the checkout's idempotency key. */
import { toBranchView } from '@/domain';
import { apiRequest } from './api.js';

/**
 * Which branch will deliver to the address (stock-aware), how far it is and the delivery slot.
 * Without productIds the server uses the stored cart.
 * @returns {Promise<{ branch, distanceKm, isNearest, inStock, window: { start, end } }>}
 */
export async function getQuote({ addressId, productIds }) {
  const quote = await apiRequest('/checkout/quote', { method: 'POST', body: { addressId, productIds } });
  return { ...quote, branch: toBranchView(quote.branch) };
}

/**
 * The checkout draft with an idempotency key — created once per checkout and sent with every
 * "Pay" attempt, so retries never create a second order (server/README.md → Placing an order).
 */
export function withIdempotencyKey(draft, makeKey = () => crypto.randomUUID()) {
  return draft.idempotencyKey ? draft : { ...draft, idempotencyKey: makeKey() };
}
