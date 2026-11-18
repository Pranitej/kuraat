/** Checkout helpers: the server's delivery quote and the checkout's idempotency key. */
import { toBranchView } from '@/domain';
import { apiRequest } from './api.js';

/**
 * Delivery: which branch will deliver to the address (stock-aware), how far it is and the delivery
 * slot. Pickup (design 2026-11-18 §5.3): needs no address — the nearest branch to where the customer
 * is (it may be null) and the cart priced from RSOF's prices (`totals`). Without productIds
 * the server uses the stored cart.
 * @returns {Promise<{ branch, distanceKm, isNearest, inStock, window?: { start, end }, totals?: object }>}
 */
export async function getQuote({ fulfilment = 'delivery', addressId, productIds, location }) {
  const body = fulfilment === 'pickup' ? { fulfilment, productIds, location } : { addressId, productIds };
  const quote = await apiRequest('/checkout/quote', { method: 'POST', body });
  return { ...quote, branch: quote.branch ? toBranchView(quote.branch) : null };
}

/**
 * The checkout draft with an idempotency key — created once per checkout and sent with every
 * "Pay" attempt, so retries never create a second order (server/README.md → Placing an order).
 */
export function withIdempotencyKey(draft, makeKey = () => crypto.randomUUID()) {
  return draft.idempotencyKey ? draft : { ...draft, idempotencyKey: makeKey() };
}
