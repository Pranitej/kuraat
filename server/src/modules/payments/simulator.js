/**
 * Simulated payment gateway for UAT (agreed default: test cards, no real money). Validation rules
 * and brands are copied from the client's domain/validation.js. Never returns or stores the full card
 * number or CVV (guide §6.3). Replace this module when a real gateway is chosen.
 */
import { randomBytes } from 'node:crypto';
import { badRequest, paymentRequired } from '../../http/errors.js';
import { saudiParts } from '../../lib/time.js';

/** Always declined, to demonstrate the error state. */
export const DECLINED_TEST_CARD = '4000000000000002';

const digits = (v) => String(v ?? '').replace(/\D/g, '');

function luhnValid(number) {
  if (number.length < 13 || number.length > 19) return false;
  let sum = 0;
  let double = false;
  for (let i = number.length - 1; i >= 0; i -= 1) {
    let n = Number(number[i]);
    if (double) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    double = !double;
  }
  return sum % 10 === 0;
}

const MADA_BINS =
  /^(440647|440795|446404|457865|968208|588845|636120|457997|474491|543357|585265|588848|588850|604906|521076|529415|535825|543085|524130|554180|549760|588849)/;

export function cardBrand(number) {
  const d = digits(number);
  if (MADA_BINS.test(d)) return 'Mada';
  if (/^4/.test(d)) return 'Visa';
  if (/^(5[1-5]|2[2-7])/.test(d)) return 'Mastercard';
  if (/^3[47]/.test(d)) return 'Amex';
  return 'Card';
}

/** "MM/YY" or "MM / YY" → error message or ''. A card is valid until the end of its month (Saudi time). */
function expiryProblem(expiry, now) {
  const d = digits(expiry);
  if (d.length !== 4) return 'Use MM / YY';
  const month = Number(d.slice(0, 2));
  const year = 2000 + Number(d.slice(2));
  if (month < 1 || month > 12) return 'Invalid month';
  const today = saudiParts(now);
  if (year < today.year || (year === today.year && month < today.month)) return 'Card has expired';
  return '';
}

const transactionId = () => `TXN-${randomBytes(4).toString('hex').toUpperCase()}`;

/**
 * Saudi Arabia: card (incl. Mada), cash on delivery, or (pickup) pay at the branch. Any other method is refused — never treated as cash.
 * @param {{ method: 'card'|'cod'|'branch', card?: { number, expiry, cvv }, amount: number }} input
 * @returns {{ method, brand, last4, expiry, transactionId }}
 */
export function authorizePayment(input, { now = new Date() } = {}) {
  if (input.method === 'card') {
    const number = digits(input.card?.number);
    if (!luhnValid(number)) throw badRequest('invalid', 'Check the card number', 'card.number');
    const expiryError = expiryProblem(input.card?.expiry, now);
    if (expiryError) throw badRequest('invalid', expiryError, 'card.expiry');
    const cvv = digits(input.card?.cvv);
    if (cvv.length < 3 || cvv.length > 4) throw badRequest('invalid', '3 or 4 digits', 'card.cvv');
    if (number === DECLINED_TEST_CARD) {
      throw paymentRequired('card_declined', 'Your bank declined this payment. Try another card or payment method.', 'card');
    }
    const e = digits(input.card.expiry);
    return { method: 'card', brand: cardBrand(number), last4: number.slice(-4), expiry: `${e.slice(0, 2)}/${e.slice(2)}`, transactionId: transactionId() };
  }
  // Cash on delivery and pay-at-the-branch (pickup): nothing is charged now.
  if (input.method === 'cod' || input.method === 'branch') return { method: input.method, brand: null, last4: null, expiry: null, transactionId: null };
  throw badRequest('invalid', 'Choose card or cash on delivery.', 'payment.method');
}
