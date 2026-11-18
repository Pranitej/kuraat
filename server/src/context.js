/**
 * Dependency container passed to routes and services. Tests build it with the test database, the
 * RSOF stand-in (tests/support/rof-double), a settable clock and a captured logger; production builds it in src/index.js.
 * ROF-backed services exist only when a ROF client is given.
 */
import { createBranchService } from './modules/branches/service.js';
import { createCatalogService } from './modules/catalog/service.js';
import { createOrdersService } from './modules/orders/service.js';

export function createContext({ config, db, rof = null, clock = { now: () => new Date() }, logger = console, ...overrides }) {
  const ctx = { config, db, rof, clock, logger };
  if (rof) {
    const now = () => clock.now().getTime();
    // Photo links are built for the apps, so they use the media base (see ROF_MEDIA_BASE_URL).
    ctx.catalog = createCatalogService({ rof, baseUrl: config.rof.mediaBaseUrl, now, logger });
    ctx.branches = createBranchService({ rof, now });
    ctx.orders = createOrdersService(ctx);
  }
  return Object.assign(ctx, overrides);
}
