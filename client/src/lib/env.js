/**
 * Where the kuraat server API is. One of the two platform files the shared services depend on
 * (the other is lib/storage.js): the mobile app has its own copy reading the Expo config.
 */
export const API_BASE_URL = (import.meta.env?.VITE_API_BASE_URL || 'http://localhost:4000/api/v1').replace(/\/+$/, '');

/** Which app this is; orders carry it so RSOF staff see "Website" or "MobileApp" as the order's source. */
export const CLIENT_CHANNEL = 'web';
