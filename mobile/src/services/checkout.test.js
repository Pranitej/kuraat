import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { local } from '@/lib/storage.js';
import { stubFetch } from '@/test/stubFetch.js';
import { setTokens } from './api.js';
import { getQuote, withIdempotencyKey } from './checkoutService.js';
import { PAYMENT_METHODS, cancelOrder, getOrder, listOrders, placeOrder, resendCode, toPaymentBody } from './orderService.js';

beforeEach(() => {
  local.clearAll();
  setTokens({ accessToken: 'a1', refreshToken: 'r1' });
});
afterEach(() => vi.unstubAllGlobals());

describe('one idempotency key per checkout', () => {
  test('a draft without a key gets one; a draft with one keeps it', () => {
    let n = 0;
    const make = () => `key-${(n += 1)}`;
    const first = withIdempotencyKey({ addressId: 'a' }, make);
    expect(first).toEqual({ addressId: 'a', idempotencyKey: 'key-1' });
    expect(withIdempotencyKey(first, make)).toBe(first);
    expect(n).toBe(1);
  });

  test('the default key is a UUID', () => {
    expect(withIdempotencyKey({}).idempotencyKey).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  test('a retry after a declined card sends the same key', async () => {
    let attempt = 0;
    const calls = stubFetch(() => {
      attempt += 1;
      return attempt === 1
        ? { status: 402, body: { message: 'Your bank declined this payment.', code: 'card_declined', field: 'card' } }
        : { status: 201, body: { id: 'o1', number: 'KR-20418' } };
    });
    const input = { addressId: 'addr1', deliveryPhone: '501234821', payment: { method: 'cod' }, idempotencyKey: 'k-1' };
    await expect(placeOrder(input)).rejects.toMatchObject({ code: 'card_declined' });
    expect(await placeOrder(input)).toEqual({ id: 'o1', number: 'KR-20418' });
    expect(calls.map((c) => c.body.idempotencyKey)).toEqual(['k-1', 'k-1']);
  });
});

describe('payment body', () => {
  test('card: digits only for the number, expiry and CVV as typed, save choice', () => {
    expect(toPaymentBody('card', { card: { number: '4242 4242 4242 4242', expiry: '12 / 28', cvv: '123' }, saveCard: true })).toEqual({
      method: 'card',
      card: { number: '4242424242424242', expiry: '12 / 28', cvv: '123' },
      saveCard: true,
    });
  });

  test('cash on delivery', () => {
    expect(toPaymentBody('cod', {})).toEqual({ method: 'cod' });
  });

  test('only card and cash on delivery exist (Saudi Arabia: no UPI) — anything else is refused, never sent as cash', () => {
    expect(PAYMENT_METHODS).toEqual(['card', 'cod']);
    expect(() => toPaymentBody('upi', { upiId: 'sara@bank' })).toThrow('Unknown payment method: upi');
    expect(() => toPaymentBody(undefined, {})).toThrow('Unknown payment method');
  });
});

describe('order and quote calls', () => {
  test('one call per endpoint', async () => {
    const calls = stubFetch((c) => ({ body: c.path === '/checkout/quote' ? { branch: { id: 'b1', name: 'Kuraat · Al Khobar Corniche' }, distanceKm: 5.8, isNearest: true, inStock: true, window: {} } : {} }));
    const quote = await getQuote({ addressId: 'addr1', productIds: ['p1'] });
    await listOrders();
    await getOrder('o1');
    await cancelOrder('o1');
    await resendCode('o1');
    expect(calls.map((c) => `${c.method} ${c.path}`)).toEqual(['POST /checkout/quote', 'GET /orders', 'GET /orders/o1', 'POST /orders/o1/cancel', 'POST /orders/o1/resend-code']);
    expect(calls[0].body).toEqual({ addressId: 'addr1', productIds: ['p1'] });
    expect(quote.branch).toMatchObject({ name: 'Al Khobar Corniche', displayName: 'Kuraat · Al Khobar Corniche' });
  });
});
