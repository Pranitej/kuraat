/**
 * The one HTTP client for the kuraat server API (server/README.md). Every service calls
 * `apiRequest`; nothing else in the app talks to the network.
 *
 * - JSON in, JSON out; errors are the server's { message, code, field } as `ApiError`.
 * - Signed in = access + refresh token in the platform token store (lib/storage.js). A 401
 *   triggers one shared refresh (the server rotates the refresh token), then the request is
 *   retried once. If the refresh fails, the session is cleared and `onSignedOut` listeners are
 *   told — once.
 * - Shared byte-for-byte with the mobile app; platform differences live in lib/env.js and
 *   lib/storage.js only.
 */
import { API_BASE_URL } from '../lib/env.js';
import { tokenStore } from '../lib/storage.js';

export { API_BASE_URL };

const NETWORK_MESSAGE = "We can't reach kuraat right now. Check your connection and try again.";
const GENERIC_MESSAGE = 'Something went wrong. Please try again.';

export class ApiError extends Error {
  constructor(message, { code = 'error', field = null, status = 0 } = {}) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.field = field;
    this.status = status;
  }
}

/* ---------------- Session tokens ---------------- */

export function getTokens() {
  const t = tokenStore.read();
  return t?.accessToken && t?.refreshToken ? t : null;
}

export function setTokens({ accessToken, refreshToken }) {
  tokenStore.write({ accessToken, refreshToken });
}

export function clearTokens() {
  tokenStore.remove();
}

const signedOutListeners = new Set();

/** Called when the session ends because it could not be refreshed. Returns an unsubscribe. */
export function onSignedOut(listener) {
  signedOutListeners.add(listener);
  return () => signedOutListeners.delete(listener);
}

function endSession() {
  if (!getTokens()) return; // another request already ended it
  clearTokens();
  signedOutListeners.forEach((fn) => fn());
}

/* ---------------- Requests ---------------- */

async function send(path, { method = 'GET', body, signal, token }) {
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  let res;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal });
  } catch (error) {
    if (error?.name === 'AbortError') throw error;
    throw new ApiError(NETWORK_MESSAGE, { code: 'network' });
  }
  if (res.status === 204) return null;
  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  if (!res.ok) {
    throw new ApiError(data?.message || GENERIC_MESSAGE, { code: data?.code || 'error', field: data?.field ?? null, status: res.status });
  }
  return data;
}

let refreshing = null;

/** One refresh at a time; concurrent callers share it. Resolves true when new tokens are stored. */
function refreshSession() {
  if (!refreshing) {
    refreshing = (async () => {
      const tokens = getTokens();
      if (!tokens) return false;
      try {
        const res = await send('/auth/refresh', { method: 'POST', body: { refreshToken: tokens.refreshToken } });
        setTokens(res.tokens);
        return true;
      } catch {
        return false;
      }
    })().finally(() => {
      refreshing = null;
    });
  }
  return refreshing;
}

/**
 * @param {string} path  e.g. '/cart' (relative to API_BASE_URL)
 * @param {{ method?: string, body?: any, signal?: AbortSignal }} [options]
 */
export async function apiRequest(path, options = {}) {
  const token = getTokens()?.accessToken ?? null;
  try {
    return await send(path, { ...options, token });
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 401 || !token) throw error;
    // Another request may have refreshed while this one was in flight.
    const current = getTokens()?.accessToken;
    const renewed = current && current !== token ? true : await refreshSession();
    if (!renewed) {
      endSession();
      throw new ApiError('Please sign in again.', { code: 'unauthorized', status: 401 });
    }
    return send(path, { ...options, token: getTokens().accessToken });
  }
}
