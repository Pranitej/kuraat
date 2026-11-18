/**
 * HTTP client for the RSOF order system (ROF). The only module that knows ROF's paths.
 * Every method returns ROF's raw `data` (list methods: { items, totalCount }); converting ROF
 * shapes into ours is the adapter's job (adapter.js).
 *
 * Endpoints follow "Order Integration API Guide – Mobile App Backend" (sections in comments).
 */
import { RofError } from './errors.js';
import { createTokenManager } from './tokenManager.js';

const MAX_PAGES = 20;

export function createRofClient({ baseUrl, email, password, timeoutMs = 10000, pageSize = 100, now = () => Date.now() }) {
  const root = baseUrl.replace(/\/+$/, '');
  const tokens = createTokenManager({ baseUrl: root, email, password, timeoutMs, now });

  async function send(method, path, { query, body } = {}, isRetry = false) {
    const { token } = await tokens.get();
    const url = new URL(root + path);
    for (const [key, value] of Object.entries(query || {})) {
      if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
    }
    let res;
    try {
      res = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
          ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      throw new RofError('unavailable', `ROF ${method} ${path} failed: ${error.message}`, { path });
    }
    if (res.status === 401) {
      tokens.invalidate();
      if (isRetry) throw new RofError('auth', `ROF ${method} ${path} still unauthorised after a fresh login`, { status: 401, path });
      return send(method, path, { query, body }, true);
    }
    if (res.status === 429 || res.status >= 500) {
      throw new RofError('unavailable', `ROF ${method} ${path} answered HTTP ${res.status}`, { status: res.status, path });
    }
    const json = await res.json().catch(() => null);
    if (!json || typeof json !== 'object') {
      throw new RofError('unavailable', `ROF ${method} ${path} returned an unreadable reply (HTTP ${res.status})`, {
        status: res.status,
        path,
      });
    }
    // ROF often answers HTTP 200 with success:false (guide §3.3) — always check `success`.
    if (json.success === false || !res.ok) {
      throw new RofError('rejected', json.message || `ROF rejected ${method} ${path} (HTTP ${res.status})`, { status: res.status, path });
    }
    return json;
  }

  const data = async (...args) => (await send(...args)).data;
  const list = async (...args) => {
    const json = await send(...args);
    const items = Array.isArray(json.data) ? json.data : [];
    return { items, totalCount: json.totalCount ?? items.length };
  };
  const enc = encodeURIComponent;

  /**
   * Every row of a list. ROF answers 10 rows per page unless asked for more (verified on UAT,
   * 18 Nov 2026), so a bare call silently drops everything after the tenth branch or stock row.
   */
  async function listAll(path, query = {}) {
    const items = [];
    for (let pageIndex = 1; pageIndex <= MAX_PAGES; pageIndex++) {
      const page = await list('GET', path, { query: { ...query, PageIndex: pageIndex, PageSize: pageSize } });
      items.push(...page.items);
      if (!page.items.length || items.length >= page.totalCount) break;
    }
    return { items, totalCount: items.length };
  }

  return {
    /** tenantId comes from login (guide §3.1); needed for the branches call. */
    getTenantId: async () => (await tokens.get()).tenantId,

    // §4 Home
    listCategories: ({ pageIndex = 1, pageSize = 100 } = {}) =>
      list('GET', '/api/category/all', { query: { PageIndex: pageIndex, PageSize: pageSize } }),
    listProducts: ({ categoryId, search, pageIndex = 1, pageSize = 100 } = {}) =>
      list('GET', '/api/products', { query: { PageIndex: pageIndex, PageSize: pageSize, CategoryId: categoryId, Search: search } }),
    // §5 Product detail
    getProduct: (id) => data('GET', `/api/products/${enc(id)}`),
    // §6.2 per-branch stock (needs Inventory.Read): one row per product × branch that has a stock
    // record — a pair with no row holds none. Pass productId to narrow it to one product.
    listStockBalances: ({ productId } = {}) => listAll('/api/inventory/balances', { ProductId: productId }),
    // §10 Branches — the lead's GET /api/branches. It ignores isHubBranch (verified on UAT) and also
    // lists the master branch, so the hub filter is ours; closed and deleted branches never count.
    listBranches: async ({ hubOnly = true, search } = {}) => {
      const { items } = await listAll('/api/branches', { Search: search });
      const open = items.filter((b) => b.isActive !== false && b.isDeleted !== true && (!hubOnly || b.isHubBranch === true));
      return { items: open, totalCount: open.length };
    },
    getBranch: (id) => data('GET', `/api/branches/${enc(id)}`),
    // §7 Order confirmed
    createOrder: (payload) => data('POST', '/api/orders/manual', { body: payload }),
    // RSOF staff's manual assignment; our order flow no longer calls it (ROF assigns from the pin).
    assignBranch: (orderId, branchId) => data('PUT', `/api/orders/${enc(orderId)}/assign/branch`, { query: { BranchId: branchId } }),
    /** The customer's pin (lead's collection) — ROF's auto-assignment picks the nearest branch with stock. */
    shareOrderLocation: (orderId, { lat, lng }) =>
      data('PUT', `/api/orders/${enc(orderId)}/location/shared`, { body: { latitude: lat, longitude: lng } }),
    // §9 Order detail and tracking
    getOrder: (orderId) => data('GET', `/api/orders/${enc(orderId)}`),
    // §8 Orders of one mobile number (every channel: our apps, WhatsApp, RSOF staff). Newest first, at
    // most 20, and thin (first item only, price 0) — we use it to learn the order ids, then read each one.
    listOrdersByPhone: (phone) => data('GET', `/api/orders/by-phone/${enc(phone)}`),
    getOrderTimeline: (orderId) => data('GET', `/api/orders/${enc(orderId)}/timeline`),
    cancelOrder: (orderId) => data('PUT', `/api/orders/${enc(orderId)}/cancel`),
    resendDeliveryOtp: (orderId) => data('POST', `/api/orders/${enc(orderId)}/resend-otp`),
  };
}
