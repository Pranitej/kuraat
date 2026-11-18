/** Saved addresses on the server (server/README.md → Addresses). */
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
    postcode: (input.postcode || '').trim() || undefined, // only one the customer gave — never guessed
    landmark: (input.landmark || '').trim(),
    isDefault: Boolean(input.isDefault),
    // Only a position the customer really shared; a typed address has none (the location is optional).
    ...(input.location ? { location: input.location } : {}),
  };
}

export const listAddresses = () => apiRequest('/addresses');
export const createAddress = (input) => apiRequest('/addresses', { method: 'POST', body: toAddressBody(input) });
export const updateAddress = (id, input) => apiRequest(`/addresses/${encodeURIComponent(id)}`, { method: 'PATCH', body: toAddressBody(input) });
export const deleteAddress = (id) => apiRequest(`/addresses/${encodeURIComponent(id)}`, { method: 'DELETE' });
/** Returns the whole list with the new default. */
export const setDefaultAddress = (id) => apiRequest(`/addresses/${encodeURIComponent(id)}/default`, { method: 'POST' });
