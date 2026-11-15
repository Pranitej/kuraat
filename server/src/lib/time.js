/**
 * Saudi business time. Saudi Arabia is UTC+3 all year (no daylight saving), so business rules
 * (opening hours, delivery slots) are computed by shifting UTC by a fixed offset — the result does not
 * depend on the server's own time zone (cloud hosts usually run in UTC).
 */
import { SAUDI_UTC_OFFSET_MINUTES } from '../config/business.js';

const OFFSET_MS = SAUDI_UTC_OFFSET_MINUTES * 60_000;

/** Calendar parts of `date` as seen in Saudi Arabia. month is 1–12, weekday 0 = Sunday. */
export function saudiParts(date) {
  const shifted = new Date(new Date(date).getTime() + OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
    weekday: shifted.getUTCDay(),
  };
}

/** The instant of a Saudi wall-clock time (hour may be 24 = midnight at the end of the day). */
export function fromSaudi({ year, month, day, hour = 0, minute = 0 }) {
  return new Date(Date.UTC(year, month - 1, day, hour, minute) - OFFSET_MS);
}

/** hours = { open: 10, close: 24 } in Saudi time. */
export function isOpenAt(hours, date) {
  const { hour, minute } = saudiParts(date);
  const h = hour + minute / 60;
  return h >= hours.open && h < hours.close;
}
