/** Formatting helpers (pure — shared with the future React Native app). */

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

/** "+966 50 123 4821" */
export function formatPhone(digits = '', code = '+966') {
  return `${code} ${formatPhoneLocal(digits)}`;
}

export function onlyDigits(value = '') {
  return String(value).replace(/\D/g, '');
}

const pad = (n) => String(n).padStart(2, '0');

export function toDate(value) {
  return value instanceof Date ? value : new Date(value);
}

/** Saudi Arabia is UTC+3 all year (no daylight saving); every time in the app is shown in it. */
const SAUDI_OFFSET_MINUTES = 180;
const DAY_MS = 24 * 3600 * 1000;

/**
 * The same instant moved so that the local getters (getHours, getDate…) read Saudi wall time,
 * whatever the device's own time zone. Only for reading parts — never send it to the server.
 */
export function saudiDate(value) {
  const d = toDate(value);
  return new Date(d.getTime() + (SAUDI_OFFSET_MINUTES + d.getTimezoneOffset()) * 60 * 1000);
}

export function isSameDay(a, b) {
  const x = saudiDate(a);
  const y = saudiDate(b);
  return x.getFullYear() === y.getFullYear() && x.getMonth() === y.getMonth() && x.getDate() === y.getDate();
}

export function isYesterday(date, now = new Date()) {
  return isSameDay(date, new Date(toDate(now).getTime() - DAY_MS));
}

/** 24h clock "12:21" — as used across the PDF. */
export function formatTime(value) {
  const d = saudiDate(value);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** 12h clock without minutes when on the hour: "5 PM", "4:30 PM", "12 AM". */
export function formatTime12(value, { compact = true } = {}) {
  const d = saudiDate(value);
  const h = d.getHours();
  const m = d.getMinutes();
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  if (compact && m === 0) return `${h12} ${suffix}`;
  return `${h12}:${pad(m)} ${suffix}`;
}

/** "15 Nov 2026" */
export function formatDate(value) {
  const d = saudiDate(value);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** "8 Nov" */
export function formatDayMonth(value) {
  const d = saudiDate(value);
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

/** Delivery window: "Today, 5:00 – 7:00 PM" / "Tomorrow, 12:00 – 2:00 PM". */
export function formatWindow(start, end, now = new Date(), { long = true } = {}) {
  const tomorrow = new Date(toDate(now).getTime() + DAY_MS);
  const day = isSameDay(start, now) ? 'Today' : isSameDay(start, tomorrow) ? 'Tomorrow' : formatDayMonth(start);
  // Read hours in Saudi time below.
  const s = saudiDate(start);
  const e = saudiDate(end);
  if (!long) {
    // "Today, 5 – 7 PM"
    const sameSuffix = (s.getHours() >= 12) === (e.getHours() >= 12 || e.getHours() === 0);
    const startLabel = sameSuffix ? formatTime12(start).replace(/ (AM|PM)$/, '') : formatTime12(start);
    return `${day}, ${startLabel} – ${formatTime12(end)}`;
  }
  const h12 = (d) => (d.getHours() % 12 === 0 ? 12 : d.getHours() % 12);
  return `${day}, ${h12(s)}:${pad(s.getMinutes())} – ${h12(e)}:${pad(e.getMinutes())} ${e.getHours() >= 12 ? 'PM' : 'AM'}`;
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
