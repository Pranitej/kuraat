import { describe, expect, test, vi } from 'vitest';
import { deliveryCandidates, rankBranches, withStock } from '../../src/modules/checkout/branchChoice.js';
import { distanceKm, roundedDistance } from '../../src/lib/geo.js';

const home = { lat: 26.348558, lng: 50.193673 }; // King Fahd Rd, Al Rakah, Al Khobar
const b = (id, lat, lng) => ({ id, name: id, location: { lat, lng } });
const corniche = b('corniche', 26.305709, 50.227336);
const dhahran = b('dhahran', 26.335411, 50.120579);
const dammam = b('dammam', 26.405289, 50.113575);
const riyadh = b('riyadh', 24.698199, 46.682117);

describe('geo', () => {
  test('Haversine distance Al Khobar → Riyadh is about 395 km', () => {
    expect(distanceKm(home, riyadh.location)).toBeGreaterThan(380);
    expect(distanceKm(home, riyadh.location)).toBeLessThan(410);
  });
  test('rounded to one decimal', () => {
    expect(roundedDistance(home, corniche.location)).toBe(5.8);
  });
});

describe('rankBranches', () => {
  test('nearest first, keeping only branches within nearest + 25 km', () => {
    const ranked = rankBranches([riyadh, dammam, dhahran, corniche], home);
    expect(ranked.map((r) => r.branch.id)).toEqual(['corniche', 'dhahran', 'dammam']);
    expect(ranked[0].distanceKm).toBe(5.8);
  });

  test('no branches → empty list', () => {
    expect(rankBranches([], home)).toEqual([]);
  });
});

describe('withStock', () => {
  test('keeps branches that hold every quantity', () => {
    const ranked = rankBranches([corniche, dhahran], home);
    const stock = { praline: { corniche: 0, dhahran: 50 }, classic: { corniche: 50, dhahran: 50 } };
    const items = [
      { productId: 'praline', qty: 1 },
      { productId: 'classic', qty: 2 },
    ];
    expect(withStock(ranked, stock, items).map((r) => r.branch.id)).toEqual(['dhahran']);
  });
});

describe('deliveryCandidates (stock check from GET /api/inventory/balances)', () => {
  const row = (productId, branchId, available, extra = {}) => ({ productId, branchId, onHand: available, reserved: 0, available, allowOversell: false, ...extra });
  const ctxWith = (balances, { check = true } = {}) => ({
    config: { rof: { inventoryCheck: check } },
    logger: { warn: vi.fn() },
    branches: { listDeliveryBranches: async () => [corniche, dhahran] },
    rof: { listStockBalances: vi.fn(async () => ({ items: balances })) },
  });
  const items = [{ productId: 'praline', qty: 2 }];

  test('skips a nearer branch that has none left and says stock was checked', async () => {
    const ctx = ctxWith([row('praline', 'corniche', 0), row('praline', 'dhahran', 50)]);
    const out = await deliveryCandidates(ctx, home, items);
    expect(out.candidates.map((c) => c.branch.id)).toEqual(['dhahran']);
    expect(out).toMatchObject({ nearestId: 'corniche', inStock: true });
    expect(ctx.rof.listStockBalances).toHaveBeenCalledTimes(1); // one call, however many products
  });

  test('a branch with no stock row holds none', async () => {
    const out = await deliveryCandidates(ctxWith([row('praline', 'dhahran', 5)]), home, items);
    expect(out.candidates.map((c) => c.branch.id)).toEqual(['dhahran']);
  });

  test('reserved stock is not sellable: available, not on hand, decides', async () => {
    const reserved = row('praline', 'corniche', 0, { onHand: 2, reserved: 2 });
    const out = await deliveryCandidates(ctxWith([reserved, row('praline', 'dhahran', 3)]), home, items);
    expect(out.candidates.map((c) => c.branch.id)).toEqual(['dhahran']);
  });

  test('nobody has it: keeps the distance order and flags inStock false, ROF decides at order time', async () => {
    const out = await deliveryCandidates(ctxWith([row('praline', 'corniche', 0)]), home, items);
    expect(out.candidates.map((c) => c.branch.id)).toEqual(['corniche', 'dhahran']);
    expect(out.inStock).toBe(false);
  });

  test('ROF stock call failing falls back to distance only', async () => {
    const ctx = ctxWith([]);
    ctx.rof.listStockBalances = vi.fn(async () => {
      throw new Error('boom');
    });
    const out = await deliveryCandidates(ctx, home, items);
    expect(out).toMatchObject({ inStock: null });
    expect(out.candidates).toHaveLength(2);
    expect(ctx.logger.warn).toHaveBeenCalled();
  });

  test('check switched off: no stock call at all', async () => {
    const ctx = ctxWith([], { check: false });
    const out = await deliveryCandidates(ctx, home, items);
    expect(out.inStock).toBeNull();
    expect(ctx.rof.listStockBalances).not.toHaveBeenCalled();
  });
});
