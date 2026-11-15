/**
 * ROF service-user token (guide §3.1). The token lasts ~60 minutes and login is limited to 5 calls
 * per minute, so: log in lazily, share one login between concurrent callers, renew 5 minutes before
 * expiry, and log in again only when a call is rejected with 401 (see client.js).
 */
import { RofError } from './errors.js';

const RENEW_BEFORE_MS = 5 * 60 * 1000;
const FALLBACK_LIFETIME_MS = 55 * 60 * 1000;

/** Reads `exp` from a JWT without verifying it (we only need to know when to renew). */
function expiryFromJwt(token) {
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));
    return typeof payload.exp === 'number' ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

export function createTokenManager({ baseUrl, email, password, timeoutMs = 10000, now = () => Date.now() }) {
  let current = null; // { token, tenantId, expiresAt }
  let inFlight = null;

  async function login() {
    let res;
    try {
      res = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ email, password }),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      throw new RofError('unavailable', `ROF login failed: ${error.message}`, { path: '/api/auth/login' });
    }
    if (res.status === 429 || res.status >= 500) {
      throw new RofError('unavailable', `ROF login answered HTTP ${res.status}`, { status: res.status, path: '/api/auth/login' });
    }
    const json = await res.json().catch(() => null);
    if (!json?.success || !json.data?.token) {
      throw new RofError('auth', `ROF login refused: ${json?.message || `HTTP ${res.status}`}`, {
        status: res.status,
        path: '/api/auth/login',
      });
    }
    const { token, tenantId } = json.data;
    const expiresAt = expiryFromJwt(token) ?? now() + FALLBACK_LIFETIME_MS;
    current = { token, tenantId, expiresAt };
    return current;
  }

  return {
    /** @returns {Promise<{ token: string, tenantId: string }>} */
    async get() {
      if (current && now() < current.expiresAt - RENEW_BEFORE_MS) return current;
      if (!inFlight) {
        inFlight = login().finally(() => {
          inFlight = null;
        });
      }
      return inFlight;
    },
    /** Forget the token (after a 401) so the next get() logs in again. */
    invalidate() {
      current = null;
    },
  };
}
