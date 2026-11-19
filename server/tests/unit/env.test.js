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
    expect(c.pollIntervalMs).toBe(60000);
    expect(c.authRateLimitPerMinute).toBe(20);
  });

  describe('WhatsApp login codes', () => {
    const whatsapp = { WHATSAPP_API_USER: 'api-user', WHATSAPP_API_PASSWORD: 'api-secret', WHATSAPP_SENDER: '+15550001111', WHATSAPP_TEMPLATE_NAME: 'login_code' };

    test('test mode needs no WhatsApp settings, and nothing is required', () => {
      const c = loadConfig(valid);
      expect(c.otp.mode).toBe('test');
      expect(c.whatsapp).toMatchObject({ baseUrl: 'https://app.rofconsole.com/messaging', user: null, password: null, sender: null, templateName: null, language: 'en', timeoutMs: 10000 });
    });

    test('whatsapp mode reads the API user, password, sender, template and language', () => {
      const c = loadConfig({ ...valid, OTP_MODE: 'whatsapp', ...whatsapp, WHATSAPP_API_BASE_URL: 'https://messaging.example.test/messaging/', WHATSAPP_TEMPLATE_LANGUAGE: 'ar' });
      expect(c.otp.mode).toBe('whatsapp');
      expect(c.whatsapp).toEqual({
        baseUrl: 'https://messaging.example.test/messaging',
        user: 'api-user',
        password: 'api-secret',
        sender: '+15550001111',
        templateName: 'login_code',
        language: 'ar',
        timeoutMs: 10000,
      });
    });

    test('whatsapp mode names every missing setting instead of failing later when a code is sent', () => {
      expect(() => loadConfig({ ...valid, OTP_MODE: 'whatsapp' })).toThrow(/WHATSAPP_API_USER, WHATSAPP_API_PASSWORD, WHATSAPP_SENDER, WHATSAPP_TEMPLATE_NAME/);
      expect(() => loadConfig({ ...valid, OTP_MODE: 'whatsapp', ...whatsapp, WHATSAPP_SENDER: '' })).toThrow(/WHATSAPP_SENDER/);
    });
  });

  test('drops a trailing slash from ROF_BASE_URL', () => {
    expect(loadConfig({ ...valid, ROF_BASE_URL: 'https://rofuat.rsof.com.sa/' }).rof.baseUrl).toBe('https://rofuat.rsof.com.sa');
  });

  test('photo links use ROF_BASE_URL unless ROF_MEDIA_BASE_URL is set (phones on the LAN in development)', () => {
    expect(loadConfig(valid).rof.mediaBaseUrl).toBe('http://localhost:8080');
    expect(loadConfig({ ...valid, ROF_MEDIA_BASE_URL: 'http://192.168.1.10:8080/' }).rof.mediaBaseUrl).toBe('http://192.168.1.10:8080');
    expect(() => loadConfig({ ...valid, ROF_MEDIA_BASE_URL: 'not a url' })).toThrow(/ROF_MEDIA_BASE_URL/);
  });

  test('parses booleans from text', () => {
    const c = loadConfig({ ...valid, ROF_INVENTORY_CHECK: 'true' });
    expect(c.rof.inventoryCheck).toBe(true);
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

describe('production guards (nothing fake goes live by accident)', () => {
  const prod = { ...valid, NODE_ENV: 'production' };

  test('test login codes are refused in production unless acknowledged', () => {
    expect(() => loadConfig(prod)).toThrow(/OTP_MODE=test/);
  });

  test('real WhatsApp codes in production start (card payments are real: RSOF payment links, nothing simulated)', () => {
    const whatsapp = { OTP_MODE: 'whatsapp', WHATSAPP_API_USER: 'u', WHATSAPP_API_PASSWORD: 'p', WHATSAPP_SENDER: '+15550001111', WHATSAPP_TEMPLATE_NAME: 'login_code' };
    expect(() => loadConfig({ ...prod, ...whatsapp })).not.toThrow();
  });

  test('test codes acknowledged (a demo / UAT launch) starts', () => {
    expect(() => loadConfig({ ...prod, OTP_ALLOW_TEST_IN_PRODUCTION: 'true' })).not.toThrow();
  });

  test('the payment-link API key is optional; without it card payments are off', () => {
    expect(loadConfig(valid).rof.paymentApiKey).toBeNull();
    expect(loadConfig({ ...valid, ROF_PAYMENT_API_KEY: '  rofi_1234abcd_secret  ' }).rof.paymentApiKey).toBe('rofi_1234abcd_secret');
  });

  test('outside production neither guard applies', () => {
    expect(() => loadConfig(valid)).not.toThrow();
  });

  test('no promo codes, VAT setting or delivery fee exist in the config', () => {
    const c = loadConfig(valid);
    expect(c).not.toHaveProperty('promos');
    expect(c).not.toHaveProperty('pricesIncludeVat');
  });
});
