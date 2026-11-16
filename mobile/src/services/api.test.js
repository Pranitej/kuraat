import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { API_BASE_URL, ApiError, apiRequest, clearTokens, getTokens, onSignedOut, setTokens } from './api.js';

const json = (status, body) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => {
    if (body === undefined) throw new SyntaxError('no body');
    return body;
  },
});

/** fetch stub: handler(path, init) → { status, body }. Records every call. */
function stubFetch(handler) {
  const calls = [];
  const fetchMock = vi.fn(async (url, init = {}) => {
    const path = url.replace(API_BASE_URL, '');
    const call = { path, method: init.method || 'GET', auth: init.headers?.Authorization ?? null, body: init.body ? JSON.parse(init.body) : undefined };
    calls.push(call);
    const { status, body } = await handler(call);
    return json(status, body);
  });
  vi.stubGlobal('fetch', fetchMock);
  return calls;
}

beforeEach(() => clearTokens());
afterEach(() => vi.unstubAllGlobals());

describe('apiRequest', () => {
  test('sends JSON with the bearer token and returns the JSON answer', async () => {
    setTokens({ accessToken: 'a1', refreshToken: 'r1' });
    const calls = stubFetch(() => ({ status: 200, body: { hello: 'world' } }));
    expect(await apiRequest('/cart', { method: 'PUT', body: { items: [] } })).toEqual({ hello: 'world' });
    expect(calls).toEqual([{ path: '/cart', method: 'PUT', auth: 'Bearer a1', body: { items: [] } }]);
  });

  test('sends no Authorization header when signed out', async () => {
    const calls = stubFetch(() => ({ status: 200, body: {} }));
    await apiRequest('/auth/signin', { method: 'POST', body: {} });
    expect(calls[0].auth).toBeNull();
  });

  test('204 answers resolve to null', async () => {
    stubFetch(() => ({ status: 204 }));
    expect(await apiRequest('/addresses/1', { method: 'DELETE' })).toBeNull();
  });

  test('an error body becomes ApiError with message, code, field and status', async () => {
    stubFetch(() => ({ status: 409, body: { message: 'Your cart changed.', code: 'cart_changed', field: null } }));
    const error = await apiRequest('/orders', { method: 'POST', body: {} }).catch((e) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ message: 'Your cart changed.', code: 'cart_changed', field: null, status: 409 });
  });

  test('the store being unreachable keeps its own code and message', async () => {
    stubFetch(() => ({ status: 503, body: { message: "We can't reach the store right now. Please try again in a moment.", code: 'rof_unavailable', field: null } }));
    await expect(apiRequest('/products')).rejects.toMatchObject({ code: 'rof_unavailable', status: 503 });
  });

  test('a failed fetch (server down, offline) becomes code network', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    }));
    await expect(apiRequest('/products')).rejects.toMatchObject({ code: 'network', message: expect.stringMatching(/can't reach kuraat/i) });
  });
});

describe('expired access token', () => {
  test('parallel 401s share one refresh, store the rotated tokens and retry each request', async () => {
    setTokens({ accessToken: 'old', refreshToken: 'r1' });
    const calls = stubFetch(async (call) => {
      if (call.path === '/auth/refresh') {
        await new Promise((r) => setTimeout(r, 5));
        return { status: 200, body: { tokens: { accessToken: 'new', refreshToken: 'r2', expiresIn: 900 } } };
      }
      if (call.auth === 'Bearer old') return { status: 401, body: { message: 'Please sign in again.', code: 'unauthorized', field: null } };
      return { status: 200, body: { path: call.path } };
    });
    const [a, b] = await Promise.all([apiRequest('/cart'), apiRequest('/orders')]);
    expect([a, b]).toEqual([{ path: '/cart' }, { path: '/orders' }]);
    expect(calls.filter((c) => c.path === '/auth/refresh')).toEqual([expect.objectContaining({ body: { refreshToken: 'r1' } })]);
    expect(getTokens()).toEqual({ accessToken: 'new', refreshToken: 'r2' });
  });

  test('a 401 that arrives after another request refreshed just retries with the new token', async () => {
    setTokens({ accessToken: 'old', refreshToken: 'r1' });
    let release;
    const slow = new Promise((r) => (release = r));
    const calls = stubFetch(async (call) => {
      if (call.path === '/auth/refresh') return { status: 200, body: { tokens: { accessToken: 'new', refreshToken: 'r2' } } };
      if (call.path === '/slow' && call.auth === 'Bearer old') {
        await slow;
        return { status: 401, body: { code: 'unauthorized', message: 'x' } };
      }
      if (call.auth === 'Bearer old') return { status: 401, body: { code: 'unauthorized', message: 'x' } };
      return { status: 200, body: { ok: call.path } };
    });
    const slowRequest = apiRequest('/slow');
    expect(await apiRequest('/fast')).toEqual({ ok: '/fast' });
    release();
    expect(await slowRequest).toEqual({ ok: '/slow' });
    expect(calls.filter((c) => c.path === '/auth/refresh')).toHaveLength(1);
  });

  test('when the refresh fails: tokens cleared, signed-out listeners told once, requests rejected', async () => {
    setTokens({ accessToken: 'old', refreshToken: 'r1' });
    stubFetch(() => ({ status: 401, body: { message: 'Please sign in again.', code: 'unauthorized', field: null } }));
    const listener = vi.fn();
    const off = onSignedOut(listener);
    const results = await Promise.allSettled([apiRequest('/cart'), apiRequest('/orders')]);
    off();
    expect(results.map((r) => r.status)).toEqual(['rejected', 'rejected']);
    expect(results[0].reason).toMatchObject({ code: 'unauthorized', status: 401 });
    expect(listener).toHaveBeenCalledTimes(1);
    expect(getTokens()).toBeNull();
  });

  test('a 401 without a session is passed through without refreshing', async () => {
    const calls = stubFetch(() => ({ status: 401, body: { message: 'Please sign in again.', code: 'unauthorized', field: null } }));
    await expect(apiRequest('/auth/otp/request', { method: 'POST', body: {} })).rejects.toMatchObject({ code: 'unauthorized' });
    expect(calls).toHaveLength(1);
  });
});

describe('requests that never answer', () => {
  /** fetch that only settles when its signal aborts (an unreachable server on a phone's Wi-Fi). */
  const hangingFetch = () =>
    vi.fn(
      (url, init = {}) =>
        new Promise((_, reject) => {
          init.signal?.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
        }),
    );

  afterEach(() => vi.useRealTimers());

  test('give up after 15 s with the network message, so start-up never hangs', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', hangingFetch());
    const result = apiRequest('/me').catch((e) => e);
    await vi.advanceTimersByTimeAsync(15_000);
    expect(await result).toMatchObject({ name: 'ApiError', code: 'network' });
  });

  test('a longer limit can be given per request (placing an order waits for RSOF)', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', hangingFetch());
    let settled = false;
    const result = apiRequest('/orders', { method: 'POST', body: {}, timeoutMs: 60_000 })
      .catch((e) => e)
      .finally(() => {
        settled = true;
      });
    await vi.advanceTimersByTimeAsync(15_000);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(45_000);
    expect(await result).toMatchObject({ code: 'network' });
  });

  test("the caller's own abort still rejects as an AbortError", async () => {
    vi.stubGlobal('fetch', hangingFetch());
    const controller = new AbortController();
    const result = apiRequest('/me', { signal: controller.signal }).catch((e) => e);
    controller.abort();
    expect(await result).toMatchObject({ name: 'AbortError' });
  });
});
