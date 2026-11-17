/** Stand-in for `expo-constants` in logic tests. Mirrors app.config.ts `extra` (no API address: see lib/env.js). */
const Constants = { expoConfig: { extra: { variant: 'development' } } };
export default Constants;
