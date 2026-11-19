import { t, localized } from '@/i18n';
/** Password rules + strength (matches PDF screens 05 and 19). */

export const PASSWORD_RULES = localized([
  { id: 'length', label: 'At least 8 characters', hint: 'use at least 8 characters', test: (p) => p.length >= 8 },
  { id: 'case', label: 'Upper and lower case letters', hint: 'mix upper and lower case', test: (p) => /[a-z]/.test(p) && /[A-Z]/.test(p) },
  { id: 'number', label: 'A number', hint: 'add a number', test: (p) => /\d/.test(p) },
  { id: 'symbol', label: 'A symbol, for example ! or #', hint: 'add a symbol', test: (p) => /[^A-Za-z0-9\s]/.test(p) },
]);

/** Rules required to accept a password; the symbol is recommended, not required. */
export const REQUIRED_RULES = ['length', 'case', 'number'];

export function evaluatePassword(password = '') {
  const results = PASSWORD_RULES.map((r) => ({ ...r, met: r.test(password) }));
  const score = password ? results.filter((r) => r.met).length : 0;
  const missing = results.find((r) => !r.met);
  let label = '';
  if (password) {
    if (score <= 1) label = t('Weak: {hint}', { hint: missing ? missing.hint : t('try a longer password') });
    else if (score === 2) label = t('Medium: {hint} to make it stronger', { hint: missing ? missing.hint : t('add a symbol') });
    else if (score === 3) label = t('Strong password');
    else label = t('Very strong password');
  }
  const acceptable = REQUIRED_RULES.every((id) => results.find((r) => r.id === id).met);
  return { results, score, label, acceptable, level: score <= 1 ? 'weak' : score === 2 ? 'medium' : 'strong' };
}
