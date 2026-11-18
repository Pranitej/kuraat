import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { runRofCheck } from '../../src/rof/check.js';
import { productDetailSchema } from '../../src/rof/schemas.js';
import { createMockRofHarness } from '../helpers/mockRof.js';

let rof;
let server;
let lines;
const log = (line) => lines.push(line);

beforeEach(async () => {
  rof = createMockRofHarness({ now: () => new Date() });
  server = await rof.listen();
  lines = [];
});
afterEach(async () => {
  await server.close();
});

const settings = () => ({ baseUrl: server.baseUrl, ...rof.store.data.credentials, timeoutMs: 2000 });

describe('rof:check (contract check against the guide)', () => {
  test('read-only check passes against the RSOF stand-in', async () => {
    const report = await runRofCheck({ ...settings(), write: false, log });
    expect(report.ok).toBe(true);
    expect(lines.filter((l) => l.startsWith('MISMATCH'))).toEqual([]);
    expect(lines).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^OK +login/),
        expect.stringMatching(/^OK +categories/),
        expect.stringMatching(/^OK +products list/),
        expect.stringMatching(/^OK +product detail/),
        expect.stringMatching(/^OK +branches/),
      ]),
    );
    expect(rof.store.data.orders).toHaveLength(0);
  });

  test('--write creates, pins, reads and cancels a delivery order AND a pickup order', async () => {
    const report = await runRofCheck({ ...settings(), write: true, log });
    expect(report.ok).toBe(true);
    expect(rof.store.data.orders).toHaveLength(2);
    expect(rof.store.data.orders.map((o) => [o.fulfillmentType, o.status])).toEqual([
      ['Delivery', 'Canceled'],
      ['Pickup', 'Canceled'],
    ]);
    expect(lines.filter((l) => /^OK +(pickup )?order cancel/.test(l))).toHaveLength(2);
    expect(lines.some((l) => /pickup order create/.test(l))).toBe(true);
  });

  test('a renamed field is reported as a mismatch', async () => {
    for (const p of rof.store.data.products) {
      p.price = p.sellingPrice;
      delete p.sellingPrice;
    }
    const report = await runRofCheck({ ...settings(), write: false, log });
    expect(report.ok).toBe(false);
    expect(lines.some((l) => l.startsWith('MISMATCH') && l.includes('sellingPrice'))).toBe(true);
  });

  test('wrong credentials stop the check with a clear message', async () => {
    const report = await runRofCheck({ ...settings(), password: 'wrong', write: false, log });
    expect(report.ok).toBe(false);
    expect(lines[0]).toMatch(/^FAIL +login/);
  });

  test('schemas accept extra fields but not missing ones', () => {
    const base = { id: 'p', name: 'n', status: 'Active', sellingPrice: 1, availableToSell: 1, allowOversell: false, images: [], customFieldDefinitions: [] };
    expect(productDetailSchema.safeParse({ ...base, somethingNew: 1 }).success).toBe(true);
    const { sellingPrice, ...missing } = base;
    expect(sellingPrice).toBe(1);
    expect(productDetailSchema.safeParse(missing).success).toBe(false);
  });
});
