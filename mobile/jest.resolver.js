/**
 * Reanimated 4's Jest resolver (uses the JS implementations of its UI-thread pieces) chained in
 * front of the React Native preset's resolver (which jest-expo uses), so both keep working.
 */
const reanimatedResolver = require('react-native-reanimated/jest/resolver');
const presetResolver = require('@react-native/jest-preset/jest/resolver');

module.exports = (request, options) => {
  const jestDefault = options.defaultResolver;
  return reanimatedResolver(request, {
    ...options,
    defaultResolver: (req, opts) => presetResolver(req, { ...opts, defaultResolver: jestDefault }),
  });
};
