/**
 * Mobile platform file — same export as client/src/lib/env.js: where the kuraat server API is.
 *
 * Read from EXPO_PUBLIC_API_BASE_URL (mobile/.env locally, eas.json / EAS env for builds). Expo
 * inlines EXPO_PUBLIC_* values into the JavaScript bundle, so the address is NOT part of the native
 * app config. That matters: anything in app.config's `extra` feeds the expo-updates fingerprint
 * (runtime version), and mobile/.env never reaches EAS, so an address there made EAS refuse the
 * build ("Runtime version mismatch"). Keep the literal `process.env.EXPO_PUBLIC_API_BASE_URL`
 * (Expo only inlines that exact form). `npm run check:fingerprint` guards this.
 *
 * A phone needs the laptop's LAN IP in development, and an https:// URL in preview/production
 * builds (app.config.ts refuses anything else for those builds).
 */
const configured = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:4000/api/v1';

export const API_BASE_URL = String(configured).replace(/\/+$/, '');

/** Which app this is; orders carry it so RSOF staff see "Website" or "MobileApp" as the order's source. */
export const CLIENT_CHANNEL = 'mobile';
