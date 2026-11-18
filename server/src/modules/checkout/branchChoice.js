/**
 * Which branch delivers (guide §6.2, §7.2; design spec §6.7 step 3): hub branches sorted by
 * Haversine distance from the address; a further branch may take over (stock) only within nearest +
 * 25 km. With the optional per-branch stock check (needs ROF Inventory.Read), branches lacking any
 * item are skipped; without it, ROF's assignment refusal triggers the fallback at order time.
 */
import { MAX_DETOUR_KM } from '../../config/business.js';
import { roundedDistance } from '../../lib/geo.js';
import { toStockMap } from '../../rof/adapter.js';

/** @returns {{ branch, distanceKm }[]} nearest first */
export function rankBranches(branches, location, { maxDetourKm = MAX_DETOUR_KM } = {}) {
  const ranked = branches
    .map((branch) => ({ branch, distanceKm: roundedDistance(location, branch.location) }))
    .sort((a, b) => a.distanceKm - b.distanceKm);
  if (!ranked.length) return [];
  const reach = ranked[0].distanceKm + maxDetourKm;
  return ranked.filter((r) => r.distanceKm <= reach);
}

/** @param {Record<string, Record<string, number>>} stockByProduct productId → branchId → quantity */
export const withStock = (ranked, stockByProduct, items) =>
  ranked.filter((r) => items.every((i) => (stockByProduct[i.productId]?.[r.branch.id] ?? 0) >= i.qty));

/**
 * Candidate branches for an address and items, best first.
 * @returns {Promise<{ candidates: { branch, distanceKm }[], nearestId: string|null, inStock: boolean|null }>}
 *   inStock is null when the per-branch stock check is off or failed.
 */
export async function deliveryCandidates(ctx, location, items) {
  const ranked = rankBranches(await ctx.branches.listDeliveryBranches(), location);
  const nearestId = ranked[0]?.branch.id ?? null;
  if (!ctx.config.rof.inventoryCheck || !items.length || !ranked.length) return { candidates: ranked, nearestId, inStock: null };
  try {
    const { items: balances } = await ctx.rof.listStockBalances();
    const stocked = withStock(ranked, toStockMap(balances), items);
    // Nobody nearby has everything: keep the full list; ROF's assignment decides at order time.
    return stocked.length ? { candidates: stocked, nearestId, inStock: true } : { candidates: ranked, nearestId, inStock: false };
  } catch (error) {
    ctx.logger.warn(`[checkout] per-branch stock check failed, using distance only: ${error.message}`);
    return { candidates: ranked, nearestId, inStock: null };
  }
}
