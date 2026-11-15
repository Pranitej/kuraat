/**
 * Delivery logic (pure): which branch fulfils an order, and when it arrives.
 * PDF: "Delivery branch is chosen in the backend from the address and stock." — this module is the
 * client-side stand-in for that rule so the demo behaves consistently on every screen.
 */

import { BRANCHES, getBranch } from './branches.js';
import { getProduct } from './catalog.js';
import { roundedDistance } from './geo.js';

/** How much further than the nearest branch a fallback branch may be (km). */
export const MAX_DETOUR_KM = 25;

export function branchHasStock(branchId, productIds = []) {
  return productIds.every((id) => {
    const p = getProduct(id);
    return p && !p.unavailableAt.includes(branchId);
  });
}

/** Branches sorted by distance from a location, each with `distanceKm`. */
export function branchesByDistance(location) {
  return BRANCHES.map((b) => ({ ...b, distanceKm: location ? roundedDistance(location, b.location) : null })).sort(
    (a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0),
  );
}

/**
 * Nearest branch that stocks every product. Falls back to the nearest branch.
 * @returns {{ branch, distanceKm, inStock: boolean, isNearest: boolean }}
 */
export function chooseBranch(location, productIds = []) {
  const ranked = branchesByDistance(location);
  if (!ranked.length) return null;
  // Only branches within a short drive of the nearest one can take over for stock reasons.
  const reach = (ranked[0].distanceKm ?? 0) + MAX_DETOUR_KM;
  const withStock = ranked.find((b) => (b.distanceKm ?? 0) <= reach && branchHasStock(b.id, productIds));
  const chosen = withStock || ranked[0];
  return {
    branch: getBranch(chosen.id),
    distanceKm: chosen.distanceKm,
    inStock: Boolean(withStock),
    isNearest: chosen.id === ranked[0].id,
  };
}

const HOUR = 3600 * 1000;
const MINUTE = 60 * 1000;

/**
 * Two-hour delivery slot at least 4.5 h after ordering, within branch hours (12 PM – 12 AM slots).
 * 12:21 → 5:00–7:00 PM, out for delivery ~4:30 PM (as in the PDF).
 */
export function deliveryWindow(from = new Date()) {
  const start = new Date(from.getTime() + 4.5 * HOUR);
  if (start.getMinutes() || start.getSeconds() || start.getMilliseconds()) {
    start.setHours(start.getHours() + 1, 0, 0, 0);
  }
  if (start.getHours() > 22) {
    start.setDate(start.getDate() + 1);
    start.setHours(12, 0, 0, 0);
  } else if (start.getHours() < 12) {
    start.setHours(12, 0, 0, 0);
  }
  const end = new Date(start.getTime() + 2 * HOUR);
  return { start, end };
}

/** Timestamps for each stage of a new order. */
export function orderSchedule(createdAt = new Date()) {
  const created = new Date(createdAt);
  const { start, end } = deliveryWindow(created);
  const sameDay = start.toDateString() === created.toDateString();
  // Same-day orders go straight to the kitchen; next-day orders are prepared fresh that morning.
  const preparingAt = sameDay ? new Date(created.getTime() + 4 * MINUTE) : new Date(start.getTime() - 2 * HOUR);
  return {
    createdAt: created.toISOString(),
    preparingAt: preparingAt.toISOString(),
    outForDeliveryAt: new Date(start.getTime() - 30 * MINUTE).toISOString(),
    windowStart: start.toISOString(),
    windowEnd: end.toISOString(),
    deliveredAt: new Date(start.getTime() + 52 * MINUTE).toISOString(),
  };
}
