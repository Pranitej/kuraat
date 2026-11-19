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
 * What the customer can pay with. card: online payment on RSOF's page works right now. cash: cash on delivery and pay
 * at the branch are offered at all (the kuraat server's CASH_PAYMENTS_ENABLED; an older server sends no `cash` and
 * still offers them). A failed check offers nothing: the order could not be placed anyway.
 * @returns {Promise<{ card: boolean, cash: boolean }>}
 */
export async function getPaymentOptions() {
  try {
    const options = await apiRequest('/checkout/payment-options');
    return { card: options?.card === true, cash: options?.cash !== false };
  } catch {
    return { card: false, cash: false };
  }
}

/**
 * The checkout draft with an idempotency key — created once per checkout and sent with every
 * "Pay" attempt, so retries never create a second order (server/README.md → Placing an order).
 */
export function withIdempotencyKey(draft, makeKey = () => crypto.randomUUID()) {
  return draft.idempotencyKey ? draft : { ...draft, idempotencyKey: makeKey() };
}
