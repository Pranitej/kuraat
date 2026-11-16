/** UI tests (React Native Testing Library). Logic tests run in Vitest (vitest.config.mjs). */
module.exports = {
  preset: 'jest-expo',
  testMatch: ['<rootDir>/src/**/*.test.tsx'],
  setupFiles: ['<rootDir>/jest.setup.ts'],
  resolver: '<rootDir>/jest.resolver.js',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    // Same in-memory fakes as the logic tests (vitest.config.mjs) for the device stores.
    '^expo-sqlite/kv-store$': '<rootDir>/src/test/fakes/kvStore.ts',
    '^expo-secure-store$': '<rootDir>/src/test/fakes/secureStore.ts',
    '^expo-constants$': '<rootDir>/src/test/fakes/constants.ts',
    '^expo-crypto$': '<rootDir>/src/test/fakes/crypto.ts',
    // Lucide ships ESM (.mjs) for bundlers; Jest uses its CommonJS build.
    '^lucide-react-native/icons/(.*)$': '<rootDir>/node_modules/lucide-react-native/dist/cjs/icons/$1.js',
    '^lucide-react-native$': '<rootDir>/node_modules/lucide-react-native/dist/cjs/lucide-react-native.js',
    // Gesture Handler 3 binds to the native UI worklet runtime, which Jest does not have.
    '(^|/)installUIRuntimeBindings$': '<rootDir>/src/test/stubs/installUIRuntimeBindings.js',
  },
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@shopify/flash-list|lucide-react-native|react-native-svg|standard-navigation)',
  ],
};
