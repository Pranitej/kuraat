/**
 * Mobile numbers. The form we store and send around:
 *   - Saudi Arabia: the 9-digit local number, e.g. 501234821 (as it always was, so existing accounts are unchanged);
 *   - every other country: "+" and the full international number, e.g. +917905793532.
 * Other countries are checked with libphonenumber-js (its mobile rules for that country).
 */
import { parsePhoneNumberFromString } from 'libphonenumber-js/mobile';
import { z } from 'zod';

const SAUDI = /^5\d{8}$/;

/**
 * "+966 50 123 4821", "0501234821", "966501234821", "00966…" → "501234821" (Saudi);
 * "+91 79057 93532", "0091 79057 93532" → "+917905793532" (valid mobile numbers of other countries);
 * anything else → null.
 */
export function normalizePhone(input) {
  if (input === null || input === undefined) return null;
  const raw = String(input).trim();
  const digits = raw.replace(/\D/g, '');
  if (raw.startsWith('+') || raw.startsWith('00')) {
    const full = raw.startsWith('00') ? digits.slice(2) : digits; // the digits after the + (or 00)
    if (full.startsWith('966')) {
      const national = full.slice(3).replace(/^0/, '');
      return SAUDI.test(national) ? national : null;
    }
    const parsed = parsePhoneNumberFromString(`+${full}`);
    return parsed && parsed.isValid() ? parsed.number : null;
  }
  // No country code typed: the Saudi number as it always was.
  const national = (digits.startsWith('966') ? digits.slice(3) : digits).replace(/^0/, '');
  return SAUDI.test(national) ? national : null;
}

export const PHONE_MESSAGE = 'Enter a valid Saudi mobile number, e.g. 50 123 4821';
export const INTERNATIONAL_PHONE_MESSAGE = 'Enter a valid mobile number for that country.';

const isInternational = (value) => {
  const text = String(value).trim().replace(/[^+\d]/g, '');
  return (text.startsWith('+') || text.startsWith('00')) && !/^(\+|00)966/.test(text);
};

/** zod field: accepts any common format, outputs the stored form (see above). */
export const phoneSchema = z.string({ error: PHONE_MESSAGE }).transform((value, ctx) => {
  const phone = normalizePhone(value);
  if (!phone) {
    ctx.addIssue({ code: 'custom', message: isInternational(value) ? INTERNATIONAL_PHONE_MESSAGE : PHONE_MESSAGE });
    return z.NEVER;
  }
  return phone;
});
