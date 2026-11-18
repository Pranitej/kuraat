import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { local } from '@/lib/storage.js';
import { stubFetch } from '@/test/stubFetch.js';
import { setTokens } from './api.js';
import { createAddress, deleteAddress, listAddresses, setDefaultAddress, toAddressBody, updateAddress } from './addressService.js';

const form = {
  type: 'other',
  label: 'Parents’ home',
  line: 'Villa 8',
  district: 'Al Faisaliyah District',
  city: 'Dammam',
  landmark: '',
  phone: '55 987 6543',
  isDefault: false,
  location: null,
};

beforeEach(() => {
  local.clearAll();
  setTokens({ accessToken: 'a1', refreshToken: 'r1' });
});
afterEach(() => vi.unstubAllGlobals());

describe('toAddressBody', () => {
  test('fills coordinates for an address typed without a pin, and invents no postcode', () => {
    const body = toAddressBody(form);
    expect(body).toMatchObject({ type: 'other', label: 'Parents’ home', line: 'Villa 8', district: 'Al Faisaliyah District', city: 'Dammam', phone: '559876543', isDefault: false });
    expect(body.postcode).toBeUndefined();
    expect(body.location.lat).toBeCloseTo(26.41, 1);
    expect(body.location.lng).toBeCloseTo(50.125, 1);
  });

  test('keeps coordinates the form already has', () => {
    expect(toAddressBody({ ...form, location: { lat: 26.3, lng: 50.2 } }).location).toEqual({ lat: 26.3, lng: 50.2 });
  });
});

describe('address calls', () => {
  test('one call per endpoint', async () => {
    const calls = stubFetch((c) => (c.method === 'DELETE' ? { status: 204 } : { body: c.method === 'GET' ? [] : { id: 'x' } }));
    await listAddresses();
    await createAddress(form);
    await updateAddress('a1', form);
    await deleteAddress('a1');
    await setDefaultAddress('a1');
    expect(calls.map((c) => `${c.method} ${c.path}`)).toEqual(['GET /addresses', 'POST /addresses', 'PATCH /addresses/a1', 'DELETE /addresses/a1', 'POST /addresses/a1/default']);
    expect(calls[1].body).toMatchObject({ line: 'Villa 8' });
    expect(calls[1].body.postcode).toBeUndefined();
  });
});
