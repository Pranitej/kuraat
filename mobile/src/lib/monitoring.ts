/**
 * Error reporting seam. Today: logged in development, silent in release builds. When the company
 * has a crash-reporting account (e.g. Sentry: `npx expo install @sentry/react-native`, set
 * EXPO_PUBLIC_SENTRY_DSN), wire it in `initMonitoring` and `report` only — nothing else changes.
 * Personal data never leaves the phone in reports (see SENSITIVE).
 */
const SENSITIVE = /phone|password|card|cvv|token|address|otp|code|upi|email|name/i;

type Context = Record<string, unknown>;

/** Drops values whose key looks personal or secret. */
export function scrub(context: Context = {}): Context {
  return Object.fromEntries(Object.entries(context).map(([k, v]) => [k, SENSITIVE.test(k) ? '[removed]' : v]));
}

let reporter: ((error: Error, context: Context) => void) | null = null;

/** Called once at start (root layout). */
export function initMonitoring(): void {
  reporter = __DEV__ ? (error, context) => console.warn('[kuraat]', error.message, context) : null;
}

export function captureError(error: unknown, context: Context = {}): void {
  const err = error instanceof Error ? error : new Error(String(error));
  try {
    reporter?.(err, scrub(context));
  } catch {
    /* reporting must never break the app */
  }
}
