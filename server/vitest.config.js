import { existsSync } from 'node:fs';
import { defineConfig } from 'vitest/config';

// Tests read the same .env as the app (TEST_DATABASE_URL, ROF settings…).
if (existsSync('.env')) process.loadEnvFile('.env');

export default defineConfig({
  test: {
    include: ['tests/**/*.test.js'],
    // One shared test database: run files one after another.
    fileParallelism: false,
    testTimeout: 15000,
    hookTimeout: 30000,
    // Cheap password hashing keeps auth tests fast (real environments use 12).
    env: { PASSWORD_HASH_COST: '4' },
  },
});
