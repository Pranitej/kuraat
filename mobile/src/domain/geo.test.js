import { describe, expect, test } from 'vitest';
import { isInSaudi } from './geo.js';

describe('isInSaudi (a position we can deliver to, same box as the server)', () => {
  test('Saudi cities are inside', () => {
    expect(isInSaudi({ lat: 26.2874, lng: 50.2085 })).toBe(true); // Al Khobar
    expect(isInSaudi({ lat: 24.7136, lng: 46.6753 })).toBe(true); // Riyadh
    expect(isInSaudi({ lat: 21.3891, lng: 39.8579 })).toBe(true); // Makkah
  });

  test('places far abroad are outside, e.g. India', () => {
    expect(isInSaudi({ lat: 17.385, lng: 78.4867 })).toBe(false); // Hyderabad, India
    expect(isInSaudi({ lat: 51.5, lng: -0.12 })).toBe(false); // London
    expect(isInSaudi({ lat: 35, lng: 40 })).toBe(false); // north of the box
  });

  test('no position is not inside', () => {
    expect(isInSaudi(null)).toBe(false);
    expect(isInSaudi(undefined)).toBe(false);
  });
});
