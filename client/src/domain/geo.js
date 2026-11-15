/** Geodesic helpers (pure). */

const R = 6371; // km
const toRad = (d) => (d * Math.PI) / 180;

/** Great-circle distance in km between two { lat, lng } points. */
export function distanceKm(a, b) {
  if (!a || !b) return null;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Rounded to one decimal, the precision shown in the UI ("2.4 km"). */
export function roundedDistance(a, b) {
  const d = distanceKm(a, b);
  return d == null ? null : Math.round(d * 10) / 10;
}

/** Deterministic small offset (±~1.5 km) so new addresses in the same city get distinct points. */
export function jitter(base, seed = '') {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const r1 = ((h >>> 0) % 1000) / 1000 - 0.5;
  const r2 = (((h >>> 10) >>> 0) % 1000) / 1000 - 0.5;
  return { lat: +(base.lat + r1 * 0.028).toFixed(5), lng: +(base.lng + r2 * 0.028).toFixed(5) };
}
