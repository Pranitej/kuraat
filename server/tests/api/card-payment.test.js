/**
 * Card payments on RSOF's payment page (19 Nov 2026): the order is placed in RSOF first, the kuraat server asks
 * RSOF for the payment link (POST /api/v1/orders/payment-link, X-Api-Key) and learns "paid" by asking again.
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

describe('paying an order by card on the RSOF page', () => {
  test('the new order comes with the payment page; asking again gives the same live link', async () => {
    await start();
    const order = await placeTestOrder(t, me);
    expect(order.payment).toMatchObject({ method: 'card', status: 'pending', link: expect.stringMatching(/^http:\/\/127\.0\.0\.1:\d+\/en\/pay\/\w+$/) });
    seconds(10);
    const res = await api('post', `/orders/${order.id}/pay`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'pending', link: order.payment.link, expiresAt: order.payment.linkExpiresAt, amount: 185, currency: 'SAR' });
  });

  test('RSOF gets the order number and the account phone (a wrong phone would be refused)', async () => {
    await start();
    const order = await placeTestOrder(t, me);
    const rof = t.mockRof.store.data.orders[0];
    expect(rof.phoneNumber).toBe('966501234821');
    expect(order.number).toBe(`KR-${rof.orderNumber}`);
    expect(t.mockRof.store.data.paymentLinks[rof.orderNumber]).toMatchObject({ paid: false, token: expect.any(String) });
  });

  test('after paying: "paid" once, payment captured with its time, one "Payment received" notification', async () => {
    await start();
    const order = await placeTestOrder(t, me);
    await payOnRsof(t, order.number);
    seconds(30);
    expect((await api('post', `/orders/${order.id}/pay`)).body).toEqual({ status: 'paid' });
    expect(await payment()).toMatchObject({ status: 'captured', paid_at: new Date('2026-11-15T09:21:30.000Z') });
    // Asking again is answered from our record: no RSOF call, no second notification.
    const calls = linkCalls();
    expect((await api('post', `/orders/${order.id}/pay`)).body).toEqual({ status: 'paid' });
    expect(linkCalls()).toBe(calls);
    const notes = await t.db('notifications').where({ type: 'payment' });
    expect(notes).toHaveLength(1);
    expect(notes[0]).toMatchObject({ title: 'Payment received', body: 'SAR 185.00 paid for order #KR-20418.' });
    expect((await api('get', `/orders/${order.id}`)).body.payment).toMatchObject({ status: 'paid', paidAt: '2026-11-15T09:21:30.000Z', link: null });
  });

  test('the order can also be named by its RSOF id', async () => {
    await start();
    const order = await placeTestOrder(t, me);
    const rofId = t.mockRof.store.data.orders[0].id;
    expect((await api('post', `/orders/${rofId}/pay`)).body.status).toBe('pending');
    expect(order.id).not.toBe(rofId);
  });

  test('same-moment asks share one RSOF call; a "waiting" answer is reused for a few seconds only', async () => {
    await start();
    const order = await placeTestOrder(t, me);
    seconds(10);
    const before = linkCalls();
    await Promise.all([api('post', `/orders/${order.id}/pay`), api('post', `/orders/${order.id}/pay`), api('post', `/orders/${order.id}/pay`)]);
    expect(linkCalls()).toBe(before + 1);
    seconds(2);
    await api('post', `/orders/${order.id}/pay`);
    expect(linkCalls()).toBe(before + 1);
    seconds(5);
    await api('post', `/orders/${order.id}/pay`);
    expect(linkCalls()).toBe(before + 2);
  });

  test('an expired link is replaced by a new one', async () => {
    await start();
    const order = await placeTestOrder(t, me);
    t.mockRof.store.data.paymentLinks[20418].expiresAt = t.clock.now().getTime(); // RSOF's link ran out
    seconds(10);
    const res = await api('post', `/orders/${order.id}/pay`);
    expect(res.body.status).toBe('pending');
    expect(res.body.link).not.toBe(order.payment.link);
  });
});

describe('when RSOF cannot give a link', () => {
  test.each([
    ['NotReady', 503, 'payment_not_ready'],
    ['Error', 503, 'payment_unavailable'],
    ['NoPayableOrder', 409, 'not_payable'],
  ])('RSOF answers %s → %i %s; the order and its pending payment stay', async (outcome, status, code) => {
    await start();
    const order = await placeTestOrder(t, me);
    seconds(10);
    await fault({ paymentOutcome: outcome });
    const res = await api('post', `/orders/${order.id}/pay`);
    expect(res.status).toBe(status);
    expect(res.body.code).toBe(code);
    expect(res.body.message).not.toMatch(/RSOF|ROF|outcome/i); // customer wording, no system names
    expect((await payment()).status).toBe('pending');
    expect(await t.db('orders')).toHaveLength(1);
  });

  test.each([
    [500, 'unavailable'],
    [404, 'unavailable'],
    [403, 'auth'],
  ])('RSOF answers HTTP %i → 503 payment_unavailable; logged', async (http) => {
    await start();
    const order = await placeTestOrder(t, me);
    seconds(10);
    await fault({ paymentLinkHttp: http });
    const res = await api('post', `/orders/${order.id}/pay`);
    expect(res).toMatchObject({ status: 503, body: { code: 'payment_unavailable' } });
    expect(t.logs.some(([, line]) => line.includes('[payments] payment link for KR-20418 failed'))).toBe(true);
  });

  test('RSOF has no link right after the order is placed: still placed (201), link null; "Pay now" works later', async () => {
    await start();
    // Card is on (RSOF answered the check a moment ago); then RSOF cannot make this order's link yet.
    expect((await api('get', '/checkout/payment-options')).body).toEqual({ card: true });
    await fault({ paymentOutcome: 'NotReady' });
    const order = await placeTestOrder(t, me);
    expect(order.payment).toMatchObject({ status: 'pending', link: null, linkExpiresAt: null });
    await fault({ paymentOutcome: null });
    seconds(10);
    expect((await api('post', `/orders/${order.id}/pay`)).body).toMatchObject({ status: 'pending', link: expect.any(String) });
  });

  test('a link that is not a safe web page is never handed to the app', async () => {
    await start();
    const order = await placeTestOrder(t, me);
    seconds(10);
    t.ctx.paymentLinks.createLink = async () => ({ outcome: 'LinkReady', paymentLink: 'javascript:alert(1)', amount: 185, currency: 'SAR' });
    const res = await api('post', `/orders/${order.id}/pay`);
    expect(res).toMatchObject({ status: 503, body: { code: 'payment_unavailable' } });
  });
});

describe('card switched off', () => {
  test('no payment API key: card shown as unavailable and refused before anything is created; cash still works', async () => {
    await start({ cardPayments: false });
    expect((await api('get', '/checkout/payment-options')).body).toEqual({ card: false });
    await api('put', '/cart', { items: [{ productId: PRODUCT_IDS.classic, qty: 1 }] });
    const home = (await api('get', '/addresses')).body.find((a) => a.isDefault);
    const res = await api('post', '/orders', { addressId: home.id, payment: CARD, idempotencyKey: randomUUID() });
    expect(res.status).toBe(503);
    expect(res.body).toMatchObject({ code: 'payment_unavailable', message: expect.stringContaining('cash on delivery') });
    expect(t.mockRof.store.data.orders).toHaveLength(0);
    expect(await t.db('payments')).toHaveLength(0);
    const cash = await api('post', '/orders', { addressId: home.id, payment: { method: 'cod' }, idempotencyKey: randomUUID() });
    expect(cash.status).toBe(201);
  });

  test('RSOF payment API not live (404) or the key refused: card is off, checked at most once a minute, back on by itself', async () => {
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
    // The check matches no order, so RSOF made no link and no order.
    expect(t.mockRof.store.data.paymentLinks ?? {}).toEqual({});
    expect(t.mockRof.store.data.orders).toHaveLength(0);
  });

  test('a link request that fails during the day switches card off for new orders until RSOF answers again', async () => {
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

describe('who can pay what', () => {
  test('cash on delivery and pay-at-branch orders are not paid online', async () => {
    await start();
    const order = await placeTestOrder(t, me, { payment: { method: 'cod' } });
    const res = await api('post', `/orders/${order.id}/pay`);
    expect(res).toMatchObject({ status: 409, body: { code: 'not_payable' } });
  });

  test("another customer's order, or an unknown one, is not found", async () => {
    await start();
    const order = await placeTestOrder(t, me);
    const other = await signUp(t.app, { phone: '559876543' });
    expect((await api('post', `/orders/${order.id}/pay`, undefined, other)).status).toBe(404);
    expect((await api('post', `/orders/${randomUUID()}/pay`)).status).toBe(404);
    expect((await request(t.app).post(`/api/v1/orders/${order.id}/pay`)).status).toBe(401);
  });

  test('a cancelled unpaid order cannot be paid any more', async () => {
    await start();
    const order = await placeTestOrder(t, me);
    expect((await api('post', `/orders/${order.id}/cancel`)).status).toBe(200);
    const res = await api('post', `/orders/${order.id}/pay`);
    expect(res).toMatchObject({ status: 409, body: { code: 'not_payable' } });
  });

  test('cancelled in RSOF by staff after the customer paid: recorded as a refund to come, not "nothing charged"', async () => {
    await start();
    const order = await placeTestOrder(t, me);
    await payOnRsof(t, order.number);
    const rof = t.mockRof.store.data.orders[0];
    rof.status = 'Canceled';
    t.clock.advance(60_000);
    await t.ctx.orders.refresh(await t.db('orders').first());
    expect((await payment()).status).toBe('refund_pending');
    expect((await t.db('notifications').where({ type: 'cancelled' }).first()).body).toBe('Your order was cancelled. Your SAR 185.00 card payment will be refunded.');
  });

  test('cancelled in RSOF and RSOF no longer says whether it was paid: the message does not claim nothing was charged', async () => {
    await start();
    await placeTestOrder(t, me);
    t.mockRof.store.data.orders[0].status = 'Canceled';
    await fault({ paymentOutcome: 'NoPayableOrder' });
    t.clock.advance(60_000);
    await t.ctx.orders.refresh(await t.db('orders').first());
    expect((await payment()).status).toBe('voided');
    expect((await t.db('notifications').where({ type: 'cancelled' }).first()).body).toBe('Your order was cancelled. If you already paid by card, your payment will be refunded.');
    expect(t.logs.some(([level, line]) => level === 'warn' && line.includes('could not confirm whether KR-20418 was paid'))).toBe(true);
  });

  test('the same checkout key twice: one order, one payment, the second answer is the same order', async () => {
    await start();
    await api('put', '/cart', { items: [{ productId: PRODUCT_IDS.classic, qty: 1 }] });
    const home = (await api('get', '/addresses')).body.find((a) => a.isDefault);
    const body = { addressId: home.id, payment: CARD, idempotencyKey: randomUUID() };
    const first = await api('post', '/orders', body);
    const second = await api('post', '/orders', body);
    expect([first.status, second.status]).toEqual([201, 200]);
    expect(second.body.id).toBe(first.body.id);
    expect(second.body.payment.status).toBe('pending');
    expect(t.mockRof.store.data.orders).toHaveLength(1);
    expect(await t.db('payments')).toHaveLength(1);
  });
});
