/** Saudi mobile numbers: we store the 9-digit local form, e.g. 501234821. */
import { z } from 'zod';

/** "+966 50 123 4821", "0501234821", "966501234821", "00966…" → "501234821"; anything else → null. */
export function normalizePhone(input) {
  if (input === null || input === undefined) return null;
  let digits = String(input).replace(/\D/g, '');
  if (digits.startsWith('00966')) digits = digits.slice(5);
  else if (digits.startsWith('966')) digits = digits.slice(3);
  if (digits.startsWith('0')) digits = digits.slice(1);
  return /^5\d{8}$/.test(digits) ? digits : null;
}

export const PHONE_MESSAGE = 'Enter a valid Saudi mobile number, e.g. 50 123 4821';

/** zod field: accepts any common format, outputs the 9-digit form. */
export const phoneSchema = z.string({ error: PHONE_MESSAGE }).transform((value, ctx) => {
  const phone = normalizePhone(value);
  if (!phone) {
    ctx.addIssue({ code: 'custom', message: PHONE_MESSAGE });
    return z.NEVER;
  }
  return phone;
});
