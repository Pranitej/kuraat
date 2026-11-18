/**
 * Delivery branches from ROF (guide §10). Only branches with branchType = 'hub' are offered at checkout
 * (lead's rule); an order can still end up at another branch when RSOF assigns it. Opening hours are not in ROF, so they come from config/business.js.
 */
import { BRANCH_HOURS_OVERRIDES, DEFAULT_BRANCH_HOURS } from '../../config/business.js';
import { createTtlCache } from '../../lib/cache.js';
import { isOpenAt } from '../../lib/time.js';
import { toBranch } from '../../rof/adapter.js';

export const hoursFor = (branchId) => BRANCH_HOURS_OVERRIDES[branchId] || DEFAULT_BRANCH_HOURS;

export function createBranchService({ rof, now = () => Date.now(), ttlMs = 60_000, stockTtlMs = 20_000 }) {
  const cache = createTtlCache({ ttlMs, now });
  // Per-branch stock pages through every product × branch row, and every delivery quote used to ask
  // for it. A 20 s copy serves all customers; it only steers the "likely branch" estimate — RSOF
  // still decides the branch and checks stock when the order arrives.
  const stockCache = createTtlCache({ ttlMs: stockTtlMs, now });

  const present = (branch) => {
    const hours = hoursFor(branch.id);
    const { isHub, ...rest } = branch;
    return { ...rest, hours, openNow: isOpenAt(hours, new Date(now())) };
  };

  const hubs = () =>
    cache.get('branches', async () => (await rof.listBranches({ hubOnly: true })).items.map(toBranch).filter((b) => b.isHub));

  return {
    /** RSOF's per-branch stock rows ({ items }), at most stockTtlMs old. */
    stockBalances: () => stockCache.get('balances', () => rof.listStockBalances()),

    /** Branches customers can be delivered from, with hours and openNow (Saudi time). */
    async listDeliveryBranches() {
      return (await hubs()).map(present);
    },
    /**
     * Hubs first; RSOF may also assign a branch that is not a hub (its rule is "the nearest branch
     * with availability"), so any other id is read from RSOF once and cached.
     */
    async getBranch(id) {
      const hit = (await hubs()).find((x) => x.id === id);
      if (hit) return present(hit);
      const other = await cache.get(`branch:${id}`, async () => {
        try {
          return toBranch(await rof.getBranch(id));
        } catch {
          return null; // unknown or unreachable: the order falls back to the branch name it stored
        }
      });
      return other ? present(other) : null;
    },
  };
}
