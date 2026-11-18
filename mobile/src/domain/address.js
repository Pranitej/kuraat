/** Address helpers (pure). */


export const ADDRESS_LABELS = [
  { id: 'home', label: 'Home' },
  { id: 'office', label: 'Office' },
  { id: 'other', label: 'Other' },
];

/** "Building 14, King Fahd Rd, Al Rakah, Al Khobar 34445" (the postcode only when the address has one) */
export function formatAddress(address) {
  if (!address) return '';
  const cityLine = [address.city, address.postcode].filter(Boolean).join(' ');
  return [address.line, address.district, cityLine].filter(Boolean).join(', ');
}

/** Short one-liner used in compact places: "Al Rakah, Al Khobar". */
export function areaLabel(address) {
  if (!address) return '';
  return [address.district, address.city].filter(Boolean).join(', ');
}

/**
 * The address we deliver to: the one chosen for this checkout (Home's "Deliver to" or the Delivery
 * screen) while it still exists, otherwise the default, otherwise the first saved address.
 */
export function deliveryAddress(addresses, chosenId) {
  const list = addresses || [];
  return list.find((a) => a.id === chosenId) || list.find((a) => a.isDefault) || list[0] || null;
}

/** Home's "Deliver to" line: "Home · Al Rakah, Al Khobar". */
export function deliverToLabel(address) {
  if (!address) return '';
  return [address.label, areaLabel(address)].filter(Boolean).join(' · ');
}

/** Known districts per city (used to understand free-text addresses). */
export const DISTRICTS = {
  'Al Khobar': ['Al Rakah', 'Al Yarmouk', 'Corniche', 'Al Aqrabiyah', 'Al Thuqbah', 'Al Hamra'],
  Dhahran: ['Doha', 'Al Qusur', 'Dana'],
  Dammam: ['Al Faisaliyah District', 'Al Faisaliyah', 'Al Shati', 'Al Mazruiyah'],
  'Al Ahsa': ['Hofuf', 'Al Mubarraz'],
  Riyadh: ['Al Olaya', 'Al Malqa', 'Hittin'],
  Jeddah: ['Al Rawdah', 'Al Shati', 'Al Zahra'],
};

/** "Building 14, King Fahd Rd, Al Rakah, Al Khobar" → { line, district, city }. */
export function parseAddressText(text, defaultCity = 'Al Khobar') {
  const parts = (text || '')
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
  const norm = (s) => s.toLowerCase().replace(/\s+\d{5}$/, '').trim();
  let city = null;
  const cityIdx = parts.findIndex((p) => Object.keys(DISTRICTS).some((c) => norm(p) === c.toLowerCase()));
  if (cityIdx >= 0) city = Object.keys(DISTRICTS).find((c) => c.toLowerCase() === norm(parts[cityIdx]));
  const rest = parts.filter((_, i) => i !== cityIdx);
  let district = '';
  const all = Object.entries(DISTRICTS);
  for (let i = rest.length - 1; i >= 1 && !district; i -= 1) {
    const hit = all.find(([, list]) => list.some((d) => d.toLowerCase() === norm(rest[i])));
    if (hit) {
      district = hit[1].find((d) => d.toLowerCase() === norm(rest[i]));
      if (!city) city = hit[0];
      rest.splice(i, 1);
    }
  }
  return { line: rest.join(', '), district, city: city || defaultCity };
}

/** Shown when "Use current location" could not read the device position (refused, unsupported, timed out). */
export const LOCATION_OUTSIDE = 'Your location is outside Saudi Arabia, where we deliver, so it was not saved. You can still continue without it.';
export const LOCATION_FAILED = "We couldn't get your location. Allow location access, or type your address.";
