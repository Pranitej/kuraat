import request from 'supertest';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { signInDemo, signUp } from '../helpers/auth.js';
import { createTestContext } from '../helpers/context.js';
import { advance, placePickupTestOrder, placeTestOrder } from '../helpers/orders.js';
import { PRODUCT_IDS } from '../support/rof-double/seed.js';

let t;
let me;
beforeEach(async () => {
  t = await createTestContext({ withRof: true });
  await t.reset();
  me = await signInDemo(t);
});
afterEach(async () => {
  await t?.close();
});

const api = (method, path, as = me.auth) => request(t.app)[method](`/api/v1${path}`).set('Authorization', as);
const minutes = (n) => t.clock.advance(n * 60_000);

describe('order detail and tracking', () => {
  test('reached steps show ROF times; steps not reached yet show no time (no made-up estimates)', async () => {
    const order = await placeTestOrder(t, me);
    minutes(10);
    await advance(t, order.number, 'BranchAccepted');
    await advance(t, order.number, 'Preparing');
    const res = await api('get', `/orders/${order.id}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toEqual({ id: 'preparing', code: 'Preparing', label: 'Preparing', group: 'preparing', step: 1, cancelled: false });
    expect(res.body.steps).toEqual([
      { id: 'confirmed', title: 'Order confirmed', state: 'done', time: '2026-11-15T09:21:00.000Z', timeEnd: null, estimated: false },
      { id: 'preparing', title: 'Preparing at the branch', state: 'current', time: '2026-11-15T09:31:00.000Z', timeEnd: null, estimated: false },
      { id: 'out_for_delivery', title: 'Out for delivery', state: 'todo', time: null, timeEnd: null, estimated: false },
      { id: 'delivered', title: 'Delivered', state: 'todo', time: null, timeEnd: null, estimated: false },
    ]);
    expect(res.body.canCancel).toBe(false);
    expect(res.body.branch).toMatchObject({ name: 'Kuraat · Al Khobar Corniche', phone: '+966 13 555 0110', location: { lat: 26.305709, lng: 50.227336 } });
  });

  test('a delivered order has every step done', async () => {
    const order = await placeTestOrder(t, me);
    minutes(1);
    await advance(t, order.number, 'Delivered');
    const res = await api('get', `/orders/${order.id}`);
    expect(res.body.status.id).toBe('delivered');
    expect(res.body.steps.every((s) => s.state === 'done')).toBe(true);
  });

  test('RSOF is the master: an order cancelled in the app and then set to Preparing in RSOF shows Preparing again', async () => {
    const order = await placeTestOrder(t, me);
    expect((await api('post', `/orders/${order.id}/cancel`)).body.status.cancelled).toBe(true);
    t.mockRof.store.data.orders[0].status = 'Preparing'; // RSOF staff change the status by hand
    minutes(1);
    const detail = await api('get', `/orders/${order.id}`);
    expect(detail.body.status).toMatchObject({ code: 'Preparing', cancelled: false });
    expect(detail.body.canCancel).toBe(false);
    expect((await api('get', '/orders')).body[0].status).toMatchObject({ code: 'Preparing', cancelled: false });
    expect((await api('get', '/orders?tab=ongoing')).body).toHaveLength(1);
  });

  test('the history hides RSOF\'s internal notes and note-only rows (same status before and after), keeping the first row', async () => {
    const order = await placeTestOrder(t, me);
    const rofOrder = t.mockRof.store.data.orders[0];
    const at = (n) => new Date(Date.parse(rofOrder.timeline[0].createdOn) + n * 1000).toISOString();
    // Real RSOF rows seen on UAT: a repeated "location shared", and a payment-link log line that is not a status change.
    rofOrder.timeline.push(
      { statusFrom: 'SharedLocationManually', statusTo: 'SharedLocationManually', remarks: 'Location shared by customer', createdOn: at(5) },
      { statusFrom: 'Created', statusTo: 'Created', remarks: 'Payment link for 110.00 SAR created, but the WhatsApp message was not sent: the company has no active WhatsApp number.', createdOn: at(9) },
    );
    minutes(1);
    const res = await api('get', `/orders/${order.id}`);
    const shown = res.body.history.map((h) => h.label);
    expect(shown[0]).toBe('Order placed');
    expect(shown.filter((l) => l === 'Order placed')).toHaveLength(1); // the payment-link line is not a second "Order placed"
    expect(JSON.stringify(res.body)).not.toMatch(/WhatsApp|company has no|Payment link/i);
  });

  test('RSOF refusing to cancel or to resend the code gives fixed sentences, not RSOF\'s own text', async () => {
    const order = await placeTestOrder(t, me);
    await advance(t, order.number, 'Preparing');
    const cancel = await api('post', `/orders/${order.id}/cancel`);
    expect(cancel.status).toBe(409);
    expect(cancel.body.message).toBe('This order can no longer be cancelled.');
    const resend = await api('post', `/orders/${order.id}/resend-code`);
    expect(resend.status).toBe(409);
    expect(resend.body.message).toBe('The delivery code can be resent only while your order is out for delivery.');
  });

  test('the history lists every status RSOF recorded, so the cancellation stays visible after RSOF reopens the order', async () => {
    const order = await placeTestOrder(t, me);
    minutes(1);
    expect((await api('post', `/orders/${order.id}/cancel`)).status).toBe(200);
    minutes(1);
    // RSOF staff reopen it by hand (the stand-in only walks live orders, the real RSOF accepts any status).
    const rofOrder = t.mockRof.store.data.orders[0];
    rofOrder.timeline.push({ statusFrom: 'Canceled', statusTo: 'Preparing', remarks: 'Reopened', createdBy: 'staff', createdOn: t.clock.now().toISOString() });
    rofOrder.status = 'Preparing';
    // The test clock stands still within a minute: give each row its own second, as real RSOF stamps in milliseconds.
    rofOrder.timeline.forEach((r, i) => { r.createdOn = new Date(Date.parse(r.createdOn) + i * 1000).toISOString(); });
    rofOrder.timeline.reverse(); // real RSOF sends its timeline in no particular order
    minutes(1);
    const res = await api('get', `/orders/${order.id}`);
    expect(res.body.status).toMatchObject({ code: 'Preparing', cancelled: false });
    const times = res.body.history.map((h) => h.time);
    expect(times).toEqual([...times].sort()); // oldest first, whatever order RSOF used
    const labels = res.body.history.map((h) => h.label);
    expect(labels.slice(-2)).toEqual(['Cancelled', 'Preparing']);
    // RSOF's own notes ("Reopened", staff names, system messages) never reach the customer
    expect(res.body.history.every((h) => h.note === null)).toBe(true);
    expect(JSON.stringify(res.body)).not.toMatch(/Reopened|staff/i);
    expect(labels[0]).toBe('Order placed');
    expect(res.body.history.find((h) => h.label === 'Cancelled')).toMatchObject({ id: 'Canceled', cancelled: true });
    expect(res.body.history.every((h) => typeof h.time === 'string')).toBe(true);
  });

  test('a delivered order is read again too, and the refresh button always asks RSOF', async () => {
    const order = await placeTestOrder(t, me);
    minutes(1);
    await advance(t, order.number, 'Delivered');
    expect((await api('get', `/orders/${order.id}`)).body.status.id).toBe('delivered');
    const reads = vi.spyOn(t.ctx.rof, 'getOrder');
    await api('get', `/orders/${order.id}`); // within the short cache: no new RSOF call
    expect(reads).not.toHaveBeenCalled();
    t.mockRof.store.data.orders[0].status = 'OutForDelivery'; // set back by RSOF staff
    minutes(1);
    const res = await api('get', `/orders/${order.id}?refresh=true`);
    expect(res.body.status.id).toBe('out_for_delivery');
    expect(reads).toHaveBeenCalledTimes(1);
  });

  test('simultaneous refreshes of one order share a single RSOF read (2 calls, not 6)', async () => {
    const order = await placeTestOrder(t, me);
    minutes(1);
    await advance(t, order.number, 'Preparing');
    const row = await t.db('orders').where({ id: order.id }).first();
    const reads = vi.spyOn(t.ctx.rof, 'getOrder');
    const timeline = vi.spyOn(t.ctx.rof, 'getOrderTimeline');
    const results = await Promise.all([t.ctx.orders.refresh(row), t.ctx.orders.refresh(row), t.ctx.orders.refresh(row)]);
    expect(reads).toHaveBeenCalledTimes(1);
    expect(timeline).toHaveBeenCalledTimes(1);
    expect(results.map((r) => r.step)).toEqual([1, 1, 1]);
    // The next refresh after the shared read is finished asks RSOF again (nothing is cached for good).
    await t.ctx.orders.refresh(row);
    expect(reads).toHaveBeenCalledTimes(2);
  });

  test('an unknown ROF status keeps the last known step', async () => {
    const order = await placeTestOrder(t, me);
    minutes(1);
    await advance(t, order.number, 'Preparing');
    expect((await api('get', `/orders/${order.id}`)).body.status.step).toBe(1);
    t.mockRof.store.data.orders[0].status = 'TransferRequested';
    minutes(1);
    const res = await api('get', `/orders/${order.id}`);
    expect(res.body.status.step).toBe(1);
    expect(t.logs.some(([level, line]) => level === 'warn' && line.includes('TransferRequested'))).toBe(true);
  });

  test('RSOF is the master: with RSOF down there is no saved copy to show, the apps get 503', async () => {
    const order = await placeTestOrder(t, me);
    await request(t.mockRof.app).post('/__dev/faults').send({ down: true });
    minutes(1);
    const res = await api('get', `/orders/${order.id}`);
    expect(res.status).toBe(503);
    expect(res.body.code).toBe('rof_unavailable');
    expect((await api('get', '/orders')).status).toBe(503);
  });

  test("another user's order → 404", async () => {
    const order = await placeTestOrder(t, me);
    const other = await signUp(t.app);
    expect((await api('get', `/orders/${order.id}`, other.auth)).status).toBe(404);
  });
});

describe('payment receipt fields', () => {
  test('an online-payment order says how it is paid, never whether it was paid (RSOF knows); the page is never stored', async () => {
    const order = await placeTestOrder(t, me);
    expect(order.payment).toMatchObject({ method: 'card', status: 'online', paidAt: null, transactionId: null });
    const [listed] = (await api('get', '/orders')).body;
    expect(listed.id).toBe(order.id); // one order, one id: the app never shows it twice
    expect(listed.payment).toMatchObject({ status: 'online', link: null });
  });

  test('RSOF\'s own payment status is passed through on the order (detail and list); no status when RSOF has none', async () => {
    const order = await placeTestOrder(t, me);
    expect((await api('get', `/orders/${order.id}`)).body.paymentStatus).toBeNull(); // nothing paid yet: nothing shown
    t.mockRof.store.data.orders[0].paymentStatus = 'Paid';
    minutes(1);
    expect((await api('get', `/orders/${order.id}`)).body.paymentStatus).toEqual({ code: 'Paid', label: 'Paid' });
    t.mockRof.store.data.orders[0].paymentStatus = 'PartiallyPaid';
    minutes(1);
    expect((await api('get', '/orders')).body[0].paymentStatus).toEqual({ code: 'PartiallyPaid', label: 'Partly paid' });
  });

  test('cash on delivery has no transaction id and no payment time', async () => {
    const order = await placeTestOrder(t, me, { payment: { method: 'cod' } });
    expect(order.payment).toMatchObject({ method: 'cod', transactionId: null, paidAt: null });
  });
});

describe('order list tabs', () => {
  test('ongoing excludes delivered and cancelled; delivered = step 3; all = everything, newest first', async () => {
    const delivered = await placeTestOrder(t, me);
    minutes(1);
    const cancelled = await placeTestOrder(t, me);
    minutes(1);
    const ongoing = await placeTestOrder(t, me);
    await advance(t, delivered.number, 'Delivered');
    expect((await api('post', `/orders/${cancelled.id}/cancel`)).status).toBe(200);
    minutes(1);

    const ids = async (tab) => (await api('get', `/orders${tab ? `?tab=${tab}` : ''}`)).body.map((o) => o.id);
    expect(await ids('ongoing')).toEqual([ongoing.id]);
    expect(await ids('delivered')).toEqual([delivered.id]);
    expect(await ids('all')).toEqual([ongoing.id, cancelled.id, delivered.id]);
    expect(await ids()).toEqual([ongoing.id, cancelled.id, delivered.id]);
  });
});

describe('refresh button (design 2026-11-18 §5.4)', () => {
  const setRofStatus = (status) => {
    t.mockRof.store.data.orders[0].status = status;
  };
  const listLabel = async (query = '') => (await api('get', `/orders${query}`)).body[0].status.label;

  test('refresh=true re-reads ROF at once instead of using the 30 s cache', async () => {
    await placeTestOrder(t, me);
    expect(await listLabel()).toBe('Sent to branch');
    setRofStatus('Preparing');
    expect(await listLabel()).toBe('Sent to branch');
    expect(await listLabel('?refresh=true')).toBe('Preparing');
  });

  test('refresh is throttled to once per 10 s per customer', async () => {
    await placeTestOrder(t, me);
    await listLabel();
    setRofStatus('Preparing');
    expect(await listLabel('?refresh=true')).toBe('Preparing');
    setRofStatus('Prepared');
    expect(await listLabel('?refresh=true')).toBe('Preparing');
    t.clock.advance(10_000);
    expect(await listLabel('?refresh=true')).toBe('Packed, waiting for a rider');
  });

  test('an unknown numeric ROF status keeps the last step and label, and the list still loads', async () => {
    await placeTestOrder(t, me);
    expect(await listLabel()).toBe('Sent to branch');
    setRofStatus(22);
    minutes(1);
    const res = await api('get', '/orders');
    expect(res.status).toBe(200);
    expect(res.body[0].status).toMatchObject({ code: 'AssignedToBranch', label: 'Sent to branch', step: 0 });
    expect(t.logs.some(([level, line]) => level === 'warn' && line.includes('22'))).toBe(true);
  });

  test('a blank ROF status keeps the last known one too', async () => {
    await placeTestOrder(t, me);
    await listLabel();
    setRofStatus('');
    minutes(1);
    const res = await api('get', '/orders');
    expect(res.status).toBe(200);
    expect(res.body[0].status.label).toBe('Sent to branch');
  });

  test('refresh while ROF is down says so (503) and does not use up the 10 s slot', async () => {
    const order = await placeTestOrder(t, me);
    await listLabel();
    await request(t.mockRof.app).post('/__dev/faults').send({ down: true });
    const forced = await api('get', '/orders?refresh=true');
    expect(forced.status).toBe(503);
    expect(forced.body.code).toBe('rof_unavailable');
    expect((await api('get', '/orders')).status).toBe(200);
    expect((await api('get', `/orders/${order.id}?refresh=true`)).status).toBe(503);
    await request(t.mockRof.app).post('/__dev/faults').send({ down: false });
    setRofStatus('Preparing');
    expect(await listLabel('?refresh=true')).toBe('Preparing');
  });

  test('the order detail refreshes on demand too', async () => {
    const order = await placeTestOrder(t, me);
    await api('get', `/orders/${order.id}`);
    setRofStatus('Preparing');
    expect((await api('get', `/orders/${order.id}`)).body.status.label).toBe('Sent to branch');
    expect((await api('get', `/orders/${order.id}?refresh=true`)).body.status.label).toBe('Preparing');
  });
});

describe('orders from every channel, straight from RSOF by mobile number', () => {
  const createInRof = (phoneNumber, extra = {}) =>
    t.mockRof.call('post', '/api/orders/manual', {
      customerName: 'Lead',
      phoneNumber,
      address: 'Walk-in, Al Khobar',
      city: 'Al Khobar',
      source: 'WhatsApp',
      fulfillmentType: 'Delivery',
      items: [{ productId: PRODUCT_IDS.classic, quantity: 2 }],
      ...extra,
    });

  test('an order made in RSOF (WhatsApp) with the customer number shows in the list and detail, with the prices RSOF stamped', async () => {
    const made = (await createInRof('966501234821')).body.data;
    const listed = (await api('get', '/orders')).body;
    expect(listed).toHaveLength(1);
    expect(listed[0]).toMatchObject({
      id: made.id,
      number: `KR-${made.orderNumber}`,
      deliveryPhone: '+966501234821',
      payment: null,
      canCancel: false,
      canResendCode: false,
    });
    expect(listed[0].items).toEqual([expect.objectContaining({ productId: PRODUCT_IDS.classic, qty: 2, price: expect.any(Number) })]);
    expect(listed[0].total).toBe(listed[0].items[0].price * 2);
    const detail = await api('get', `/orders/${made.id}`);
    expect(detail.status).toBe(200);
    expect(detail.body).toMatchObject({ id: made.id, number: listed[0].number, total: listed[0].total });
  });

  test('app orders and RSOF orders are one list, newest first, and an app order can still be cancelled', async () => {
    const first = (await createInRof('966501234821')).body.data;
    minutes(1);
    const placed = await placeTestOrder(t, me);
    const listed = (await api('get', '/orders')).body;
    expect(listed.map((o) => o.number)).toEqual([placed.number, `KR-${first.orderNumber}`]);
    expect(listed[0].canCancel).toBe(true);
    expect(listed[1].canCancel).toBe(false);
    expect((await api('post', `/orders/${listed[0].id}/cancel`)).body.status.id).toBe('cancelled');
  });

  test('another customer number is not shown: not in the list, 404 in detail (even when RSOF matches on the last digits)', async () => {
    const theirs = (await createInRof('966559998877')).body.data;
    const loose = (await createInRof('971501234821')).body.data; // same last 9 digits, other country
    expect((await api('get', '/orders')).body).toEqual([]);
    expect((await api('get', `/orders/${theirs.id}`)).status).toBe(404);
    expect((await api('get', `/orders/${loose.id}`)).status).toBe(404);
  });

  test('the list is read from RSOF with one by-phone call and one detail call per order, then cached for 30 s', async () => {
    await createInRof('966501234821');
    await createInRof('966501234821');
    const byPhone = vi.spyOn(t.ctx.rof, 'listOrdersByPhone');
    const detail = vi.spyOn(t.ctx.rof, 'getOrder');
    expect((await api('get', '/orders')).body).toHaveLength(2);
    expect(byPhone).toHaveBeenCalledTimes(1);
    expect(detail).toHaveBeenCalledTimes(2);
    await api('get', '/orders');
    expect(byPhone).toHaveBeenCalledTimes(1);
    expect(detail).toHaveBeenCalledTimes(2);
  });
});

describe('pickup orders through RSOF (design 2026-11-18 §5.3)', () => {
  test('the RSOF stand-in walks a pickup order to PickUpByCustomer, never to a courier', async () => {
    const order = await placePickupTestOrder(t, me);
    const names = [];
    for (let i = 0; i < 4; i += 1) names.push((await advance(t, order.number)).body.status);
    expect(names).toEqual(['BranchAccepted', 'Preparing', 'Prepared', 'PickUpByCustomer']);
  });

  test('Prepared is "Ready for pickup" (step 3 of the pickup tracker); PickUpByCustomer is "Picked up"', async () => {
    const order = await placePickupTestOrder(t, me);
    await advance(t, order.number, 'Prepared');
    let res = await api('get', `/orders/${order.id}?refresh=true`);
    expect(res.body.status).toMatchObject({ id: 'ready_for_pickup', code: 'Prepared', label: 'Ready for pickup', group: 'ready', step: 2 });
    expect(res.body.steps.map((x) => x.state)).toEqual(['done', 'done', 'current', 'todo']);
    expect(res.body.canCancel).toBe(false);
    t.clock.advance(11_000);
    await advance(t, order.number, 'PickUpByCustomer');
    res = await api('get', `/orders/${order.id}?refresh=true`);
    expect(res.body.status).toMatchObject({ id: 'picked_up', label: 'Picked up', group: 'completed', step: 3 });
    expect(res.body.steps.every((x) => x.state === 'done')).toBe(true);
    expect(res.body.steps[3].time).toBeTruthy();
  });

  test('a delivery order still reads "Packed, waiting for a rider" on Prepared (unchanged)', async () => {
    const order = await placeTestOrder(t, me);
    await advance(t, order.number, 'Prepared');
    const res = await api('get', `/orders/${order.id}?refresh=true`);
    expect(res.body.status).toMatchObject({ id: 'preparing', label: 'Packed, waiting for a rider', step: 1 });
  });
});

describe('cancel', () => {
  test('in step 0: cancelled in ROF and notified (an online payment is RSOF\'s: "the store handles your refund")', async () => {
    const order = await placeTestOrder(t, me);
    const res = await api('post', `/orders/${order.id}/cancel`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: { id: 'cancelled', label: 'Cancelled', cancelled: true }, canCancel: false });
    expect(t.mockRof.store.data.orders[0].status).toBe('Canceled');
    expect((await t.db('payments').first()).status).toBe('voided');
    const note = await t.db('notifications').where({ type: 'cancelled' }).first();
    expect(note).toMatchObject({ title: `Order #${order.number} cancelled` });
    expect(note.body).toBe('Your order was cancelled. If you already paid online, the store will handle your refund.');
  });

  test('after Preparing → 409 cannot_cancel and nothing changes in ROF', async () => {
    const order = await placeTestOrder(t, me);
    await advance(t, order.number, 'Preparing');
    const res = await api('post', `/orders/${order.id}/cancel`);
    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ code: 'cannot_cancel', message: 'This order can no longer be cancelled.' });
    expect(t.mockRof.store.data.orders[0].status).toBe('Preparing');
  });

  test('cash on delivery is voided, not refunded', async () => {
    const order = await placeTestOrder(t, me, { payment: { method: 'cod' } });
    await api('post', `/orders/${order.id}/cancel`);
    expect((await t.db('payments').first()).status).toBe('voided');
    expect((await t.db('notifications').where({ type: 'cancelled' }).first()).body).toBe('Your order was cancelled.');
  });
});

describe('delivery code', () => {
  test('resend only while OutForDelivery; twice within 60 s → 429', async () => {
    const order = await placeTestOrder(t, me);
    expect((await api('post', `/orders/${order.id}/resend-code`)).body.code).toBe('cannot_resend');
    await advance(t, order.number, 'OutForDelivery');
    minutes(1);
    const first = await api('post', `/orders/${order.id}/resend-code`);
    expect(first.status).toBe(200);
    expect(first.body).toEqual({ sent: true, resendAt: '2026-11-15T09:23:00.000Z' });
    const second = await api('post', `/orders/${order.id}/resend-code`);
    expect(second.status).toBe(429);
    expect(second.body.code).toBe('resend_too_soon');
    minutes(1);
    expect((await api('post', `/orders/${order.id}/resend-code`)).status).toBe(200);
  });
});
