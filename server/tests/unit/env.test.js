import { describe, expect, test } from 'vitest';
import { loadConfig } from '../../src/config/env.js';

const valid = {
  DATABASE_URL: 'mysql://u:p@h:3307/d',
  JWT_ACCESS_SECRET: 'a'.repeat(32),
  JWT_REFRESH_SECRET: 'b'.repeat(32),
  ROF_BASE_URL: 'http://localhost:8080',
  ROF_EMAIL: 'x@y.z',
  ROF_PASSWORD: 'p',
  CORS_ORIGINS: 'http://a,http://b',
};

describe('loadConfig', () => {
  test('reads defaults and lists', () => {
    const c = loadConfig(valid);
    expect(c.port).toBe(4000);
    expect(c.corsOrigins).toEqual(['http://a', 'http://b']);
    expect(c.otp).toEqual({ mode: 'test', testCode: '123456' });
    expect(c.rof).toMatchObject({ baseUrl: 'http://localhost:8080', inventoryCheck: false, timeoutMs: 10000 });
    expect(c.jwt).toMatchObject({ accessTtlSec: 900, refreshTtlDays: 30 });
    expect(c.pricesIncludeVat).toBe(true);
    expect(c.pollIntervalMs).toBe(60000);
  });

  test('drops a trailing slash from ROF_BASE_URL', () => {
    expect(loadConfig({ ...valid, ROF_BASE_URL: 'https://rofuat.rsof.com.sa/' }).rof.baseUrl).toBe('https://rofuat.rsof.com.sa');
  });

  test('parses booleans from text', () => {
    const c = loadConfig({ ...valid, ROF_INVENTORY_CHECK: 'true', PRICES_INCLUDE_VAT: 'false' });
    expect(c.rof.inventoryCheck).toBe(true);
    expect(c.pricesIncludeVat).toBe(false);
  });

  test('password hash cost defaults to 12 and accepts 4–15', () => {
    expect(loadConfig(valid).passwordHashCost).toBe(12);
    expect(loadConfig({ ...valid, PASSWORD_HASH_COST: '4' }).passwordHashCost).toBe(4);
    expect(() => loadConfig({ ...valid, PASSWORD_HASH_COST: '3' })).toThrow(/PASSWORD_HASH_COST/);
  });

  test('rejects a missing ROF_BASE_URL', () => {
    expect(() => loadConfig({ ...valid, ROF_BASE_URL: undefined })).toThrow(/ROF_BASE_URL/);
  });

  test('rejects short JWT secrets', () => {
    expect(() => loadConfig({ ...valid, JWT_ACCESS_SECRET: 'short' })).toThrow(/JWT_ACCESS_SECRET/);
  });
});
