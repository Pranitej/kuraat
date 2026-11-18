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

