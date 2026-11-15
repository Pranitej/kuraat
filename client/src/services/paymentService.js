/** Payment processing (demo stand-in for the payment gateway). */

import { onlyDigits, cardBrand, randomHex } from '@/domain';
import { request, ApiError } from './request.js';
import { updateDb, userBucket } from './db.js';

/** Remember a card for next time — masked only (brand, last 4, expiry); never the full number or CVV. */
export function saveCard(userId, { brand, last4, expiry }) {
  updateDb((db) => {
    const cards = userBucket(db, 'savedCards', userId);
    if (!cards.some((c) => c.last4 === last4 && c.brand === brand)) cards.push({ brand, last4, expiry, savedAt: new Date().toISOString() });
  });
}

/** Test card that is always declined, for demonstrating the error state. */
export const DECLINED_TEST_CARD = '4000000000000002';

/**
 * @param {{ method: 'card'|'upi'|'cod', card?: { number, expiry, cvv }, upiId?: string, amount: number }} input
 * @returns {Promise<{ method, brand?, last4?, upiId?, transactionId, paidAt, amount }>}
 */
export async function processPayment(input) {
  return request(
    () => {
      const paidAt = new Date().toISOString();
      if (input.method === 'card') {
        const number = onlyDigits(input.card.number);
        if (number === DECLINED_TEST_CARD) {
          throw new ApiError('Your bank declined this payment. Try another card or payment method.', { code: 'card_declined', field: 'card' });
        }
        return {
          method: 'card',
          brand: cardBrand(number),
          last4: number.slice(-4),
          transactionId: `TXN-${randomHex(8)}`,
          paidAt,
          amount: input.amount,
        };
      }
      if (input.method === 'upi') {
        return { method: 'upi', upiId: input.upiId.trim(), transactionId: `TXN-${randomHex(8)}`, paidAt, amount: input.amount };
      }
      return { method: 'cod', transactionId: null, paidAt: null, amount: input.amount };
    },
    { min: 1400, max: 2000 },
  );
}
