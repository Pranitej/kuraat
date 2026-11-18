/** Formatting helpers (pure — shared with the future React Native app). */
import { formatInternationalPhone, isInternationalPhone } from './phone.js';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "SAR 185" (cards/detail) or "SAR 185.00" (checkout, receipts). */
export function formatSAR(amount, { decimals = 2 } = {}) {
  const value = Number(amount || 0);
  return `SAR ${value.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
}

/** Local 9-digit Saudi mobile ("501234821") → "50 123 4821". */
export function formatPhoneLocal(digits = '') {
  const d = String(digits).replace(/\D/g, '').slice(0, 9);
  if (d.length <= 2) return d;
  if (d.length <= 5) return `${d.slice(0, 2)} ${d.slice(2)}`;
  return `${d.slice(0, 2)} ${d.slice(2, 5)} ${d.slice(5)}`;
}

/** "+966 50 123 4821" for a Saudi number; "+91 79057 93532" for a number of another country (stored as "+…"). */
export function formatPhone(value = '', code = '+966') {
  if (isInternationalPhone(value)) return formatInternationalPhone(value) || String(value);
  return `${code} ${formatPhoneLocal(value)}`;
}

export function onlyDigits(value = '') {
  return String(value).replace(/\D/g, '');
}

const pad = (n) => String(n).padStart(2, '0');

export function toDate(value) {
  return value instanceof Date ? value : new Date(value);
}

/**
 * The server sends every time as a UTC instant (ISO string); everything below shows it in the time zone of the
 * device (browser or phone), through the local getters (getHours, getDate…). "Today" and "Yesterday" are the
 * device's today and yesterday too. Only the branch opening hours (10 AM – 12 AM) are a Saudi wall-clock
 * rule of the branch itself, not an instant, so they are shown as they are.
 */
const DAY_MS = 24 * 3600 * 1000;

export function isSameDay(a, b) {
  const x = toDate(a);
  const y = toDate(b);
  return x.getFullYear() === y.getFullYear() && x.getMonth() === y.getMonth() && x.getDate() === y.getDate();
}

export function isYesterday(date, now = new Date()) {
  return isSameDay(date, new Date(toDate(now).getTime() - DAY_MS));
}

/* ---------------- 12- or 24-hour clock: the device's own choice ---------------- */

let localeClock; // cached: the locale's clock style does not change while the page/app runs
/** The device locale's clock style (browser: from its language settings). Unknown → 12-hour. */
function localeUses24() {
  if (localeClock === undefined) {
    localeClock = false;
    try {
      const o = new Intl.DateTimeFormat(undefined, { hour: 'numeric' }).resolvedOptions();
      if (o.hourCycle) localeClock = o.hourCycle === 'h23' || o.hourCycle === 'h24';
      else if (typeof o.hour12 === 'boolean') localeClock = !o.hour12;
    } catch {
      /* no Intl: keep 12-hour */
    }
  }
  return localeClock;
}

let readDeviceClock = () => null;

/**
 * Platform hook: how to read the device's 12/24-hour setting. The phone app passes the phone's own
 * setting (expo-localization); the web leaves it, so the browser locale decides. The reader may return
 * true (24-hour), false (12-hour) or null when it cannot tell (then the locale decides).
 */
export function setClockReader(read) {
  readDeviceClock = typeof read === 'function' ? read : () => null;
}

/** true when every time on screen should use the 24-hour clock ("19:19"), false for "7:19 PM". */
export function uses24HourClock() {
  try {
    const setting = readDeviceClock();
    if (typeof setting === 'boolean') return setting;
  } catch {
    /* fall back to the locale */
  }
  return localeUses24();
}

const hour12 = (h) => (h % 12 === 0 ? 12 : h % 12);
const meridiem = (h) => (h >= 12 ? 'PM' : 'AM');

/** A clock time in the device's format: "19:19" (24-hour) or "7:19 PM" (12-hour). Every time on screen uses this. */
export function formatTime(value) {
  const d = toDate(value);
  const h = d.getHours();
  return uses24HourClock() ? `${pad(h)}:${pad(d.getMinutes())}` : `${hour12(h)}:${pad(d.getMinutes())} ${meridiem(h)}`;
}

/** An hour of the day (0–24) in the device's format: "10:00" / "00:00" or "10 AM" / "12 AM" (branch opening hours). */
export function formatHour(hour) {
  const h = ((Number(hour) % 24) + 24) % 24;
  return uses24HourClock() ? `${pad(h)}:00` : `${hour12(h)} ${meridiem(h)}`;
}

/** "15 Nov 2026" */
export function formatDate(value) {
  const d = toDate(value);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** "8 Nov" */
export function formatDayMonth(value) {
  const d = toDate(value);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/** "15 Nov 2026, 12:21" */
export function formatDateTime(value) {
  return `${formatDate(value)}, ${formatTime(value)}`;
}

/** Orders list: "Today, 12:21" for today, otherwise "8 Nov 2026". */
export function formatOrderDate(value, now = new Date()) {
  if (isSameDay(value, now)) return `Today, ${formatTime(value)}`;
  if (isYesterday(value, now)) return `Yesterday, ${formatTime(value)}`;
  return formatDate(value);
}

/**
 * Delivery window in the device's clock format:
 *   24-hour  "Today, 17:00 – 19:00"
 *   12-hour  "Today, 5:00 – 7:00 PM" (long) / "Today, 5 – 7 PM" (short, product page);
 *            the AM/PM is written once when both ends share it, on each end otherwise ("11:00 PM – 1:00 AM").
 */
export function formatWindow(start, end, now = new Date(), { long = true } = {}) {
  const tomorrow = new Date(toDate(now).getTime() + DAY_MS);
  const day = isSameDay(start, now) ? 'Today' : isSameDay(start, tomorrow) ? 'Tomorrow' : formatDayMonth(start);
  const s = toDate(start);
  const e = toDate(end);
  if (uses24HourClock()) return `${day}, ${formatTime(s)} – ${formatTime(e)}`;
  const part = (d) => (!long && d.getMinutes() === 0 ? `${hour12(d.getHours())}` : `${hour12(d.getHours())}:${pad(d.getMinutes())}`);
  const sameHalf = meridiem(s.getHours()) === meridiem(e.getHours());
  const from = sameHalf ? part(s) : `${part(s)} ${meridiem(s.getHours())}`;
  return `${day}, ${from} – ${part(e)} ${meridiem(e.getHours())}`;
}

export function formatDistance(km) {
  if (km == null) return '';
  if (km < 100) return `${km.toFixed(1)} km`;
  return `${Math.round(km).toLocaleString('en-US')} km`;
}

export function pluralize(count, singular, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function initials(name = '') {
  const parts = name.trim().split(/[\s-]+/).filter(Boolean);
  if (!parts.length) return '';
  const first = parts[0][0] || '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase();
}

export function firstName(name = '') {
  return name.trim().split(/\s+/)[0] || '';
}
