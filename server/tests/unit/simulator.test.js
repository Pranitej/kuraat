import { describe, expect, test } from 'vitest';
import { DECLINED_TEST_CARD, authorizePayment, cardBrand } from '../../src/modules/payments/simulator.js';

const now = new Date('2026-11-15T09:21:00Z');
const card = (overrides = {}) => ({ number: '4242 4242 4242 4242', expiry: '12/29', cvv: '123', ...overrides });

describe('payment simulator (no real money — UAT default)', () => {
  test('pay at the branch (pickup): nothing is charged now, no card, no transaction id', () => {
    expect(authorizePayment({ method: 'branch', amount: 313 }, { now })).toEqual({ method: 'branch', brand: null, last4: null, expiry: null, transactionId: null });
  });

  test('a valid card is authorised with brand, last 4 and a transaction id', () => {
    const result = authorizePayment({ method: 'card', card: card(), amount: 328 }, { now });
    expect(result).toEqual({ method: 'card', brand: 'Visa', last4: '4242', expiry: '12/29', transactionId: expect.stringMatching(/^TXN-[0-9A-F]{8}$/) });
    expect(JSON.stringify(result)).not.toContain('4242424242424242');
  });

  test('the declined test card → 402 card_declined', () => {
    expect(DECLINED_TEST_CARD).toBe('4000000000000002');
    expect(() => authorizePayment({ method: 'card', card: card({ number: '4000 0000 0000 0002' }), amount: 10 }, { now })).toThrow(
      expect.objectContaining({ status: 402, code: 'card_declined', field: 'card' }),
    );
  });

  test.each([
    [{ number: '4242 4242 4242 4241' }, 'card.number', 'Check the card number'],
    [{ expiry: '10/26' }, 'card.expiry', 'Card has expired'],
    [{ expiry: '13/29' }, 'card.expiry', 'Invalid month'],
    [{ cvv: '12' }, 'card.cvv', '3 or 4 digits'],
  ])('invalid card %o → 400 invalid on %s', (override, field, message) => {
    expect(() => authorizePayment({ method: 'card', card: card(override), amount: 10 }, { now })).toThrow(
      expect.objectContaining({ status: 400, code: 'invalid', field, message }),
    );
  });

  test('a card expiring this month (Saudi time) is still valid', () => {
    expect(authorizePayment({ method: 'card', card: card({ expiry: '11/26' }), amount: 10 }, { now }).last4).toBe('4242');
  });

  test('cash on delivery has no transaction', () => {
    expect(authorizePayment({ method: 'cod', amount: 10 }, { now })).toEqual({ method: 'cod', brand: null, last4: null, expiry: null, transactionId: null });
  });

  test.each(['upi', 'paypal', undefined])('method %s is not offered in Saudi Arabia → 400 invalid, never cash on delivery', (method) => {
    expect(() => authorizePayment({ method, upiId: 'sara@okaxis', amount: 10 }, { now })).toThrow(
      expect.objectContaining({ status: 400, code: 'invalid', field: 'payment.method' }),
    );
  });

  test('card brands', () => {
    expect(cardBrand('5555555555554444')).toBe('Mastercard');
    expect(cardBrand('4406470000000000')).toBe('Mada');
    expect(cardBrand('378282246310005')).toBe('Amex');
  });
});
