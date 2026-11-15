/** Saved addresses service (demo implementation of the future /addresses API). */

import { uid, locateAddress, postcodeFor } from '@/domain';
import { getDb, updateDb, userBucket } from './db.js';
import { request, ApiError } from './request.js';

export async function listAddresses(userId) {
  return request(() => getDb().addresses?.[userId] || [], { min: 200, max: 450 });
}

function normalise(input, existing = {}) {
  const line = input.line.trim();
  const district = input.district.trim();
  const city = input.city;
  const moved = !existing.location || existing.line !== line || existing.district !== district || existing.city !== city;
  return {
    ...existing,
    label: input.type === 'other' ? (input.label || '').trim() || 'Other' : input.type === 'office' ? 'Office' : 'Home',
    type: input.type,
    line,
    district,
    city,
    postcode: postcodeFor(district, city) || existing.postcode || '',
    landmark: (input.landmark || '').trim(),
    phone: input.phone,
    contactName: input.contactName || existing.contactName || '',
    location: input.location || (moved ? locateAddress({ line, district, city }) : existing.location),
  };
}

function applyDefault(list, id, makeDefault) {
  if (makeDefault) list.forEach((a) => (a.isDefault = a.id === id));
  if (!list.some((a) => a.isDefault) && list.length) list[0].isDefault = true;
}

export async function createAddress(userId, input) {
  return request(() =>
    updateDb((db) => {
      const list = userBucket(db, 'addresses', userId);
      const user = db.users.find((u) => u.id === userId);
      const address = { id: uid('addr'), ...normalise({ ...input, contactName: user?.name }), isDefault: false };
      list.push(address);
      applyDefault(list, address.id, input.isDefault || list.length === 1);
      return address;
    }),
  );
}

export async function updateAddress(userId, id, input) {
  return request(() =>
    updateDb((db) => {
      const list = userBucket(db, 'addresses', userId);
      const idx = list.findIndex((a) => a.id === id);
      if (idx < 0) throw new ApiError('This address no longer exists.', { code: 'not_found' });
      list[idx] = { ...normalise(input, list[idx]), id, isDefault: list[idx].isDefault };
      if (input.isDefault) applyDefault(list, id, true);
      else if (list[idx].isDefault && list.length > 1 && input.isDefault === false) {
        // Keep exactly one default: hand it to the next address
        list[idx].isDefault = false;
        const next = list.find((a) => a.id !== id);
        if (next) next.isDefault = true;
      }
      return list[idx];
    }),
  );
}

export async function deleteAddress(userId, id) {
  return request(() =>
    updateDb((db) => {
      const list = userBucket(db, 'addresses', userId);
      const idx = list.findIndex((a) => a.id === id);
      if (idx < 0) throw new ApiError('This address no longer exists.', { code: 'not_found' });
      const [removed] = list.splice(idx, 1);
      if (removed.isDefault && list.length) list[0].isDefault = true;
      return removed;
    }),
  );
}

export async function setDefaultAddress(userId, id) {
  return request(() =>
    updateDb((db) => {
      const list = userBucket(db, 'addresses', userId);
      applyDefault(list, id, true);
      return list;
    }),
  );
}
