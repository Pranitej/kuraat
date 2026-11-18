// vitest.config.js runs these in America/New_York (UTC-5 in November): times follow the DEVICE's zone, so the
// expected values below are New York wall time. The last test switches the zone to prove it.
import { afterEach, describe, expect, test } from 'vitest';
import { formatDate, formatDateTime, formatDayMonth, formatOrderDate, formatTime, formatTime12, formatWindow, isSameDay } from './format.js';

describe("times follow the device's time zone", () => {
  test('the zone really is New York in these tests', () => {
    expect(new Date('2026-11-15T09:21:00Z').getHours()).toBe(4);
  });

  test('a UTC instant shows as the device clock: 09:21 UTC is 04:21 in New York', () => {
    expect(formatTime('2026-11-15T09:21:00Z')).toBe('04:21');
  });

  test('12-hour times', () => {
    expect(formatTime12('2026-11-15T13:30:00Z', { compact: false })).toBe('8:30 AM');
    expect(formatTime12('2026-11-15T14:00:00Z')).toBe('9 AM');
    expect(formatTime12('2026-11-15T21:00:00Z')).toBe('4 PM');
    expect(formatTime12('2026-11-15T05:00:00Z')).toBe('12 AM');
  });

  test('a delivery window is shown in device hours, on the device day', () => {
    const now = new Date('2026-11-15T09:21:00Z'); // 04:21 on 15 Nov in New York
    expect(formatWindow('2026-11-15T14:00:00Z', '2026-11-15T16:00:00Z', now)).toBe('Today, 9:00 – 11:00 AM');
    expect(formatWindow('2026-11-16T09:00:00Z', '2026-11-16T11:00:00Z', now)).toBe('Tomorrow, 4:00 – 6:00 AM');
    expect(formatWindow('2026-11-15T14:00:00Z', '2026-11-15T16:00:00Z', now, { long: false })).toBe('Today, 9 – 11 AM');
  });

  test('the day changes at the device midnight, not at midnight UTC or Saudi time', () => {
    // 04:59Z = 23:59 on 15 Nov in New York, 05:00Z = 00:00 on 16 Nov
    expect(isSameDay('2026-11-16T04:59:00Z', '2026-11-16T05:00:00Z')).toBe(false);
    expect(isSameDay('2026-11-16T05:00:00Z', '2026-11-16T20:00:00Z')).toBe(true);
    expect(formatDate('2026-11-15T22:30:00Z')).toBe('15 Nov 2026');
    expect(formatDayMonth('2026-11-16T05:00:00Z')).toBe('16 Nov');
    expect(formatDateTime('2026-11-15T22:30:00Z')).toBe('15 Nov 2026, 17:30');
  });

  test('order dates use the device today and yesterday', () => {
    const now = new Date('2026-11-16T08:00:00Z'); // 03:00 on 16 Nov in New York
    expect(formatOrderDate('2026-11-16T06:00:00Z', now)).toBe('Today, 01:00');
    expect(formatOrderDate('2026-11-15T22:30:00Z', now)).toBe('Yesterday, 17:30');
    expect(formatOrderDate('2026-11-15T09:21:00Z', now)).toBe('Yesterday, 04:21');
    expect(formatOrderDate('2026-11-08T10:05:00Z', now)).toBe('8 Nov 2026');
  });

  describe('another device zone', () => {
    const original = process.env.TZ;
    afterEach(() => {
      process.env.TZ = original;
    });

    test('the same instant reads differently on a phone set to Saudi time, to London and to Tokyo', () => {
      const instant = '2026-11-15T09:21:00Z';
      const at = (zone) => {
        process.env.TZ = zone;
        return formatDateTime(instant);
      };
      expect(at('Asia/Riyadh')).toBe('15 Nov 2026, 12:21');
      expect(at('Europe/London')).toBe('15 Nov 2026, 09:21');
      expect(at('Asia/Tokyo')).toBe('15 Nov 2026, 18:21');
    });
  });
});
