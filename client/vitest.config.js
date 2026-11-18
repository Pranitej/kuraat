import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';

// Times in the app follow the device's time zone: run the tests in New York so a formatter that hard-codes
// a zone (Saudi time, UTC) fails here, not in a customer's browser.
process.env.TZ = 'America/New_York';

export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    include: ['src/**/*.test.js'],
    environment: 'node',
  },
});
