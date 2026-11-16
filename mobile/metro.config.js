// Default Expo Metro config; tsconfig "paths" (@/…) are resolved by Expo.
const { getDefaultConfig } = require('expo/metro-config');

module.exports = getDefaultConfig(__dirname);
