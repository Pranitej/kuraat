/** Password rules (same wording as the client's PasswordRules) and bcrypt hashing. */
import bcrypt from 'bcryptjs';

const RULES = [
  { label: 'At least 8 characters', test: (p) => p.length >= 8 },
  { label: 'Upper and lower case letters', test: (p) => /[a-z]/.test(p) && /[A-Z]/.test(p) },
  { label: 'A number', test: (p) => /\d/.test(p) },
];

/** Unmet required rules, in display order. A symbol is recommended by the UI but not required. */
export const passwordProblems = (password = '') => RULES.filter((r) => !r.test(String(password))).map((r) => r.label);

export const weakPasswordMessage = (problems) => `Choose a stronger password: ${problems.join(', ').toLowerCase()}.`;

export const hashPassword = (password, cost) => bcrypt.hash(password, cost);
export const checkPassword = async (password, hash) => (hash ? bcrypt.compare(String(password), hash) : false);
