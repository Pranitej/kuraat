/**
 * Mobile platform file — same export as client/src/lib/env.js: where the kuraat server API is.
 * Set by app.config.ts from EXPO_PUBLIC_API_BASE_URL (mobile/.env); a phone needs the laptop's
 * LAN IP in development, and an https:// URL in preview/production builds.
 */
import Constants from 'expo-constants';

const configured = Constants.expoConfig?.extra?.apiBaseUrl || 'http://localhost:4000/api/v1';

export const API_BASE_URL = String(configured).replace(/\/+$/, '');
