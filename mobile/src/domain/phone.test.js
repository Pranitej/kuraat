// vitest.config.js runs in America/New_York: nothing here depends on the time zone, but the file lives with the rest.
import { describe, expect, test } from 'vitest';
import { COUNTRIES, DEFAULT_COUNTRY } from './countries.js';
import { formatPhone } from './format.js';
import { formatNationalInput, phonePlaceholder, splitPhone, toApiPhone, toWirePhone } from './phone.js';
import { validateMobile } from './validation.js';

describe('country list', () => {
  test('every country is there, Saudi Arabia is the default, codes are digits', () => {
    expect(COUNTRIES.length).toBeGreaterThan(230);
    expect(DEFAULT_COUNTRY).toBe('SA');
    expect(COUNTRIES.find((c) => c.iso === 'SA')).toEqual({ iso: 'SA', name: 'Saudi Arabia', dial: '966' });
    expect(COUNTRIES.find((c) => c.iso === 'IN').dial).toBe('91');
    expect(COUNTRIES.every((c) => /^\d{1,4}$/.test(c.dial) && c.name)).toBe(true);
    expect(new Set(COUNTRIES.map((c) => c.iso)).size).toBe(COUNTRIES.length);
  });

  test('sorted by name', () => {
    const names = COUNTRIES.map((c) => c.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, 'en')));
  });
});

describe('toApiPhone', () => {
  test('Saudi Arabia stays the 9 digits, a leading 0 dropped', () => {
    expect(toApiPhone('SA', '50 123 4821')).toBe('501234821');
    expect(toApiPhone('SA', '0501234821')).toBe('501234821');
    expect(toApiPhone('SA', '5012348219999')).toBe('501234821');
    expect(toApiPhone('SA', '')).toBe('');
  });

  test('another country becomes + and the full number', () => {
    expect(toApiPhone('IN', '79057 93532')).toBe('+917905793532');
    expect(toApiPhone('GB', '07400 123456')).toBe('+447400123456'); // the national 0 is dropped
    expect(toApiPhone('AE', '50 123 4567')).toBe('+971501234567');
  });

  test('a number still being typed keeps what there is, empty stays empty', () => {
    expect(toApiPhone('IN', '790')).toBe('+91790');
    expect(toApiPhone('IN', '')).toBe('');
  });
});

describe('splitPhone', () => {
  test('a Saudi number without + is Saudi; empty uses the fallback country', () => {
    expect(splitPhone('501234821')).toEqual({ iso: 'SA', national: '501234821' });
    expect(splitPhone('')).toEqual({ iso: 'SA', national: '' });
    expect(splitPhone('', 'IN')).toEqual({ iso: 'IN', national: '' });
  });

  test('a + number gives its country and national part, complete or still being typed', () => {
    expect(splitPhone('+917905793532')).toEqual({ iso: 'IN', national: '7905793532' });
    expect(splitPhone('+447400123456')).toEqual({ iso: 'GB', national: '7400123456' });
    expect(splitPhone('+91790')).toEqual({ iso: 'IN', national: '790' });
    expect(splitPhone('+966501234821')).toEqual({ iso: 'SA', national: '501234821' });
  });

  test('round trip: split, then back to the API form', () => {
    for (const value of ['501234821', '+917905793532', '+971501234567', '+447400123456']) {
      const { iso, national } = splitPhone(value);
      expect(toApiPhone(iso, national)).toBe(value);
    }
  });
});

describe('validateMobile', () => {
  test('Saudi rules are unchanged', () => {
    expect(validateMobile('')).toBe('Enter your mobile number');
    expect(validateMobile('50 123 4821')).toBe('');
    expect(validateMobile('401234821')).toBe('Enter a valid Saudi mobile number, e.g. 50 123 4821');
  });

  test("another country is checked with that country's mobile rules", () => {
    expect(validateMobile('+917905793532')).toBe('');
    expect(validateMobile('+971501234567')).toBe('');
    expect(validateMobile('+91123')).toBe('Enter a valid mobile number for India');
    expect(validateMobile('+44 20 7946 0958'.replace(/ /g, ''))).toBe('Enter a valid mobile number for +44'); // a London landline: +44 is shared, so the code is named
    expect(validateMobile('+91')).toBe('Enter your mobile number');
  });
});

describe('display', () => {
  test('formatPhone: Saudi as before, other countries in international form', () => {
    expect(formatPhone('501234821')).toBe('+966 50 123 4821');
    expect(formatPhone('+917905793532')).toBe('+91 79057 93532');
  });

  test('the number box groups digits by country', () => {
    expect(formatNationalInput('SA', '501234821')).toBe('50 123 4821');
    expect(formatNationalInput('IN', '7905793532')).toBe('79057 93532');
    expect(phonePlaceholder('SA')).toBe('50 123 4821');
  });

  test('toWirePhone keeps the plus of foreign numbers and strips layout', () => {
    expect(toWirePhone('50 123 4821')).toBe('501234821');
    expect(toWirePhone('+91 79057 93532')).toBe('+917905793532');
  });
});
