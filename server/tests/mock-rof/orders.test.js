import request from 'supertest';
import { beforeEach, describe, expect, test } from 'vitest';
import { BRANCH_IDS, PRODUCT_IDS } from '../../mock-rof/seed.js';
import { createMockRofHarness } from '../helpers/mockRof.js';

let rof;
beforeEach(() => {
  rof = createMockRofHarness();
});

const orderBody = (items = [{ productId: PRODUCT_IDS.classic, quantity: 1 }]) => ({
  customerName: 'Sara Al-Mutairi',
  phoneNumber: '966501234821',
  customerEmail: 'sara.m@example.com',
  address: 'Building 14, King Fahd Rd, Al Rakah, Al Khobar 34445',
  city: 'Al Khobar',
  remarks: 'Leave at the gate',
  source: 'MobileApp',
  fulfillmentType: 'Delivery',
  items,
});

async function createOrder(items) {
  const res = await rof.call('post', '/api/orders/manual', orderBody(items));
  return res.body;
}

describe('fake ROF — create and assign', () => {
  test('create order → Created with orderNumber 20418, then 20419', async () => {
    const first = await createOrder();
    expect(first).toMatchObject({ success: true, message: 'Order created' });
    expect(first.data).toMatchObject({
      orderNumber: 20418,
      status: 'Created',
      customerName: 'Sara Al-Mutairi',
      assignedToBranch: null,
      items: [{ productId: PRODUCT_IDS.classic, quantity: 1 }],
    });
    expect(first.data.id).toMatch(/^[0-9a-f-]{36}$/);
    expect((await createOrder()).data.orderNumber).toBe(20419);
  });

  test('quantity above total stock → success:false with the guide message', async () => {
    const res = await createOrder([{ productId: PRODUCT_IDS.classic, quantity: 301 }]);
    expect(res).toEqual({ success: false, message: 'Only 300 of "Truffle Box · Classic" available (requested 301)' });
  });

  test('inactive product or quantity 0 is refused', async () => {
    expect((await createOrder([{ productId: PRODUCT_IDS.inactive, quantity: 1 }])).success).toBe(false);
    expect((await createOrder([{ productId: PRODUCT_IDS.classic, quantity: 0 }])).success).toBe(false);
  });

  test('assign: Corniche refuses Praline with "Only 0 of"; Dhahran accepts and reserves stock', async () => {
    const order = (await createOrder([{ productId: PRODUCT_IDS.praline, quantity: 2 }])).data;
    const refused = await rof.call('put', `/api/orders/${order.id}/assign/branch?BranchId=${BRANCH_IDS.corniche}`);
    expect(refused.body).toEqual({ success: false, message: 'Only 0 of "Truffle Box · Praline" available' });
    const accepted = await rof.call('put', `/api/orders/${order.id}/assign/branch?BranchId=${BRANCH_IDS.dhahran}`);
    expect(accepted.body).toEqual({ success: true, message: 'Order assigned to branch', data: null });
    expect(rof.store.data.stock[PRODUCT_IDS.praline][BRANCH_IDS.dhahran]).toBe(48);
  });
});

describe('fake ROF — reading orders', () => {
  test('order detail uses numeric timeline statuses; timeline endpoint uses names, oldest first', async () => {
    const order = (await createOrder()).data;
    await rof.call('put', `/api/orders/${order.id}/assign/branch?BranchId=${BRANCH_IDS.corniche}`);
    const detail = (await rof.call('get', `/api/orders/${order.id}`)).body.data;
    expect(detail).toMatchObject({
      orderNumber: 20418,
      status: 'AssignedToBranch',
      assignedToBranch: BRANCH_IDS.corniche,
      assignBranchName: 'Kuraat · Al Khobar Corniche',
      fulfillmentType: null,
      products: [{ productId: PRODUCT_IDS.classic, productName: 'Truffle Box · Classic', quantity: 1 }],
    });
    expect(detail.timeline.at(-1)).toMatchObject({ statusFrom: 0, statusTo: 3, remarks: 'Assigned to branch' });

    const timeline = (await rof.call('get', `/api/orders/${order.id}/timeline`)).body.data;
    expect(timeline.map((r) => r.statusTo)).toEqual(['Created', 'AssignedToBranch']);
    expect(timeline[1]).toMatchObject({ statusFrom: 'Created', statusToLabel: 'Assigned To Branch', createdBy: 'mock' });
  });

  test('unknown order → success:false "Order not found"', async () => {
    const res = await rof.call('get', '/api/orders/00000000-0000-0000-0000-000000000000');
    expect(res.body).toEqual({ success: false, message: 'Order not found' });
  });

  test('by-phone matches the last 8 digits, first item only, price 0', async () => {
    await createOrder([
      { productId: PRODUCT_IDS.classic, quantity: 1 },
      { productId: PRODUCT_IDS.croissant, quantity: 2 },
    ]);
    const res = await rof.call('get', '/api/orders/by-phone/0501234821');
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0]).toMatchObject({ id: '#ORD-20418', product: 'Truffle Box · Classic', qty: 1, price: 0, status: 'In Progress' });
  });
});

describe('fake ROF — cancel, resend code, dev controls', () => {
  test('cancel returns reserved stock; a delivered order cannot be cancelled', async () => {
    const order = (await createOrder([{ productId: PRODUCT_IDS.classic, quantity: 3 }])).data;
    await rof.call('put', `/api/orders/${order.id}/assign/branch?BranchId=${BRANCH_IDS.corniche}`);
    expect(rof.store.data.stock[PRODUCT_IDS.classic][BRANCH_IDS.corniche]).toBe(47);
    const cancelled = await rof.call('put', `/api/orders/${order.id}/cancel`);
    expect(cancelled.body).toMatchObject({ success: true, message: 'Order cancelled' });
    expect(rof.store.data.stock[PRODUCT_IDS.classic][BRANCH_IDS.corniche]).toBe(50);

    const second = (await createOrder()).data;
    await rof.call('put', `/api/orders/${second.id}/assign/branch?BranchId=${BRANCH_IDS.corniche}`);
    await request(rof.app).post('/__dev/orders/20419/advance').send({ status: 'Delivered' });
    const refused = await rof.call('put', `/api/orders/${second.id}/cancel`);
    expect(refused.body).toEqual({ success: false, message: 'A completed or already cancelled order cannot be cancelled' });
  });

  test('resend-otp works only while OutForDelivery', async () => {
    const order = (await createOrder()).data;
    await rof.call('put', `/api/orders/${order.id}/assign/branch?BranchId=${BRANCH_IDS.corniche}`);
    expect((await rof.call('post', `/api/orders/${order.id}/resend-otp`)).body.success).toBe(false);
    await request(rof.app).post('/__dev/orders/20418/advance').send({ status: 'OutForDelivery' });
    expect((await rof.call('post', `/api/orders/${order.id}/resend-otp`)).body).toMatchObject({ success: true });
  });

  test('dev advance walks the status sequence and writes timeline rows', async () => {
    const order = (await createOrder()).data;
    await rof.call('put', `/api/orders/${order.id}/assign/branch?BranchId=${BRANCH_IDS.corniche}`);
    const seen = [];
    for (let i = 0; i < 6; i += 1) seen.push((await request(rof.app).post('/__dev/orders/20418/advance').send({})).body.status);
    expect(seen).toEqual(['BranchAccepted', 'Preparing', 'Prepared', 'AssignedToTechnician', 'OutForDelivery', 'Delivered']);
    const timeline = (await rof.call('get', `/api/orders/${order.id}/timeline`)).body.data;
    expect(timeline).toHaveLength(8);
  });

  test('dev advance refuses an order with no branch', async () => {
    await createOrder();
    const res = await request(rof.app).post('/__dev/orders/20418/advance').send({});
    expect(res.status).toBe(409);
  });

  test('faults: down makes /api calls 503; rotating the token secret makes old tokens 401', async () => {
    await rof.login();
    await request(rof.app).post('/__dev/faults').send({ down: true });
    expect((await rof.call('get', '/api/category/all')).status).toBe(503);
    await request(rof.app).post('/__dev/faults').send({ down: false });
    await request(rof.app).post('/__dev/rotate-token-secret');
    expect((await rof.call('get', '/api/category/all')).status).toBe(401);
  });
});
