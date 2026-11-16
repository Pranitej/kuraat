import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, expect, test } from 'vitest';
import { BRANCH_IDS, DEMO_ORDERS, PRODUCT_IDS, createSeed } from '../../mock-rof/seed.js';
import { loadStore } from '../../mock-rof/store.js';
import { createMockRofHarness } from '../helpers/mockRof.js';

const NOW = new Date('2026-11-16T09:00:00Z'); // 12:00 in Saudi Arabia

let rof;
beforeEach(() => {
  rof = createMockRofHarness({ data: createSeed({ now: NOW }) });
});

describe('fake ROF — the demo customer’s delivered orders (PDF KR-20377, KR-20291)', () => {
  test('KR-20377: delivered from Corniche, cheesecake ×2 and cinnamon roll ×1', async () => {
    const res = await rof.call('get', `/api/orders/${DEMO_ORDERS[0].id}`);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({
      orderNumber: 20377,
      status: 'Delivered',
      customerName: 'Sara Al-Mutairi',
      phoneNumber: '966501234821',
      assignedToBranch: BRANCH_IDS.corniche,
    });
    expect(res.body.data.products).toEqual([
      expect.objectContaining({ productId: PRODUCT_IDS.cheesecake, quantity: 2 }),
      expect.objectContaining({ productId: PRODUCT_IDS.cinnamon, quantity: 1 }),
    ]);
  });

  test('KR-20291: delivered from Dhahran, Praline ×1', async () => {
    const res = await rof.call('get', `/api/orders/${DEMO_ORDERS[1].id}`);
    expect(res.body.data).toMatchObject({ orderNumber: 20291, status: 'Delivered', assignedToBranch: BRANCH_IDS.dhahran });
    expect(res.body.data.products).toEqual([expect.objectContaining({ productId: PRODUCT_IDS.praline, quantity: 1 })]);
  });

  test('created at the PDF times (Saudi), 7 and 17 days before now', () => {
    const seed = createSeed({ now: NOW });
    const at = (n) => seed.orders.find((o) => o.orderNumber === n).createdOn;
    expect(at(20377)).toBe('2026-11-09T10:05:00.000Z'); // 13:05 Saudi
    expect(at(20291)).toBe('2026-10-30T08:40:00.000Z'); // 11:40 Saudi
  });

  test('the timeline walks the happy path and ends Delivered 347 minutes after creation', async () => {
    const res = await rof.call('get', `/api/orders/${DEMO_ORDERS[0].id}/timeline`);
    expect(res.body.data.map((r) => r.statusTo)).toEqual([
      'Created',
      'AssignedToBranch',
      'BranchAccepted',
      'Preparing',
      'Prepared',
      'AssignedToTechnician',
      'OutForDelivery',
      'Delivered',
    ]);
    expect(res.body.data.at(-1).createdOn).toBe('2026-11-09T15:52:00.000Z');
  });

  test('new orders are still numbered from 20418', () => {
    expect(createSeed({ now: NOW }).nextOrderNumber).toBe(20418);
  });

  test('a seed without demo orders has no orders', () => {
    expect(createSeed({ now: NOW, withDemoOrders: false }).orders).toEqual([]);
  });
});

describe('fake ROF — saved state from before the demo orders existed', () => {
  test('loading it adds the missing demo orders and keeps everything else', () => {
    const dir = mkdtempSync(join(tmpdir(), 'mock-rof-'));
    const file = join(dir, 'state.json');
    const old = createSeed({ now: NOW, withDemoOrders: false });
    old.orders.push({ id: 'keep-me', orderNumber: 20418, status: 'Created', items: [], timeline: [] });
    old.nextOrderNumber = 20419;
    writeFileSync(file, JSON.stringify(old));

    const store = loadStore(file);
    expect(store.data.orders.map((o) => o.orderNumber).sort()).toEqual([20291, 20377, 20418]);
    expect(store.data.nextOrderNumber).toBe(20419);
    expect(JSON.parse(readFileSync(file, 'utf8')).orders).toHaveLength(3); // saved back
  });

  test('a state that already has them is left alone', () => {
    const dir = mkdtempSync(join(tmpdir(), 'mock-rof-'));
    const file = join(dir, 'state.json');
    const saved = createSeed({ now: NOW });
    saved.orders[0].status = 'Delivered'; // unchanged marker
    writeFileSync(file, JSON.stringify(saved));
    expect(loadStore(file).data.orders).toHaveLength(2);
  });
});
