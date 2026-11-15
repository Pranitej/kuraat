/**
 * HTTP client for the RSOF order system (ROF). The only module that knows ROF's paths.
 * Every method returns ROF's raw `data` (list methods: { items, totalCount }); converting ROF
 * shapes into ours is the adapter's job (adapter.js).
 *
 * Endpoints follow "Order Integration API Guide – Mobile App Backend" (sections in comments).
 */
import { RofError } from './errors.js';
import { createTokenManager } from './tokenManager.js';

export function createRofClient({ baseUrl, email, password, timeoutMs = 10000, now = () => Date.now() }) {
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
    // §6.2 optional per-branch stock (needs Inventory.Read)
    getProductInventory: (id) => data('GET', `/api/inventory/product/${enc(id)}`),
    // §10 Branches
    listBranches: async ({ hubOnly = true, search } = {}) => {
      const tenantId = (await tokens.get()).tenantId;
      return list('GET', `/api/branches/tenant/${enc(tenantId)}`, { query: { isHubBranch: hubOnly ? 'true' : undefined, Search: search } });
    },
    getBranch: (id) => data('GET', `/api/branches/${enc(id)}`),
    // §7 Order confirmed
    createOrder: (payload) => data('POST', '/api/orders/manual', { body: payload }),
    assignBranch: (orderId, branchId) => data('PUT', `/api/orders/${enc(orderId)}/assign/branch`, { query: { BranchId: branchId } }),
    // §9 Order detail and tracking
    getOrder: (orderId) => data('GET', `/api/orders/${enc(orderId)}`),
    getOrderTimeline: (orderId) => data('GET', `/api/orders/${enc(orderId)}/timeline`),
    cancelOrder: (orderId) => data('PUT', `/api/orders/${enc(orderId)}/cancel`),
    resendDeliveryOtp: (orderId) => data('POST', `/api/orders/${enc(orderId)}/resend-otp`),
  };
}
