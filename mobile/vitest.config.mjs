import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';

// Same rule as the web app: run somewhere that is not Saudi time, so a formatter that forgets the
// UTC+3 shift fails here and not on a customer's phone.
process.env.TZ = 'America/New_York';

const src = (p) => fileURLToPath(new URL(`./src/${p}`, import.meta.url));

/**
 * Logic tests (node): the files shared with ../client (identical tests) and the platform adapters.
 * Native modules are replaced by small in-memory fakes. UI tests run in Jest (jest.config.js).
 */
export default defineConfig({
  resolve: {
    alias: [
      { find: /^@\//, replacement: src('') },
      { find: 'expo-sqlite/kv-store', replacement: src('test/fakes/kvStore.ts') },
      { find: 'expo-secure-store', replacement: src('test/fakes/secureStore.ts') },
      { find: 'expo-constants', replacement: src('test/fakes/constants.ts') },
    ],
  },
  test: {
    include: ['src/{domain,services,lib,hooks,theme,config}/**/*.test.{js,ts}'],
    environment: 'node',
  },
});
