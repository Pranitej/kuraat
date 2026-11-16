/**
 * Jest twin of the shared test/stubFetch.js (which uses Vitest's `vi`): replaces global fetch with
 * a router. handler(call) → { status, body }. Returns the recorded calls.
 */
import { API_BASE_URL } from '@/services/api.js';

export type FetchCall = { path: string; method: string; auth: string | null; body: unknown };
type Reply = { status?: number; body?: unknown } | undefined | void;

export function jestFetch(handler: (call: FetchCall) => Reply | Promise<Reply>): FetchCall[] {
  const calls: FetchCall[] = [];
  global.fetch = jest.fn(async (url: string, init: RequestInit = {}) => {
    const headers = (init.headers || {}) as Record<string, string>;
    const call: FetchCall = {
      path: String(url).replace(API_BASE_URL, ''),
      method: init.method || 'GET',
      auth: headers.Authorization ?? null,
      body: init.body ? JSON.parse(String(init.body)) : undefined,
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
    } as Response;
  }) as unknown as typeof fetch;
  return calls;
}
