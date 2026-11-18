import { describe, expect, test } from 'vitest';
import { MessagingError, authTemplateBody, createWhatsAppClient } from '../../src/messaging/whatsapp.js';

const BASE = 'https://messaging.example.test/messaging';
const settings = { baseUrl: BASE, user: 'api-user', password: 'api-secret', sender: '+15550001111', templateName: 'login_code', language: 'en' };

/** A fake fetch: records every call and answers from `handle(call)`. */
function fakeFetch(handle) {
  const calls = [];
  const fetchImpl = async (url, init) => {
    const call = { url: String(url), method: init.method, headers: init.headers, body: JSON.parse(init.body) };
    calls.push(call);
    const { status = 200, body = {} } = await handle(call, calls);
    return { status, ok: status >= 200 && status < 300, json: async () => body };
  };
  return { fetchImpl, calls };
}
const LOGIN_OK = { status: 'success', access_token: 'tok-1', token_type: 'Bearer', expires_in: 86400 };
const isLogin = (c) => c.url === `${BASE}/auth/token`;

describe('the message body', () => {
  test('is the approved authentication template with the code in the body and on the copy-code button', () => {
    expect(authTemplateBody({ sender: '+15550001111', phone: '971501234567', templateName: 'login_code', language: 'en', code: '482913' })).toEqual({
      sender: '+15550001111',
      recipient: { phone_number: '971501234567' },
      template: {
        name: 'login_code',
        language: 'en',
        category: 'AUTHENTICATION',
        components: [
          { type: 'body', parameters: [{ type: 'text', text: '482913' }] },
          { type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'coupon_code', coupon_code: '482913' }] },
        ],
      },
    });
  });
});

describe('sending a code', () => {
  test('logs in with the API user, then posts the template with the Bearer token', async () => {
    const { fetchImpl, calls } = fakeFetch((c) => (isLogin(c) ? { body: LOGIN_OK } : { body: { status: 'success', message_id: 'm1' } }));
    const client = createWhatsAppClient({ ...settings, fetchImpl });
    const reply = await client.sendAuthCode('966501234821', '123456');
    expect(reply).toMatchObject({ status: 'success' });
    expect(calls).toHaveLength(2);
    expect(calls[0]).toMatchObject({ url: `${BASE}/auth/token`, method: 'POST', body: { user: 'api-user', password: 'api-secret' } });
    expect(calls[1]).toMatchObject({ url: `${BASE}/send_template_message`, method: 'POST' });
    expect(calls[1].headers.Authorization).toBe('Bearer tok-1');
    expect(calls[1].body.recipient).toEqual({ phone_number: '966501234821' });
    expect(calls[1].body.template.components[0].parameters[0].text).toBe('123456');
  });

  test('the token is reused for later sends, shared by sends at the same moment, and renewed 5 minutes before it expires', async () => {
    let clock = 1_000_000;
    let n = 0;
    const { fetchImpl, calls } = fakeFetch((c) => (isLogin(c) ? { body: { ...LOGIN_OK, access_token: `tok-${++n}`, expires_in: 3600 } } : { body: { status: 'success' } }));
    const client = createWhatsAppClient({ ...settings, fetchImpl, now: () => clock });
    await Promise.all([client.sendAuthCode('966501234821', '111111'), client.sendAuthCode('966501234822', '222222')]);
    await client.sendAuthCode('966501234823', '333333');
    expect(calls.filter(isLogin)).toHaveLength(1);
    clock += 3600_000 - 5 * 60_000 + 1; // inside the last 5 minutes of the token's life
    await client.sendAuthCode('966501234824', '444444');
    expect(calls.filter(isLogin)).toHaveLength(2);
    expect(calls.at(-1).headers.Authorization).toBe('Bearer tok-2');
  });

  test('a send answered with 401 logs in again once and retries; a second 401 is an auth error', async () => {
    let sends = 0;
    const { fetchImpl, calls } = fakeFetch((c) => {
      if (isLogin(c)) return { body: LOGIN_OK };
      sends += 1;
      return sends === 1 ? { status: 401, body: { message: 'expired' } } : { body: { status: 'success' } };
    });
    await createWhatsAppClient({ ...settings, fetchImpl }).sendAuthCode('966501234821', '123456');
    expect(calls.filter(isLogin)).toHaveLength(2);

    const stuck = fakeFetch((c) => (isLogin(c) ? { body: LOGIN_OK } : { status: 401, body: {} }));
    await expect(createWhatsAppClient({ ...settings, fetchImpl: stuck.fetchImpl }).sendAuthCode('966501234821', '123456')).rejects.toMatchObject({ kind: 'auth' });
  });
});

describe('failures', () => {
  const send = (handle) => createWhatsAppClient({ ...settings, fetchImpl: fakeFetch(handle).fetchImpl }).sendAuthCode('966501234821', '123456');

  test('a refused login is an auth error with the API message', async () => {
    const err = await send((c) => (isLogin(c) ? { status: 401, body: { status: 'error', message: 'Invalid credentials' } } : {})).catch((e) => e);
    expect(err).toBeInstanceOf(MessagingError);
    expect(err).toMatchObject({ kind: 'auth' });
    expect(err.message).toContain('Invalid credentials');
  });

  test('the API refusing the message (e.g. a number not allowed while testing) is "rejected" with its reason', async () => {
    const err = await send((c) => (isLogin(c) ? { body: LOGIN_OK } : { status: 400, body: { status: 'error', message: 'Recipient is not in the allowed list' } })).catch((e) => e);
    expect(err).toMatchObject({ kind: 'rejected', status: 400 });
    expect(err.message).toContain('Recipient is not in the allowed list');
  });

  test('HTTP 200 with an error status in the body is still a failure', async () => {
    await expect(send((c) => (isLogin(c) ? { body: LOGIN_OK } : { body: { status: 'error', message: 'Template not approved' } }))).rejects.toMatchObject({ kind: 'rejected' });
  });

  test('a server error, throttling or no network is "unavailable"', async () => {
    await expect(send((c) => (isLogin(c) ? { body: LOGIN_OK } : { status: 503, body: {} }))).rejects.toMatchObject({ kind: 'unavailable' });
    await expect(send((c) => (isLogin(c) ? { body: LOGIN_OK } : { status: 429, body: {} }))).rejects.toMatchObject({ kind: 'unavailable' });
    const offline = createWhatsAppClient({
      ...settings,
      fetchImpl: async () => {
        throw new TypeError('fetch failed');
      },
    });
    await expect(offline.sendAuthCode('966501234821', '123456')).rejects.toMatchObject({ kind: 'unavailable' });
  });
});
