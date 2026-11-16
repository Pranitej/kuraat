// Expo's flat ESLint config. The files shared with ../client are linted there.
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: [
      'node_modules/**',
      '.expo/**',
      '.export-check/**',
      'src/domain/**',
      'src/services/**',
      'src/test/stubFetch.js',
      'src/theme/tokens.js',
      'src/config/routes.js',
      'src/config/options.js',
      'src/hooks/useDeliveryQuote.js',
    ],
  },
  {
    // The data providers mirror the web app's on purpose (same reset-on-sign-out effects and
    // ref-based sync callbacks), so these two React Compiler advisories are warnings here.
    files: ['src/context/**', 'src/hooks/**'],
    rules: {
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/refs': 'warn',
    },
  },
  {
    // jest.mock factories must require() their replacement modules.
    files: ['**/*.test.ts', '**/*.test.tsx', 'src/test/**'],
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
]);
