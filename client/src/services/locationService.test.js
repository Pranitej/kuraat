import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { local, session } from '@/lib/storage.js';
import { stubFetch } from '@/test/stubFetch.js';
import { setTokens } from './api.js';
import { captureLocationOnce, saveLocation } from './locationService.js';

const HERE = { lat: 26.2874, lng: 50.2085 };
const okServer = () => stubFetch((c) => (c.path === '/me/location' ? { status: 204 } : undefined));
const puts = (calls) => calls.filter((c) => c.path === '/me/location' && c.method === 'PUT');

beforeEach(() => {
  local.clearAll();
  session.clearAll();
  setTokens({ accessToken: 'a1', refreshToken: 'r1' });
});
afterEach(() => vi.unstubAllGlobals());

describe('saveLocation', () => {
  test('PUT /me/location with lat and lng', async () => {
    const calls = okServer();
    await saveLocation(HERE);
    expect(puts(calls)).toEqual([expect.objectContaining({ body: { lat: 26.2874, lng: 50.2085 } })]);
  });
});

describe('captureLocationOnce (design 2026-11-18 §5.6)', () => {
  test('asks for the position and saves it once per session', async () => {
    const calls = okServer();
    const getPosition = vi.fn(async () => HERE);
    expect(await captureLocationOnce('u1', getPosition)).toBe('saved');
    expect(await captureLocationOnce('u1', getPosition)).toBe('skipped');
    expect(getPosition).toHaveBeenCalledTimes(1);
    expect(puts(calls)).toHaveLength(1);
  });

  test('another customer signing in in the same session is captured too', async () => {
    const calls = okServer();
    await captureLocationOnce('u1', async () => HERE);
    expect(await captureLocationOnce('u2', async () => HERE)).toBe('saved');
    expect(puts(calls)).toHaveLength(2);
  });

  test('refused or no position: nothing is sent and we do not ask again this session', async () => {
    const calls = okServer();
    expect(await captureLocationOnce('u1', async () => null)).toBe('unavailable');
    expect(await captureLocationOnce('u1', async () => HERE)).toBe('skipped');
    expect(puts(calls)).toHaveLength(0);
  });

  test('a position error counts as unavailable', async () => {
    okServer();
    expect(
      await captureLocationOnce('u1', async () => {
        throw new Error('timeout');
      }),
    ).toBe('unavailable');
  });

  test('a server error is swallowed (never breaks Home)', async () => {
    stubFetch(() => ({ status: 503, body: { code: 'rof_unavailable', message: 'down' } }));
    expect(await captureLocationOnce('u1', async () => HERE)).toBe('failed');
  });
});
