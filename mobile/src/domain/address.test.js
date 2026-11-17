import { describe, expect, test } from 'vitest';
import { deliveryAddress, deliverToLabel } from './address.js';

const HOME = { id: 'a1', label: 'Home', district: 'Al Rakah', city: 'Al Khobar', isDefault: true };
const OFFICE = { id: 'a2', label: 'Office', district: 'Al Olaya', city: 'Riyadh', isDefault: false };

describe('deliveryAddress', () => {
  test('uses the address chosen for this checkout when it still exists', () => {
    expect(deliveryAddress([HOME, OFFICE], 'a2')).toBe(OFFICE);
  });

  test('falls back to the default address when nothing (or a deleted address) is chosen', () => {
    expect(deliveryAddress([OFFICE, HOME], null)).toBe(HOME);
    expect(deliveryAddress([OFFICE, HOME], 'gone')).toBe(HOME);
  });

  test('falls back to the first address when none is marked default', () => {
    expect(deliveryAddress([{ ...OFFICE }, { ...HOME, isDefault: false }], null).id).toBe('a2');
  });

  test('is null without saved addresses', () => {
    expect(deliveryAddress([], 'a1')).toBeNull();
    expect(deliveryAddress(undefined, null)).toBeNull();
  });
});

describe('deliverToLabel', () => {
  test('"Home · Al Rakah, Al Khobar"', () => {
    expect(deliverToLabel(HOME)).toBe('Home · Al Rakah, Al Khobar');
  });

  test('leaves out what is missing', () => {
    expect(deliverToLabel({ label: 'Home', district: '', city: 'Al Khobar' })).toBe('Home · Al Khobar');
    expect(deliverToLabel({ label: '', district: 'Al Rakah', city: 'Al Khobar' })).toBe('Al Rakah, Al Khobar');
    expect(deliverToLabel(null)).toBe('');
  });
});
