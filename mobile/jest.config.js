/** UI tests (React Native Testing Library). Logic tests run in Vitest (vitest.config.mjs). */
module.exports = {
  preset: 'jest-expo',
  testMatch: ['<rootDir>/src/**/*.test.tsx'],
  setupFiles: ['<rootDir>/jest.setup.ts'],
  resolver: '<rootDir>/jest.resolver.js',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    // Lucide ships ESM (.mjs) for bundlers; Jest uses its CommonJS build.
    '^lucide-react-native/icons/(.*)$': '<rootDir>/node_modules/lucide-react-native/dist/cjs/icons/$1.js',
    '^lucide-react-native$': '<rootDir>/node_modules/lucide-react-native/dist/cjs/lucide-react-native.js',
  },
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@shopify/flash-list|lucide-react-native|react-native-svg)',
  ],
};
