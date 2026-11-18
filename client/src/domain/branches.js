/**
 * Branch helpers for the server's delivery branches (server/README.md → Shop: GET /branches gives
 * id, name, address, city, phone, location, hours and openNow in Saudi time).
 */
import { roundedDistance } from './geo.js';

/** The cities the server's branches are in: each once, alphabetical. */
function branchCities(branches = []) {
  return [...new Set(branches.map((b) => String(b.city || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

/**
 * The address form's City choices: the cities we deliver from (the server's delivery branches — never a
 * fixed list). An address already saved in another city keeps that city as a choice, so editing it never
 * changes the city behind the customer's back.
 */
export function deliveryCities(branches, currentCity) {
  const cities = branchCities(branches);
  const current = String(currentCity || '').trim();
  return current && !cities.includes(current) ? [...cities, current] : cities;
}

/**
 * City pills for the branches page, built from the branches we actually have, so two branches in two
 * cities give "All · Dammam · Jeddah" (alphabetical). With one city (or none) there is nothing to
 * filter, so no pills: [].
 */
export function cityFilters(branches) {
  const cities = branchCities(branches);
  return cities.length < 2 ? [] : ['All', ...cities];
}

/** Approximate city centres for addresses entered without a map pin. */
export const CITY_CENTRES = {
  'Al Khobar': { lat: 26.293, lng: 50.21 },
  Dhahran: { lat: 26.31, lng: 50.14 },
  Dammam: { lat: 26.41, lng: 50.125 },
  'Al Ahsa': { lat: 25.32, lng: 49.55 },
  Riyadh: { lat: 24.72, lng: 46.7 },
  Jeddah: { lat: 21.38, lng: 38.78 },
};

export const HEAD_OFFICE = {
  address: 'Prince Faisal bin Fahd Rd, Al Khobar 31952',
  supportHours: '9 AM – 11 PM',
  supportPhone: '+966 13 555 0100',
  email: 'care@kuraat.com',
  location: { lat: 26.30696, lng: 50.21868 },
};

const BRAND_PREFIX = /^kuraat\s*·\s*/i;

/**
 * Server branch → what the screens use: `displayName` is the full name ("Kuraat · Al Khobar
 * Corniche"), `name`/`shortName` drop the brand for cards and the cart line.
 */
export function toBranchView(branch) {
  const short = String(branch.name || '').replace(BRAND_PREFIX, '').trim() || branch.name;
  return { ...branch, displayName: branch.name, name: short, shortName: short };
}

/** Nearest first, each with `distanceKm` from `location` (kept in order, null distances, without one). */
export function withDistances(branches, location) {
  const list = branches.map((b) => ({ ...b, distanceKm: location && b.location ? roundedDistance(location, b.location) : null }));
  return location ? list.sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity)) : list;
}

/** Pin positions (0–100 %) on the drawn map, as in the PDF — the nearest branch gets the first. */
export const MAP_SLOTS = [
  { x: 43, y: 38 },
  { x: 60, y: 30 },
  { x: 17, y: 25 },
  { x: 72, y: 60 },
  { x: 86, y: 18 },
  { x: 30, y: 72 },
];

/** Pins for the drawn map, by rank; past the six slots they repeat, shifted a little. */
export function mapPins(branches) {
  return branches.map((b, i) => {
    const slot = MAP_SLOTS[i % MAP_SLOTS.length];
    const shift = Math.floor(i / MAP_SLOTS.length) * 4;
    return { id: b.id, x: slot.x + shift, y: slot.y + shift, label: b.name };
  });
}

/** "10 AM – 12 AM" */
export function formatHours(hours) {
  const fmt = (h) => {
    const hh = h % 24;
    const suffix = hh >= 12 ? 'PM' : 'AM';
    const h12 = hh % 12 === 0 ? 12 : hh % 12;
    return `${h12} ${suffix}`;
  };
  return `${fmt(hours.open)} – ${fmt(hours.close)}`;
}

export function mapsUrl(location, label = '') {
  const q = `${location.lat},${location.lng}${label ? ` (${label})` : ''}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

export function directionsUrl(location) {
  return `https://www.google.com/maps/dir/?api=1&destination=${location.lat},${location.lng}`;
}

export function telUrl(phone) {
  return `tel:${phone.replace(/\s/g, '')}`;
}
