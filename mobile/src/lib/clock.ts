/**
 * Mobile platform helper: the phone's own 12/24-hour setting (Settings → Date & time → "Use 24-hour format").
 * Plugged into the shared formatters with `setClockReader` (src/app/_layout.tsx), so every time on screen
 * follows it. Read on every call, so switching the setting shows on the next render.
 *
 * expo-localization is loaded lazily: a build without its native module falls back to the locale's clock
 * (null → the shared formatter decides) instead of crashing at start-up.
 */
type Localization = { getCalendars: () => { uses24hourClock: boolean | null }[] };

let localization: Localization | null | undefined;

export function readPhoneClock(): boolean | null {
  if (localization === undefined) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      localization = require('expo-localization') as Localization;
    } catch {
      localization = null;
    }
  }
  try {
    return localization?.getCalendars()[0]?.uses24hourClock ?? null;
  } catch {
    return null;
  }
}
