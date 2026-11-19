/**
 * Dependency container passed to routes and services. Tests build it with the test database, the
 * RSOF stand-in (tests/support/rof-double), a settable clock and a captured logger; production builds it in src/index.js.
 * ROF-backed services exist only when a ROF client is given. paymentLinks: RSOF's payment-link client (only when
 * ROF_API_KEY is set); without it card orders are refused.
 */
import { createBranchService } from './modules/branches/service.js';
import { createCatalogService } from './modules/catalog/service.js';
import { createOrdersService } from './modules/orders/service.js';
import { createOnlinePayments } from './modules/payments/online.js';

export function createContext({ config, db, rof = null, paymentLinks = null, whatsapp = null, clock = { now: () => new Date() }, logger = console, ...overrides }) {
  const ctx = { config, db, rof, paymentLinks, whatsapp, clock, logger };
  if (rof) {
    const now = () => clock.now().getTime();
    // Photo links are built for the apps, so they use the media base (see ROF_MEDIA_BASE_URL).
    ctx.catalog = createCatalogService({ rof, baseUrl: config.rof.mediaBaseUrl, now, logger });
    ctx.branches = createBranchService({ rof, now });
    ctx.payments = createOnlinePayments(ctx);
    ctx.orders = createOrdersService(ctx);
  }
  return Object.assign(ctx, overrides);
}
