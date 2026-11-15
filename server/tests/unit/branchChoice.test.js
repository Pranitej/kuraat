import { describe, expect, test } from 'vitest';
import { rankBranches, withStock } from '../../src/modules/checkout/branchChoice.js';
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
