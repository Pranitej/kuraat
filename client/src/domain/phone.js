/**
 * Mobile numbers with a country (pure; shared with the app). The value used everywhere in the apps and sent to the
 * server ("API form"):
 *   - Saudi Arabia: the 9 digits, e.g. "501234821" (as it always was, so existing accounts and orders are unchanged);
 *   - every other country: "+" and the full international number, e.g. "+917905793532".
 * Other countries are checked with libphonenumber-js's mobile rules for that country.
 */
import { AsYouType, parsePhoneNumberFromString } from 'libphonenumber-js/mobile';
import { COUNTRIES, DEFAULT_COUNTRY } from './countries.js';
import { t } from '@/i18n';

const digitsOf = (value) => String(value ?? '').replace(/\D/g, '');

export const isInternationalPhone = (value) => String(value ?? '').startsWith('+');

export function countryOf(iso) {
  return COUNTRIES.find((c) => c.iso === iso) || COUNTRIES.find((c) => c.iso === DEFAULT_COUNTRY);
}

/** What the customer typed (national part, any layout) in the chosen country → the API form. Partial numbers are kept. */
export function toApiPhone(iso, national) {
  const d = digitsOf(national);
  if (iso === 'SA') return d.replace(/^0/, '').slice(0, 9);
  if (!d) return '';
  const parsed = parsePhoneNumberFromString(String(national), iso); // knows each country's trunk prefix (a leading 0)
  if (parsed && parsed.isPossible()) return parsed.number;
  return `+${countryOf(iso).dial}${d.replace(/^0+/, '')}`.slice(0, 16);
}

/** API form → { iso, national } to fill the picker and the number box. Without a "+" it is a Saudi number. */
export function splitPhone(value, fallbackIso = DEFAULT_COUNTRY) {
  const v = String(value ?? '');
  if (!v) return { iso: fallbackIso, national: '' };
  if (!isInternationalPhone(v)) return { iso: 'SA', national: digitsOf(v) };
  const parsed = parsePhoneNumberFromString(v);
  if (parsed) {
    const iso = parsed.country || COUNTRIES.find((c) => c.dial === parsed.countryCallingCode)?.iso || fallbackIso;
    return { iso, national: parsed.nationalNumber };
  }
  const all = digitsOf(v); // a number still being typed: the longest calling code that matches
  for (const length of [3, 2, 1]) {
    const hit = COUNTRIES.find((c) => c.dial === all.slice(0, length));
    if (hit) return { iso: hit.iso, national: all.slice(length) };
  }
  return { iso: fallbackIso, national: all };
}

/** The number as typed in the box: "50 123 4821" for Saudi Arabia, the country's own grouping elsewhere. */
export function formatNationalInput(iso, national) {
  const d = digitsOf(national);
  if (iso === 'SA') {
    const s = d.slice(0, 9);
    if (s.length <= 2) return s;
    if (s.length <= 5) return `${s.slice(0, 2)} ${s.slice(2)}`;
    return `${s.slice(0, 2)} ${s.slice(2, 5)} ${s.slice(5)}`;
  }
  return new AsYouType(iso).input(d);
}

/** "+91 79057 93532" for a number of another country; '' for a Saudi number (the caller formats those). */
export function formatInternationalPhone(value) {
  const parsed = isInternationalPhone(value) ? parsePhoneNumberFromString(String(value)) : null;
  return parsed ? parsed.formatInternational() : '';
}

/** '' when the API-form value is a valid mobile number of another country; otherwise the message to show. */
export function internationalPhoneProblem(value) {
  const { iso, national } = splitPhone(value);
  if (!national) return t('Enter your mobile number');
  const parsed = parsePhoneNumberFromString(String(value));
  if (parsed && parsed.isValid()) return '';
  // Name the country only when its calling code is its own (+44 is the UK, Jersey, Guernsey…: say the code).
  const { dial, name } = countryOf(iso);
  const sharing = COUNTRIES.filter((c) => c.dial === dial).length > 1;
  return t('Enter a valid mobile number for {place}', { place: sharing ? `+${dial}` : name });
}

/** The API form for a request body: Saudi digits, or "+" and digits. */
export function toWirePhone(value) {
  return isInternationalPhone(value) ? `+${digitsOf(value)}` : digitsOf(value);
}

/** Placeholder digits for the number box of a country (its own example mobile number, nationally formatted). */
export function phonePlaceholder(iso) {
  return iso === 'SA' ? '50 123 4821' : t('Mobile number');
}
