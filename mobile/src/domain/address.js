/** Address helpers (pure). */

import { CITY_CENTRES } from './branches.js';
import { jitter } from './geo.js';

export const ADDRESS_LABELS = [
  { id: 'home', label: 'Home' },
  { id: 'office', label: 'Office' },
  { id: 'other', label: 'Other' },
];

/** Postcodes for known districts; falls back to the city's main postcode. */
const POSTCODES = {
  'Al Rakah': '34445',
  'Al Yarmouk': '31952',
  Corniche: '31952',
  'Al Olaya': '12611',
  'Al Faisaliyah District': '32245',
  'Al Faisaliyah': '32245',
  'Al Rawdah': '23434',
};
const CITY_POSTCODES = {
  'Al Khobar': '31952',
  Dhahran: '34247',
  Dammam: '32245',
  'Al Ahsa': '36362',
  Riyadh: '12611',
  Jeddah: '23434',
};

export function postcodeFor(district, city) {
  return POSTCODES[(district || '').trim()] || CITY_POSTCODES[city] || '';
}

/** "Building 14, King Fahd Rd, Al Rakah, Al Khobar 34445" */
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

/** Geo point for an address typed by hand (no map pin): city centre + deterministic offset. */
export function locateAddress({ line = '', district = '', city }) {
  const centre = CITY_CENTRES[city] || CITY_CENTRES['Al Khobar'];
  return jitter(centre, `${line}|${district}|${city}`.toLowerCase());
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

/** What the device "current location" resolves to in the demo (Al Rakah, Al Khobar). */
export const CURRENT_LOCATION = {
  line: 'Building 14, King Fahd Rd',
  district: 'Al Rakah',
  city: 'Al Khobar',
  postcode: '34445',
  location: { lat: 26.2874, lng: 50.2085 },
};
