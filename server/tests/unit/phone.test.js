import { describe, expect, test } from 'vitest';
import { normalizePhone, phoneSchema } from '../../src/modules/auth/phone.js';
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

describe('normalizePhone — other countries', () => {
  test.each([
    ['+91 79057 93532', '+917905793532'], // India
    ['+917905793532', '+917905793532'],
    ['0091 79057 93532', '+917905793532'],
    ['+44 7400 123456', '+447400123456'], // United Kingdom
    ['+971 50 123 4567', '+971501234567'], // United Arab Emirates
    ['+1 650 253 0000', '+16502530000'], // United States
  ])('%s → %s', (input, expected) => {
    expect(normalizePhone(input)).toBe(expected);
  });

  test.each(['+91 12345', '+44 20 7946 0958', '+999 123456789', '+', '+91', '0091', '+966 12345', '+966 401234821'])('rejects %s', (input) => {
    expect(normalizePhone(input)).toBeNull();
  });

  test('a Saudi number written with its country code is still stored as the 9 digits', () => {
    expect(normalizePhone('+966501234821')).toBe('501234821');
    expect(normalizePhone('+966 0501234821')).toBe('501234821');
  });

  test('the message tells a foreign number apart from a Saudi one', () => {
    expect(phoneSchema.safeParse('+91 12345').error.issues[0].message).toBe('Enter a valid mobile number for that country.');
    expect(phoneSchema.safeParse('12345').error.issues[0].message).toBe('Enter a valid Saudi mobile number, e.g. 50 123 4821');
    expect(phoneSchema.safeParse('+917905793532').data).toBe('+917905793532');
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
