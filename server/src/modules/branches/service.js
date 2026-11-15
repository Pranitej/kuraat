/**
 * Delivery branches from ROF (guide §10). Only branches with branchType = 'hub' take app orders
 * (lead's rule). Opening hours are not in ROF, so they come from config/business.js.
 */
import { BRANCH_HOURS_OVERRIDES, DEFAULT_BRANCH_HOURS } from '../../config/business.js';
import { createTtlCache } from '../../lib/cache.js';
import { isOpenAt } from '../../lib/time.js';
import { toBranch } from '../../rof/adapter.js';

export const hoursFor = (branchId) => BRANCH_HOURS_OVERRIDES[branchId] || DEFAULT_BRANCH_HOURS;

export function createBranchService({ rof, now = () => Date.now(), ttlMs = 60_000 }) {
  const cache = createTtlCache({ ttlMs, now });

  const present = (branch) => {
    const hours = hoursFor(branch.id);
    const { isHub, ...rest } = branch;
    return { ...rest, hours, openNow: isOpenAt(hours, new Date(now())) };
  };

  const hubs = () =>
    cache.get('branches', async () => (await rof.listBranches({ hubOnly: true })).items.map(toBranch).filter((b) => b.isHub));

  return {
    /** Branches customers can be delivered from, with hours and openNow (Saudi time). */
    async listDeliveryBranches() {
      return (await hubs()).map(present);
    },
    async getBranch(id) {
      const hit = (await hubs()).find((b) => b.id === id);
      return hit ? present(hit) : null;
    },
  };
}
