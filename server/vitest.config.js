import { existsSync } from 'node:fs';
import { defineConfig } from 'vitest/config';

// Tests read the same .env as the app for the database (TEST_DATABASE_URL…). The RSOF settings are pinned below:
// the real RSOF login in .env must never reach a test, because a test that placed an order would create a real one.
// The same goes for the WhatsApp settings: a test that asked for a code must never send a real message.
if (existsSync('.env')) process.loadEnvFile('.env');

export default defineConfig({
  test: {
    include: ['tests/**/*.test.js'],
    // One shared test database: run files one after another.
    fileParallelism: false,
    testTimeout: 15000,
    hookTimeout: 30000,
    // Cheap password hashing keeps auth tests fast (real environments use 12).
    env: {
      PASSWORD_HASH_COST: '4',
      AUTH_RATE_LIMIT_PER_MINUTE: '1000',
      // Unreachable on purpose; tests that need RSOF start the in-process stand-in (tests/helpers/mockRof.js).
      ROF_BASE_URL: 'http://127.0.0.1:1',
      ROF_MEDIA_BASE_URL: '',
      ROF_EMAIL: 'test@example.invalid',
      ROF_PASSWORD: 'test-only',
      ROF_INVENTORY_CHECK: 'false',
      ROF_TIMEOUT_MS: '10000',
      // A real payment-link key in .env must never reach a test either (tests use the stand-in's own key).
      ROF_API_KEY: '',
      // The tests place cash orders: cash is ON here whatever the developer's .env says (new tests turn it off in the config).
      CASH_PAYMENTS_ENABLED: 'true',
      // Login codes: always the fixed test code, never a real WhatsApp message, whatever the developer's .env says
      // (tests that need WhatsApp mode set it on the test config and use a stub client).
      OTP_MODE: 'test',
      OTP_TEST_CODE: '123456',
      WHATSAPP_API_USER: '',
      WHATSAPP_API_PASSWORD: '',
      WHATSAPP_SENDER: '',
      WHATSAPP_TEMPLATE_NAME: '',
    },
  },
});
