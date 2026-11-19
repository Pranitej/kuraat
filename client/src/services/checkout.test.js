import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { CLIENT_CHANNEL } from '@/lib/env.js';
import { local } from '@/lib/storage.js';
import { stubFetch } from '@/test/stubFetch.js';
import { setTokens } from './api.js';
import { getPaymentOptions, getQuote, withIdempotencyKey } from './checkoutService.js';
import { PAYMENT_METHODS, cancelOrder, getOrder, listOrders, methodsFor, offeredMethod, payOrder, placeOrder, resendCode, toPaymentBody } from './orderService.js';

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

  test('a retry after a failed attempt sends the same key', async () => {
    let attempt = 0;
    const calls = stubFetch(() => {
      attempt += 1;
      return attempt === 1
        ? { status: 503, body: { message: "We can't reach the store right now.", code: 'rof_unavailable', field: null } }
        : { status: 201, body: { id: 'o1', number: 'KR-20418' } };
    });
    const input = { addressId: 'addr1', payment: { method: 'cod' }, idempotencyKey: 'k-1' };
    await expect(placeOrder(input)).rejects.toMatchObject({ code: 'rof_unavailable' });
    expect(await placeOrder(input)).toEqual({ id: 'o1', number: 'KR-20418' });
    expect(calls.map((c) => c.body.idempotencyKey)).toEqual(['k-1', 'k-1']);
  });
});

describe('payment body', () => {
  test('card: only the method — the card is entered on the secure payment page, never in the app', () => {
    expect(toPaymentBody('card')).toEqual({ method: 'card' });
    expect(toPaymentBody('card', { card: { number: '4242 4242 4242 4242' } })).toEqual({ method: 'card' });
  });

  test('cash on delivery', () => {
    expect(toPaymentBody('cod', {})).toEqual({ method: 'cod' });
  });

  test('pay at branch (pickup)', () => {
    expect(toPaymentBody('branch', {})).toEqual({ method: 'branch' });
  });

  test('only card, cash on delivery and pay at branch exist (Saudi Arabia: no UPI) — anything else is refused, never sent as cash', () => {
    expect(PAYMENT_METHODS).toEqual(['card', 'cod', 'branch']);
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
    await payOrder('o1');
    expect(calls.map((c) => `${c.method} ${c.path}`)).toEqual(['POST /checkout/quote', 'GET /orders', 'GET /orders/o1', 'POST /orders/o1/cancel', 'POST /orders/o1/resend-code', 'POST /orders/o1/pay']);
    expect(calls[0].body).toEqual({ addressId: 'addr1', productIds: ['p1'] });
    expect(quote.branch).toMatchObject({ name: 'Al Khobar Corniche', displayName: 'Kuraat · Al Khobar Corniche' });
  });
});

describe('delivery or pickup (design 2026-11-18 §5.3)', () => {
  test('which payment methods each way offers', () => {
    expect(methodsFor('delivery')).toEqual(['card', 'cod']);
    expect(methodsFor('pickup')).toEqual(['card', 'branch']);
    expect(methodsFor(undefined)).toEqual(['card', 'cod']);
  });

  test('card off (payment page not working): the other method of this way is chosen', () => {
    expect(offeredMethod('card', 'delivery', { cardAvailable: false })).toBe('cod');
    expect(offeredMethod('card', 'pickup', { cardAvailable: false })).toBe('branch');
    expect(offeredMethod('cod', 'delivery', { cardAvailable: false })).toBe('cod');
    expect(offeredMethod('card', 'delivery', { cardAvailable: true })).toBe('card');
  });

  test('payment options: card only when the server says so; a failed check counts as card off', async () => {
    stubFetch(() => ({ body: { card: true } }));
    expect(await getPaymentOptions()).toEqual({ card: true });
    stubFetch(() => ({ body: {} }));
    expect(await getPaymentOptions()).toEqual({ card: false });
    stubFetch(() => ({ status: 503, body: { message: 'down', code: 'x', field: null } }));
    expect(await getPaymentOptions()).toEqual({ card: false });
  });

  test('a remembered method that the other way does not offer falls back to card', () => {
    expect(offeredMethod('cod', 'pickup')).toBe('card');
    expect(offeredMethod('branch', 'delivery')).toBe('card');
    expect(offeredMethod('upi', 'delivery')).toBe('card');
    expect(offeredMethod('branch', 'pickup')).toBe('branch');
    expect(offeredMethod('cod', 'delivery')).toBe('cod');
  });

  test('a pickup order is sent with its fulfilment and without an address', async () => {
    const calls = stubFetch(() => ({ status: 201, body: { id: 'o1' } }));
    await placeOrder({ fulfilment: 'pickup', addressId: 'addr1', deliveryPhone: '50 123 4821', payment: { method: 'branch' }, idempotencyKey: 'k-1' });
    // No phone is sent: the order always carries the account's number, which the kuraat server already has.
    expect(calls[0].body).toEqual({ fulfilment: 'pickup', channel: CLIENT_CHANNEL, payment: { method: 'branch' }, idempotencyKey: 'k-1' });
  });

  test('a delivery order still sends its address, and says delivery', async () => {
    const calls = stubFetch(() => ({ status: 201, body: { id: 'o1' } }));
    await placeOrder({ addressId: 'addr1', payment: { method: 'cod' }, idempotencyKey: 'k-2' });
    expect(calls[0].body).toEqual({ fulfilment: 'delivery', channel: CLIENT_CHANNEL, addressId: 'addr1', payment: { method: 'cod' }, idempotencyKey: 'k-2' });
  });

  test('the pickup quote asks with the fulfilment (no address) and keeps totals; no branch is fine', async () => {
    const calls = stubFetch(() => ({ body: { fulfilment: 'pickup', branch: null, distanceKm: null, isNearest: null, inStock: null, totals: { total: 313, delivery: 0 } } }));
    const quote = await getQuote({ fulfilment: 'pickup', productIds: ['p1'], location: { lat: 26.28, lng: 50.2 } });
    expect(calls[0].body).toEqual({ fulfilment: 'pickup', productIds: ['p1'], location: { lat: 26.28, lng: 50.2 } });
    expect(quote).toMatchObject({ branch: null, totals: { total: 313, delivery: 0 } });
  });

  test('a pickup quote with a branch gives it the screen names', async () => {
    stubFetch(() => ({ body: { fulfilment: 'pickup', branch: { id: 'b1', name: 'Kuraat · Al Khobar Corniche' }, distanceKm: 2.4, totals: { total: 313 } } }));
    const quote = await getQuote({ fulfilment: 'pickup' });
    expect(quote.branch).toMatchObject({ name: 'Al Khobar Corniche', displayName: 'Kuraat · Al Khobar Corniche' });
  });
});
