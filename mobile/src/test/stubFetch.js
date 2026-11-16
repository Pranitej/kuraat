/** Test utility: replace global fetch with a router. handler(call) → { status, body }. */
import { vi } from 'vitest';
import { API_BASE_URL } from '@/services/api.js';

export function stubFetch(handler) {
  const calls = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url, init = {}) => {
      const call = {
        path: url.replace(API_BASE_URL, ''),
        method: init.method || 'GET',
        auth: init.headers?.Authorization ?? null,
        body: init.body ? JSON.parse(init.body) : undefined,
      };
      calls.push(call);
      const { status = 200, body } = (await handler(call)) || {};
      return {
        ok: status >= 200 && status < 300,
        status,
        json: async () => {
          if (body === undefined) throw new SyntaxError('no body');
          return body;
        },
      };
    }),
  );
  return calls;
}
