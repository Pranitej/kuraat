/** Field validators. Each returns an error message string, or '' when valid. */

import { onlyDigits } from './format.js';

export function validateName(value) {
  const v = (value || '').trim();
  if (!v) return 'Enter your full name';
  if (v.length < 2) return 'Name looks too short';
  if (!/^[\p{L}\s.'-]+$/u.test(v)) return 'Use letters only';
  return '';
}

/** Saudi mobile: 9 digits starting with 5 (e.g. 50 123 4821). */
export function validateMobile(value) {
  const d = onlyDigits(value);
  if (!d) return 'Enter your mobile number';
  if (d.length !== 9 || d[0] !== '5') return 'Enter a valid Saudi mobile number, e.g. 50 123 4821';
  return '';
}

export function validateEmail(value, { required = false } = {}) {
  const v = (value || '').trim();
  if (!v) return required ? 'Enter your email' : '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) return 'Enter a valid email address';
  return '';
}

export function validateRequired(value, message = 'This field is required') {
  return (value || '').toString().trim() ? '' : message;
}

export function validateAddressLine(value) {
  const v = (value || '').trim();
  if (!v) return 'Enter your delivery address';
  if (v.length < 5) return 'Add a building or street name';
  return '';
}

/* ---------- Payment ---------- */

export function luhnValid(number) {
  const d = onlyDigits(number);
  if (d.length < 13 || d.length > 19) return false;
  let sum = 0;
  let dbl = false;
  for (let i = d.length - 1; i >= 0; i -= 1) {
    let n = Number(d[i]);
    if (dbl) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    dbl = !dbl;
  }
  return sum % 10 === 0;
}

export function cardBrand(number) {
  const d = onlyDigits(number);
  if (/^(4[0-9]{5})/.test(d) && /^(440647|440795|446404|457865|968208|588845|636120|457997|474491|543357|585265|588848|588850|604906|521076|529415|535825|543085|524130|554180|549760|588849)/.test(d)) return 'Mada';
  if (/^4/.test(d)) return 'Visa';
  if (/^(5[1-5]|2[2-7])/.test(d)) return 'Mastercard';
  if (/^3[47]/.test(d)) return 'Amex';
  return 'Card';
}

export function formatCardNumber(value) {
  return onlyDigits(value)
    .slice(0, 19)
    .replace(/(\d{4})(?=\d)/g, '$1 ');
}

export function formatExpiry(value, previous = '') {
  const d = onlyDigits(value).slice(0, 4);
  if (d.length === 0) return '';
  if (d.length === 1) return d === '0' || d === '1' ? d : `0${d} / `;
  // allow deleting the separator naturally
  if (d.length === 2 && previous.endsWith(' / ') && value.length < previous.length) return d.slice(0, 1);
  if (d.length === 2) return `${d} / `;
  return `${d.slice(0, 2)} / ${d.slice(2)}`;
}

export function validateCardNumber(value) {
  const d = onlyDigits(value);
  if (!d) return 'Enter your card number';
  if (!luhnValid(d)) return 'Check the card number';
  return '';
}

export function validateExpiry(value, now = new Date()) {
  const d = onlyDigits(value);
  if (d.length !== 4) return 'Use MM / YY';
  const month = Number(d.slice(0, 2));
  const year = 2000 + Number(d.slice(2));
  if (month < 1 || month > 12) return 'Invalid month';
  const endOfMonth = new Date(year, month, 0, 23, 59, 59);
  if (endOfMonth < now) return 'Card has expired';
  return '';
}

export function validateCvv(value) {
  const d = onlyDigits(value);
  if (d.length < 3 || d.length > 4) return '3 or 4 digits';
  return '';
}
