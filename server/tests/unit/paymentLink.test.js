import { afterEach, describe, expect, test, vi } from 'vitest';
import { toPaymentLink } from '../../src/rof/adapter.js';
import { RofError } from '../../src/rof/errors.js';
import { PAYMENT_LINK_PATH, createPaymentLinkClient } from '../../src/rof/paymentLink.js';

const BASE = 'https://rofuat.rsof.com.sa';

describe('toPaymentLink (only a safe web page reaches the app)', () => {
  const ready = (paymentLink) => ({ outcome: 'LinkReady', paymentLink, amount: 100, currency: 'SAR', expiresAt: '2026-11-20T16:30:00.000Z', reused: false });

  test("the lead's example answer", () => {
    expect(toPaymentLink(ready('https://rofuat.rsof.com.sa/en/pay/PAYMENT_TOKEN'), { baseUrl: BASE })).toEqual({
      outcome: 'LinkReady',
      link: 'https://rofuat.rsof.com.sa/en/pay/PAYMENT_TOKEN',
      expiresAt: '2026-11-20T16:30:00.000Z',
      amount: 100,
      currency: 'SAR',
      reused: false,
    });
  });

  test.each([
    ['https on another host (e.g. the gateway)', 'https://pay.example.com/x', 'https://pay.example.com/x'],
    ['plain http on the RSOF address (local tests)', 'http://127.0.0.1:9000/en/pay/x', 'http://127.0.0.1:9000/en/pay/x', 'http://127.0.0.1:9000'],
    ['plain http elsewhere', 'http://evil.example.com/pay', null],
    ['a script', 'javascript:alert(1)', null],
    ['not a link', 'pay here', null],
    ['blank', '', null],
  ])('%s', (_name, paymentLink, expected, baseUrl = BASE) => {
    expect(toPaymentLink(ready(paymentLink), { baseUrl }).link).toBe(expected);
  });

  test('other outcomes carry no link', () => {
    expect(toPaymentLink({ outcome: 'AlreadyPaid', paymentLink: 'https://x/y' }, { baseUrl: BASE })).toMatchObject({ outcome: 'AlreadyPaid', link: null, amount: null, currency: null });
  });
});

describe('payment-link client', () => {
  afterEach(() => vi.unstubAllGlobals());
  const reply = (status, body) => vi.fn(async () => new Response(body === undefined ? 'not json' : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }));
  const client = () => createPaymentLinkClient({ baseUrl: `${BASE}/`, apiKey: 'rofi_1234abcd_secret', timeoutMs: 50 });

  test('sends the key in X-Api-Key and the order number + phone', async () => {
    const fetch = reply(200, { success: true, data: { outcome: 'LinkReady', paymentLink: 'https://x/pay/1' } });
    vi.stubGlobal('fetch', fetch);
    expect(await client().createLink({ orderNumber: '1068', phone: '966500000001' })).toMatchObject({ outcome: 'LinkReady' });
    const [url, init] = fetch.mock.calls[0];
    expect(String(url)).toBe(BASE + PAYMENT_LINK_PATH);
    expect(init.method).toBe('POST');
    expect(init.headers['X-Api-Key']).toBe('rofi_1234abcd_secret');
    expect(init.headers).not.toHaveProperty('Authorization');
    expect(JSON.parse(init.body)).toEqual({ orderNumber: 1068, phone: '966500000001' });
  });

  test('an outcome is the answer even with success:false', async () => {
    vi.stubGlobal('fetch', reply(200, { success: false, message: 'No payable order', data: { outcome: 'NoPayableOrder' } }));
    expect(await client().createLink({ orderNumber: 1, phone: '1' })).toEqual({ outcome: 'NoPayableOrder' });
  });

  test.each([
    ['401 → auth (the key)', 401, { success: false, message: 'Invalid API key' }, 'auth'],
    ['403 → auth (scope)', 403, { success: false }, 'auth'],
    ['404 → unavailable (API not live)', 404, { success: false, message: 'Cannot POST /api/v1/orders/payment-link' }, 'unavailable'],
    ['500 → unavailable', 500, { success: false }, 'unavailable'],
    ['429 → unavailable', 429, { success: false }, 'unavailable'],
    ['unreadable reply → unavailable', 200, undefined, 'unavailable'],
    ['400 without an outcome → rejected', 400, { success: false, message: 'orderNumber is required' }, 'rejected'],
    ['an outcome we do not know → rejected', 200, { success: true, data: { outcome: 'Maybe' } }, 'rejected'],
  ])('%s', async (_name, status, body, kind) => {
    vi.stubGlobal('fetch', reply(status, body));
    const error = await client().createLink({ orderNumber: 1, phone: '1' }).catch((e) => e);
    expect(error).toBeInstanceOf(RofError);
    expect(error.kind).toBe(kind);
    expect(error.message).not.toContain('rofi_1234abcd_secret'); // the key never reaches a log line
  });

  test('a network failure or time-out → unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new Error('The operation was aborted due to timeout');
    }));
    const error = await client().createLink({ orderNumber: 1, phone: '1' }).catch((e) => e);
    expect(error).toMatchObject({ kind: 'unavailable' });
  });
});
