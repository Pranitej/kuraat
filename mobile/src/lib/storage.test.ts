import { beforeEach, describe, expect, test, vi } from 'vitest';
import kv from 'expo-sqlite/kv-store';
import * as secure from 'expo-secure-store';
import { local, session, tokenStore } from './storage.js';
import { API_BASE_URL } from './env.js';

const kvData = (kv as unknown as { __data: Map<string, string> }).__data;
const secureData = (secure as unknown as { __data: Map<string, string> }).__data;
const secureCalls = (secure as unknown as { __calls: string[] }).__calls;

beforeEach(() => {
  kvData.clear();
  local.clearAll();
  session.clearAll();
  tokenStore.remove();
  secureCalls.length = 0;
});

describe('local (device storage)', () => {
  test('round-trips JSON under the kuraat:v1: namespace', () => {
    local.write('checkout', { addressId: 'a1' });
    expect(kvData.get('kuraat:v1:checkout')).toBe('{"addressId":"a1"}');
    expect(local.read('checkout')).toEqual({ addressId: 'a1' });
  });

  test('a corrupt value gives the fallback instead of throwing', () => {
    kvData.set('kuraat:v1:bad', '{not json');
    expect(local.read('bad', 'fallback')).toBe('fallback');
  });

  test('clearAll removes only kuraat keys', () => {
    kvData.set('other-app', 'x');
    local.write('a', 1);
    local.clearAll();
    expect([...kvData.keys()]).toEqual(['other-app']);
  });
});

describe('session (one app launch)', () => {
  test('is kept in memory, never on the device', () => {
    session.write('otp', { challengeId: 'c1' });
    expect(session.read('otp')).toEqual({ challengeId: 'c1' });
    expect([...kvData.keys()]).toEqual([]);
  });
});

describe('tokenStore (keychain / keystore)', () => {
  test('write is readable at once and saved to the secure store; remove deletes it', async () => {
    tokenStore.write({ accessToken: 'a1', refreshToken: 'r1', expiresIn: 900 } as never);
    expect(tokenStore.read()).toEqual({ accessToken: 'a1', refreshToken: 'r1' });
    await Promise.resolve();
    expect(JSON.parse(secureData.get('kuraat.auth') as string)).toEqual({ accessToken: 'a1', refreshToken: 'r1' });
    tokenStore.remove();
    expect(tokenStore.read()).toBeNull();
    await Promise.resolve();
    expect(secureData.has('kuraat.auth')).toBe(false);
  });

  test('after an app restart the session is read from the secure store once', async () => {
    vi.resetModules();
    const freshSecure = (await import('expo-secure-store')) as unknown as { __data: Map<string, string>; __calls: string[] };
    freshSecure.__data.set('kuraat.auth', JSON.stringify({ accessToken: 'a2', refreshToken: 'r2' }));
    const fresh = await import('./storage.js');
    expect(fresh.tokenStore.read()).toEqual({ accessToken: 'a2', refreshToken: 'r2' });
    expect(fresh.tokenStore.read()).toEqual({ accessToken: 'a2', refreshToken: 'r2' });
    expect(freshSecure.__calls).toEqual(['get:kuraat.auth']);
  });

  test('local.clearAll also signs the device out (the web keeps tokens in local storage)', () => {
    tokenStore.write({ accessToken: 'a1', refreshToken: 'r1' });
    local.clearAll();
    expect(tokenStore.read()).toBeNull();
  });
});

describe('env', () => {
  test('API_BASE_URL comes from the Expo config without a trailing slash', () => {
    expect(API_BASE_URL).toBe('http://localhost:4000/api/v1');
  });
});
