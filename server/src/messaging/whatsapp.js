/**
 * WhatsApp sender for login codes: RSOF's messaging API (the "ROF console" messaging service).
 *
 *   POST {base}/auth/token             { user, password } → { status, access_token, token_type, expires_in (s) }
 *   POST {base}/send_template_message  Bearer token, an approved AUTHENTICATION template filled with the code
 *
 * The access token lasts 24 h: log in lazily, share one login between concurrent sends, renew 5 minutes
 * before expiry, and log in again once when a send is answered with 401. The code itself is never logged
 * here; the caller decides what to log.
 */

const RENEW_BEFORE_MS = 5 * 60 * 1000;
const FALLBACK_LIFETIME_MS = 60 * 60 * 1000;

/**
 * - rejected:    the API answered but refused the message (not approved, number not allowed in testing, …).
 * - unavailable: network error, timeout, HTTP 5xx/429 or an unreadable reply.
 * - auth:        our API user/password were refused (configuration problem).
 */
export class MessagingError extends Error {
  constructor(kind, message, { status = null, path = null } = {}) {
    super(message);
    this.name = 'MessagingError';
    this.kind = kind;
    this.status = status;
    this.path = path;
  }
}

/** The body of POST /send_template_message for an AUTHENTICATION template: the code in the body and on the "copy code" button. */
export function authTemplateBody({ sender, phone, templateName, language, code }) {
  return {
    sender,
    recipient: { phone_number: phone },
    template: {
      name: templateName,
      language,
      category: 'AUTHENTICATION',
      components: [
        { type: 'body', parameters: [{ type: 'text', text: code }] },
        { type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'coupon_code', coupon_code: code }] },
      ],
    },
  };
}

export function createWhatsAppClient({ baseUrl, user, password, sender, templateName, language = 'en', timeoutMs = 10000, now = () => Date.now(), fetchImpl = fetch }) {
  const root = baseUrl.replace(/\/+$/, '');
  let current = null; // { token, expiresAt }
  let inFlight = null;

  async function post(path, body, token) {
    let res;
    try {
      res = await fetchImpl(root + path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      throw new MessagingError('unavailable', `WhatsApp API ${path} failed: ${error.message}`, { path });
    }
    const json = await res.json().catch(() => null);
    return { res, json };
  }

  async function login() {
    const { res, json } = await post('/auth/token', { user, password });
    if (res.status === 429 || res.status >= 500) {
      throw new MessagingError('unavailable', `WhatsApp API login answered HTTP ${res.status}`, { status: res.status, path: '/auth/token' });
    }
    if (!res.ok || json?.status === 'error' || !json?.access_token) {
      throw new MessagingError('auth', `WhatsApp API login refused: ${json?.message || `HTTP ${res.status}`}`, { status: res.status, path: '/auth/token' });
    }
    const lifetimeMs = Number(json.expires_in) > 0 ? Number(json.expires_in) * 1000 : FALLBACK_LIFETIME_MS;
    current = { token: json.access_token, expiresAt: now() + lifetimeMs };
    return current;
  }

  async function token() {
    if (current && now() < current.expiresAt - RENEW_BEFORE_MS) return current.token;
    if (!inFlight) {
      inFlight = login().finally(() => {
        inFlight = null;
      });
    }
    return (await inFlight).token;
  }

  async function sendTemplate(body, isRetry = false) {
    const { res, json } = await post('/send_template_message', body, await token());
    if (res.status === 401) {
      current = null;
      if (isRetry) throw new MessagingError('auth', 'WhatsApp API still unauthorised after a fresh login', { status: 401, path: '/send_template_message' });
      return sendTemplate(body, true);
    }
    if (res.status === 429 || res.status >= 500) {
      throw new MessagingError('unavailable', `WhatsApp API answered HTTP ${res.status}`, { status: res.status, path: '/send_template_message' });
    }
    const failed = !res.ok || json?.status === 'error' || json?.status === 'failed' || Boolean(json?.error);
    if (failed) {
      const reason = json?.message || (typeof json?.error === 'string' ? json.error : json?.error?.message) || `HTTP ${res.status}`;
      throw new MessagingError('rejected', `WhatsApp API refused the message: ${reason}`, { status: res.status, path: '/send_template_message' });
    }
    return json;
  }

  return {
    /**
     * Sends the login code as the approved authentication template.
     * @param {string} phone digits with the country code, no "+" (e.g. 966501234821, 971501234567)
     * @param {string} code
     * @returns {Promise<object|null>} the API's reply
     */
    sendAuthCode: (phone, code) => sendTemplate(authTemplateBody({ sender, phone, templateName, language, code })),
  };
}
