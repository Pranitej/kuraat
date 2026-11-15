import { describe, expect, test } from 'vitest';
import { fromSaudi, isOpenAt, saudiParts } from '../../src/lib/time.js';

describe('Saudi time (UTC+3, no DST)', () => {
  test('saudiParts of 2026-11-15T09:21:00Z is 12:21 on Sunday 15 Nov', () => {
    expect(saudiParts(new Date('2026-11-15T09:21:00Z'))).toEqual({ year: 2026, month: 11, day: 15, hour: 12, minute: 21, weekday: 0 });
  });

  test('saudiParts rolls over midnight: 21:30Z is 00:30 the next day', () => {
    expect(saudiParts(new Date('2026-11-15T21:30:00Z'))).toMatchObject({ day: 16, hour: 0, minute: 30 });
  });

  test('fromSaudi builds the UTC instant', () => {
    expect(fromSaudi({ year: 2026, month: 11, day: 15, hour: 17 }).toISOString()).toBe('2026-11-15T14:00:00.000Z');
    expect(fromSaudi({ year: 2026, month: 11, day: 15, hour: 24 }).toISOString()).toBe('2026-11-15T21:00:00.000Z');
  });

  test('isOpenAt uses Saudi hours: 10:00–24:00', () => {
    const hours = { open: 10, close: 24 };
    expect(isOpenAt(hours, new Date('2026-11-15T09:21:00Z'))).toBe(true); // 12:21
    expect(isOpenAt(hours, new Date('2026-11-15T06:59:00Z'))).toBe(false); // 09:59
    expect(isOpenAt(hours, new Date('2026-11-15T20:59:00Z'))).toBe(true); // 23:59
    expect(isOpenAt(hours, new Date('2026-11-15T21:30:00Z'))).toBe(false); // 00:30
  });
});
