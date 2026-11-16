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
]);
