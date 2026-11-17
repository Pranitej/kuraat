import { afterEach, describe, expect, test, vi } from 'vitest';

const load = async () => (await import('./env.js')).API_BASE_URL;

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('API address', () => {
  test('comes from EXPO_PUBLIC_API_BASE_URL (inlined into the JS bundle), trailing slashes removed', async () => {
    vi.stubEnv('EXPO_PUBLIC_API_BASE_URL', 'http://192.168.1.10:4000/api/v1/');
    expect(await load()).toBe('http://192.168.1.10:4000/api/v1');
  });

  test('defaults to the local API when it is not set', async () => {
    vi.stubEnv('EXPO_PUBLIC_API_BASE_URL', '');
    expect(await load()).toBe('http://localhost:4000/api/v1');
  });

  test('is not read from the native app config (it would change the runtime version and break EAS builds)', async () => {
    vi.stubEnv('EXPO_PUBLIC_API_BASE_URL', '');
    vi.doMock('expo-constants', () => ({ default: { expoConfig: { extra: { apiBaseUrl: 'https://wrong.example.com/api/v1' } } } }));
    expect(await load()).toBe('http://localhost:4000/api/v1');
    vi.doUnmock('expo-constants');
  });
});
