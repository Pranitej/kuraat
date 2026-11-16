import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';

// Times in the app are Saudi time whatever the browser's zone: run the tests somewhere else
// (New York) so a formatter that forgets the shift fails here, not in a customer's browser.
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
