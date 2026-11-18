/** Saved addresses on the server (server/README.md → Addresses). */
import { locateAddress, postcodeFor, toWirePhone } from '@/domain';
import { apiRequest } from './api.js';

/**
 * Form → request body. Every address needs coordinates (the delivering branch is chosen from
 * them); until the real map, an address typed without a pin is placed from its city and text.
 */
export function toAddressBody(input) {
  const line = (input.line || '').trim();
  const district = (input.district || '').trim();
  const city = input.city;
  return {
    type: input.type,
    label: input.type === 'other' ? (input.label || '').trim() || 'Other' : undefined,
    line,
    district,
    city,
    postcode: postcodeFor(district, city) || undefined,
    landmark: (input.landmark || '').trim(),
    phone: toWirePhone(input.phone),
    isDefault: Boolean(input.isDefault),
    location: input.location || locateAddress({ line, district, city }),
  };
}

export const listAddresses = () => apiRequest('/addresses');
export const createAddress = (input) => apiRequest('/addresses', { method: 'POST', body: toAddressBody(input) });
export const updateAddress = (id, input) => apiRequest(`/addresses/${encodeURIComponent(id)}`, { method: 'PATCH', body: toAddressBody(input) });
export const deleteAddress = (id) => apiRequest(`/addresses/${encodeURIComponent(id)}`, { method: 'DELETE' });
/** Returns the whole list with the new default. */
export const setDefaultAddress = (id) => apiRequest(`/addresses/${encodeURIComponent(id)}/default`, { method: 'POST' });
