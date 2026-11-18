import { describe, expect, test } from 'vitest';
import { MAP_SLOTS, cityFilters, deliveryCities, mapPins, toBranchView, withDistances } from './branches.js';

const server = (name, lat, lng, extra = {}) => ({ id: name, name, address: '', city: '', phone: '', location: { lat, lng }, hours: { open: 10, close: 24 }, openNow: true, ...extra });
const HOME = { lat: 26.348558, lng: 50.193673 };
const BRANCHES = [
  server('Kuraat · Al Ahsa Hofuf', 25.383, 49.5866),
  server('Kuraat · Dhahran · King Abdulaziz Rd', 26.335411, 50.120579),
  server('Kuraat · Al Khobar Corniche', 26.305709, 50.227336),
].map(toBranchView);

describe('branch views', () => {
  test('card name without the brand prefix, full name for display', () => {
    expect(toBranchView(server('Kuraat · Al Khobar Corniche', 1, 1))).toMatchObject({
      name: 'Al Khobar Corniche',
      displayName: 'Kuraat · Al Khobar Corniche',
      shortName: 'Al Khobar Corniche',
    });
    expect(toBranchView(server('Riyadh Olaya', 1, 1)).name).toBe('Riyadh Olaya');
  });

  test('sorted nearest first with distances from the address', () => {
    const sorted = withDistances(BRANCHES, HOME);
    expect(sorted.map((b) => b.name)).toEqual(['Al Khobar Corniche', 'Dhahran · King Abdulaziz Rd', 'Al Ahsa Hofuf']);
    expect(sorted[0].distanceKm).toBeGreaterThan(4);
    expect(sorted[0].distanceKm).toBeLessThan(7);
  });

  test('without an address the order is kept and distances are null', () => {
    expect(withDistances(BRANCHES, null).map((b) => b.distanceKm)).toEqual([null, null, null]);
  });

  test('pins take the PDF map slots by distance rank', () => {
    const pins = mapPins(withDistances(BRANCHES, HOME));
    expect(pins[0]).toEqual({ id: 'Kuraat · Al Khobar Corniche', x: 43, y: 38, label: 'Al Khobar Corniche' });
    expect(pins[1]).toMatchObject({ x: 60, y: 30 });
  });

  test('more branches than slots reuse the slots, shifted so pins do not overlap', () => {
    const many = Array.from({ length: MAP_SLOTS.length + 1 }, (_, i) => toBranchView(server(`B${i}`, 26, 50)));
    const pins = mapPins(many);
    expect(pins.at(-1)).toMatchObject({ x: MAP_SLOTS[0].x + 4, y: MAP_SLOTS[0].y + 4 });
  });
});

describe('deliveryCities (address form City choices)', () => {
  const inCity = (...cities) => cities.map((city, i) => server(`b${i}`, 1, 1, { city }));

  test("the cities of the server's delivery branches, each once, alphabetical", () => {
    expect(deliveryCities(inCity('Jeddah', 'Dammam', 'Dammam', ' '))).toEqual(['Dammam', 'Jeddah']);
  });

  test("an address saved in another city keeps its city as a choice; one already listed isn't repeated", () => {
    expect(deliveryCities(inCity('Jeddah', 'Dammam'), 'Al Khobar')).toEqual(['Dammam', 'Jeddah', 'Al Khobar']);
    expect(deliveryCities(inCity('Jeddah', 'Dammam'), 'Dammam')).toEqual(['Dammam', 'Jeddah']);
  });

  test('no branches yet: no choices except the current city', () => {
    expect(deliveryCities([])).toEqual([]);
    expect(deliveryCities([], 'Dammam')).toEqual(['Dammam']);
  });
});

describe('cityFilters', () => {
  const inCity = (...cities) => cities.map((city, i) => server(`b${i}`, 1, 1, { city }));

  test('only the cities the branches are in, after All', () => {
    expect(cityFilters(inCity('Jeddah', 'Dammam'))).toEqual(['All', 'Dammam', 'Jeddah']);
  });

  test('each city once, alphabetical (no fixed city list)', () => {
    expect(cityFilters(inCity('Jeddah', 'Tabuk', 'Dammam', 'Dammam', 'Abha', 'Al Khobar'))).toEqual(['All', 'Abha', 'Al Khobar', 'Dammam', 'Jeddah', 'Tabuk']);
  });

  test('one city, or none, means nothing to filter: no pills', () => {
    expect(cityFilters(inCity('Dammam', 'Dammam'))).toEqual([]);
    expect(cityFilters(inCity('', ' '))).toEqual([]);
    expect(cityFilters([])).toEqual([]);
  });
});
