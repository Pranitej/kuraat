/**
 * Online payment on RSOF's payment page (19 Nov 2026), kept deliberately simple: the order is placed in RSOF first,
 * the kuraat server asks RSOF for the payment link ONCE and hands it over; whether the customer paid is RSOF's
 * business (the kuraat server never asks again, tracks it or shows it).
 * Everything runs against the in-process RSOF stand-in — never the real RSOF.
 */
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterEach, describe, expect, test } from 'vitest';
import { signInDemo, signUp } from '../helpers/auth.js';
import { createTestContext } from '../helpers/context.js';
import { CARD, payOnRsof, placeTestOrder } from '../helpers/orders.js';
import { PRODUCT_IDS } from '../support/rof-double/seed.js';

let t;
let me;
afterEach(async () => {
  await t?.close();
  t = null;
});

async function start(options = {}) {
  t = await createTestContext({ withRof: true, rofTimeoutMs: 800, ...options });
  await t.reset();
  me = await signInDemo(t);
}
const api = (method, path, body, who = me) => {
  const req = request(t.app)[method](`/api/v1${path}`).set('Authorization', who.auth);
  return body === undefined ? req : req.send(body);
};
const fault = (faults) => request(t.mockRof.app).post('/__dev/faults').send(faults);
const linkCalls = () => t.mockRof.store.data.paymentLinkCalls || 0;
const seconds = (n) => t.clock.advance(n * 1000);
const payment = () => t.db('payments').first();

describe('paying online on the RSOF page', () => {
  test('the new order comes with the payment page; RSOF is asked exactly once for it', async () => {
    await start();
    expect((await api('get', '/checkout/payment-options')).body).toEqual({ card: true }); // the cached "is it on?" check: 1 call
    const before = linkCalls();
    const order = await placeTestOrder(t, me);
    expect(order.payment).toMatchObject({ method: 'card', status: 'online', link: expect.stringMatching(/^http:\/\/127\.0\.0\.1:\d+\/en\/pay\/\w+$/), linkExpiresAt: expect.any(String) });
    expect(linkCalls()).toBe(before + 1);
  });

  test('the order is placed in RSOF first, with the account phone RSOF will match the link to', async () => {
    await start();
    const order = await placeTestOrder(t, me);
    const rof = t.mockRof.store.data.orders[0];
    expect(rof.phoneNumber).toBe('966501234821');
    expect(order.number).toBe(`KR-${rof.orderNumber}`);
    expect(t.mockRof.store.data.paymentLinks[rof.orderNumber]).toMatchObject({ token: expect.any(String) });
  });

  test('the kuraat server never claims the customer paid: the status stays "online", even after RSOF took the payment', async () => {
    await start();
    const order = await placeTestOrder(t, me);
    await payOnRsof(t, order.number);
    seconds(30);
    const detail = (await api('get', `/orders/${order.id}`)).body;
    expect(detail.payment).toMatchObject({ method: 'card', status: 'online', paidAt: null, link: null });
    expect((await api('get', '/orders')).body[0].payment.status).toBe('online');
    expect(await payment()).toMatchObject({ status: 'pending', paid_at: null });
    expect(await t.db('notifications').where({ type: 'payment' })).toHaveLength(0);
  });

  test('the Pay button after a reload: POST /orders/:id/pay gives a page again (by our id or the RSOF id)', async () => {
    await start();
    const order = await placeTestOrder(t, me);
    seconds(10);
    const res = await api('post', `/orders/${order.id}/pay`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ link: order.payment.link, expiresAt: order.payment.linkExpiresAt }); // RSOF reuses the live link
    expect((await api('post', `/orders/${t.mockRof.store.data.orders[0].id}/pay`)).body.link).toBe(order.payment.link);
  });

  test('RSOF has no page right after the order is placed: the order is still placed (201), link null; Pay works later', async () => {
    await start();
    expect((await api('get', '/checkout/payment-options')).body).toEqual({ card: true });
    await fault({ paymentOutcome: 'NotReady' });
    const order = await placeTestOrder(t, me);
    expect(order.payment).toMatchObject({ status: 'online', link: null, linkExpiresAt: null });
    await fault({ paymentOutcome: null });
    seconds(10);
    expect((await api('post', `/orders/${order.id}/pay`)).body).toMatchObject({ link: expect.any(String) });
  });
});

describe('when RSOF cannot give a page', () => {
  test.each([
    ['NotReady', 503, 'payment_not_ready'],
    ['Error', 503, 'payment_unavailable'],
    ['NoPayableOrder', 409, 'not_payable'],
    ['AlreadyPaid', 409, 'not_payable'],
  ])('RSOF answers %s → %i %s; the order stays', async (outcome, status, code) => {
    await start();
    const order = await placeTestOrder(t, me);
    seconds(10);
    await fault({ paymentOutcome: outcome });
    const res = await api('post', `/orders/${order.id}/pay`);
    expect(res.status).toBe(status);
    expect(res.body.code).toBe(code);
    expect(res.body.message).not.toMatch(/RSOF|ROF|outcome|MyFatoorah/i); // customer wording, no system names
    if (status === 409) expect(res.body.message).toBe('Please check the Orders page for your payment status.');
    expect(await t.db('orders')).toHaveLength(1);
  });

  test.each([500, 404, 403])('RSOF answers HTTP %i → 503 payment_unavailable; logged', async (http) => {
    await start();
    const order = await placeTestOrder(t, me);
    seconds(10);
    await fault({ paymentLinkHttp: http });
    const res = await api('post', `/orders/${order.id}/pay`);
    expect(res).toMatchObject({ status: 503, body: { code: 'payment_unavailable' } });
    expect(t.logs.some(([, line]) => line.includes('[payments] payment link for KR-20418 failed'))).toBe(true);
  });

  test('a link that is not a safe web page is never handed to the app', async () => {
    await start();
    const order = await placeTestOrder(t, me);
    seconds(10);
    t.ctx.paymentLinks.createLink = async () => ({ outcome: 'LinkReady', paymentLink: 'javascript:alert(1)', amount: 185, currency: 'SAR' });
    expect(await api('post', `/orders/${order.id}/pay`)).toMatchObject({ status: 503, body: { code: 'payment_unavailable' } });
  });
});

describe('online payment switched off', () => {
  test('no payment API key: shown as unavailable and refused before anything is created; cash still works', async () => {
    await start({ cardPayments: false });
    expect((await api('get', '/checkout/payment-options')).body).toEqual({ card: false });
    await api('put', '/cart', { items: [{ productId: PRODUCT_IDS.classic, qty: 1 }] });
    const home = (await api('get', '/addresses')).body.find((a) => a.isDefault);
    const res = await api('post', '/orders', { addressId: home.id, payment: CARD, idempotencyKey: randomUUID() });
    expect(res.status).toBe(503);
    expect(res.body).toMatchObject({ code: 'payment_unavailable', message: expect.stringContaining('cash on delivery') });
    expect(t.mockRof.store.data.orders).toHaveLength(0);
    expect(await t.db('payments')).toHaveLength(0);
    expect((await api('post', '/orders', { addressId: home.id, payment: { method: 'cod' }, idempotencyKey: randomUUID() })).status).toBe(201);
  });

  test('RSOF not ready / API not live: off, checked at most once a minute, back on by itself, and the check creates nothing', async () => {
    await start();
    await fault({ paymentLinkHttp: 404 });
    expect((await api('get', '/checkout/payment-options')).body).toEqual({ card: false });
    await fault({ paymentLinkHttp: null });
    const calls = linkCalls();
    seconds(30);
    expect((await api('get', '/checkout/payment-options')).body).toEqual({ card: false }); // remembered
    expect(linkCalls()).toBe(calls);
    seconds(31);
    expect((await api('get', '/checkout/payment-options')).body).toEqual({ card: true });
    expect(t.mockRof.store.data.paymentLinks ?? {}).toEqual({});
    expect(t.mockRof.store.data.orders).toHaveLength(0);
    await fault({ paymentOutcome: 'NotReady' }); // e.g. the payment gateway token is not entered in RSOF yet
    seconds(5 * 60 + 1);
    expect((await api('get', '/checkout/payment-options')).body).toEqual({ card: false });
  });

  test('a page request that fails during the day switches it off for new orders until RSOF answers again', async () => {
    await start();
    const order = await placeTestOrder(t, me);
    seconds(10);
    await fault({ paymentLinkHttp: 500 });
    expect((await api('post', `/orders/${order.id}/pay`)).status).toBe(503);
    expect((await api('get', '/checkout/payment-options')).body).toEqual({ card: false });
  });

  test('payment options need a signed-in customer', async () => {
    await start();
    expect((await request(t.app).get('/api/v1/checkout/payment-options')).status).toBe(401);
  });
});

describe('who can ask for a page', () => {
  test('cash on delivery and pay-at-branch orders are not paid online', async () => {
    await start();
    const order = await placeTestOrder(t, me, { payment: { method: 'cod' } });
    expect(await api('post', `/orders/${order.id}/pay`)).toMatchObject({ status: 409, body: { code: 'not_payable' } });
  });

  test("another customer's order, an unknown one or no sign-in: not found / refused", async () => {
    await start();
    const order = await placeTestOrder(t, me);
    const other = await signUp(t.app, { phone: '559876543' });
    expect((await api('post', `/orders/${order.id}/pay`, undefined, other)).status).toBe(404);
    expect((await api('post', `/orders/${randomUUID()}/pay`)).status).toBe(404);
    expect((await request(t.app).post(`/api/v1/orders/${order.id}/pay`)).status).toBe(401);
  });

  test('a cancelled order has no page any more', async () => {
    await start();
    const order = await placeTestOrder(t, me);
    expect((await api('post', `/orders/${order.id}/cancel`)).status).toBe(200);
    expect(await api('post', `/orders/${order.id}/pay`)).toMatchObject({ status: 409, body: { code: 'not_payable' } });
  });

  test('the same checkout key twice: one order, one payment, the same order back', async () => {
    await start();
    await api('put', '/cart', { items: [{ productId: PRODUCT_IDS.classic, qty: 1 }] });
    const home = (await api('get', '/addresses')).body.find((a) => a.isDefault);
    const body = { addressId: home.id, payment: CARD, idempotencyKey: randomUUID() };
    const first = await api('post', '/orders', body);
    const second = await api('post', '/orders', body);
    expect([first.status, second.status]).toEqual([201, 200]);
    expect(second.body.id).toBe(first.body.id);
    expect(t.mockRof.store.data.orders).toHaveLength(1);
    expect(await t.db('payments')).toHaveLength(1);
  });
});

describe("Pay now on the order details (decided from RSOF's own payment status)", () => {
  const setPayment = (word) => {
    t.mockRof.store.data.orders[0].paymentStatus = word;
    seconds(60);
  };

  test('RSOF says the payment is not done: canPay is true and the first step says "Order placed", not "Order confirmed"', async () => {
    await start();
    const order = await placeTestOrder(t, me);
    for (const word of ['LinkSent', 'Pending', 'Failed', 'Expired']) {
      setPayment(word);
      const detail = (await api('get', `/orders/${order.id}?refresh=true`)).body;
      expect(detail.canPay, word).toBe(true);
      expect(detail.steps[0].title, word).toBe('Order placed');
    }
    expect((await api('get', '/orders')).body[0].canPay).toBe(true); // the list says the same
  });

  test('paid, refunded, no status from RSOF, cancelled or not an online payment: no Pay now and the normal step name', async () => {
    await start();
    const order = await placeTestOrder(t, me);
    for (const word of ['Paid', 'Refunded', null]) {
      setPayment(word);
      const detail = (await api('get', `/orders/${order.id}?refresh=true`)).body;
      expect(detail.canPay, String(word)).toBe(false);
      expect(detail.steps[0].title, String(word)).toBe('Order confirmed');
    }
    setPayment('LinkSent');
    expect((await api('post', `/orders/${order.id}/cancel`)).status).toBe(200);
    expect((await api('get', `/orders/${order.id}?refresh=true`)).body.canPay).toBe(false);
    const cash = await placeTestOrder(t, me, { payment: { method: 'cod' } });
    t.mockRof.store.data.orders[1].paymentStatus = 'LinkSent';
    seconds(60);
    expect((await api('get', `/orders/${cash.id}?refresh=true`)).body.canPay).toBe(false);
  });
});

describe('cancelling an online-payment order', () => {
  test('the payment record is voided, RSOF is not asked about the payment, and the message promises only "the store handles your refund"', async () => {
    await start();
    const order = await placeTestOrder(t, me);
    const calls = linkCalls();
    const res = await api('post', `/orders/${order.id}/cancel`);
    expect(res.status).toBe(200);
    expect(res.body.payment.status).toBe('cancelled');
    expect(linkCalls()).toBe(calls); // no extra RSOF call
    expect((await payment()).status).toBe('voided');
    expect((await t.db('notifications').where({ type: 'cancelled' }).first()).body).toBe('Your order was cancelled. If you already paid online, the store will handle your refund.');
  });

  test('cancelled in RSOF by staff: the poller records it the same way, with no payment call', async () => {
    await start();
    await placeTestOrder(t, me);
    t.mockRof.store.data.orders[0].status = 'Canceled';
    const calls = linkCalls();
    t.clock.advance(60_000);
    await t.ctx.orders.refresh(await t.db('orders').first());
    expect(linkCalls()).toBe(calls);
    expect((await payment()).status).toBe('voided');
    expect((await t.db('notifications').where({ type: 'cancelled' }).first()).body).toBe('Your order was cancelled. If you already paid online, the store will handle your refund.');
  });
});
