import { existsSync } from 'node:fs';
import { defineConfig } from 'vitest/config';

// Tests read the same .env as the app for the database (TEST_DATABASE_URL…). The RSOF settings are pinned below:
// the real RSOF login in .env must never reach a test, because a test that placed an order would create a real one.
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
    },
  },
});
