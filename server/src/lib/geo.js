/** Great-circle distances (Haversine), as the guide asks for the nearest branch (§6.2). */

const EARTH_RADIUS_KM = 6371;
const toRad = (deg) => (deg * Math.PI) / 180;

/** Kilometres between two { lat, lng } points. */
export function distanceKm(a, b) {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

/** One decimal, the precision shown in the app ("5.8 km"). */
export const roundedDistance = (a, b) => Math.round(distanceKm(a, b) * 10) / 10;
