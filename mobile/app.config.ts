/**
 * Expo app config — one file, three variants (APP_VARIANT):
 *   development  kuraat (dev)      com.rsof.kuraat.dev      laptop API over the LAN (http allowed)
 *   preview      kuraat (preview)  com.rsof.kuraat.preview  UAT API (https only), internal builds
 *   production   kuraat            com.rsof.kuraat          production API (https only), store builds
 * Different ids let dev, preview and store builds sit side by side on one test phone.
 */
import type { ConfigContext, ExpoConfig } from 'expo/config';

type Variant = 'development' | 'preview' | 'production';

const VARIANT = (process.env.APP_VARIANT as Variant) || 'development';
const APP_ID = 'com.rsof.kuraat';
const IDS: Record<Variant, string> = { development: `${APP_ID}.dev`, preview: `${APP_ID}.preview`, production: APP_ID };
const NAMES: Record<Variant, string> = { development: 'kuraat (dev)', preview: 'kuraat (preview)', production: 'kuraat' };

const API_BASE_URL = (process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:4000/api/v1').replace(/\/+$/, '');
if (VARIANT !== 'development' && !API_BASE_URL.startsWith('https://')) {
  throw new Error(`EXPO_PUBLIC_API_BASE_URL must be an https:// URL for ${VARIANT} builds (got ${API_BASE_URL}).`);
}

/**
 * EAS project @pranitejrsof/kuraat (created with `eas init`, 2026-11-17). The id is not a secret.
 * EAS_PROJECT_ID / EAS_OWNER override both if the app moves to another Expo account later.
 */
const EAS_PROJECT_ID = process.env.EAS_PROJECT_ID || 'e3508d94-a503-4b32-b38b-bdf0ed4e3682';
const EAS_OWNER = process.env.EAS_OWNER || 'pranitejrsof';
const MAROON = '#781232';
const CREAM = '#FBF5EF';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: NAMES[VARIANT],
  owner: EAS_OWNER,
  slug: 'kuraat',
  scheme: VARIANT === 'production' ? 'kuraat' : `kuraat-${VARIANT}`,
  version: '1.0.0',
  orientation: 'portrait',
  userInterfaceStyle: 'light',
  icon: './assets/icon.png',
  backgroundColor: CREAM,
  runtimeVersion: { policy: 'fingerprint' },
  updates: { url: `https://u.expo.dev/${EAS_PROJECT_ID}` },
  ios: {
    bundleIdentifier: IDS[VARIANT],
    supportsTablet: false,
    config: { usesNonExemptEncryption: false },
    infoPlist: {
      CFBundleDevelopmentRegion: 'en',
      CFBundleAllowMixedLocalizations: true,
    },
  },
  android: {
    package: IDS[VARIANT],
    adaptiveIcon: { foregroundImage: './assets/adaptive-icon.png', backgroundColor: MAROON },
    // Only what the app uses: the photo picker needs no storage permission on Android 13+.
    blockedPermissions: ['android.permission.RECORD_AUDIO', 'android.permission.SYSTEM_ALERT_WINDOW'],
  },
  plugins: [
    'expo-router',
    ['expo-splash-screen', { image: './assets/splash-icon.png', imageWidth: 200, backgroundColor: MAROON, resizeMode: 'contain' }],
    'expo-image',
    'expo-secure-store',
    'expo-sqlite',
    [
      'expo-image-picker',
      { photosPermission: 'kuraat uses your photos to set your profile picture.', cameraPermission: false, microphonePermission: false },
    ],
    ['expo-localization', { supportsRTL: false }],
    ['expo-build-properties', { android: { usesCleartextTraffic: VARIANT === 'development' } }],
  ],
  experiments: { typedRoutes: true, reactCompiler: true },
  extra: {
    variant: VARIANT,
    apiBaseUrl: API_BASE_URL,
    sentryDsn: process.env.EXPO_PUBLIC_SENTRY_DSN || null,
    eas: { projectId: EAS_PROJECT_ID },
  },
});
