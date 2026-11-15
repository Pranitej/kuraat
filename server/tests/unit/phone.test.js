import { describe, expect, test } from 'vitest';
import { normalizePhone } from '../../src/modules/auth/phone.js';
import { passwordProblems } from '../../src/modules/auth/password.js';

describe('normalizePhone', () => {
  test.each([
    ['501234821', '501234821'],
    ['0501234821', '501234821'],
    ['+966 50 123 4821', '501234821'],
    ['966501234821', '501234821'],
    ['00966501234821', '501234821'],
    ['50-123-4821', '501234821'],
    [' 55 123 4567 ', '551234567'],
  ])('%s → %s', (input, expected) => {
    expect(normalizePhone(input)).toBe(expected);
  });

  test.each(['', '12345', '401234821', '5012348210', 'abc', null, undefined])('rejects %s', (input) => {
    expect(normalizePhone(input)).toBeNull();
  });
});

describe('passwordProblems', () => {
  test('accepts a password with 8+ chars, upper and lower case and a number', () => {
    expect(passwordProblems('Kuraat2026')).toEqual([]);
  });
  test('lists what is missing', () => {
    expect(passwordProblems('abc')).toEqual(['At least 8 characters', 'Upper and lower case letters', 'A number']);
  });
});
