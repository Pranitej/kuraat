// vitest.config.js runs these in America/New_York (UTC-5 in November): times follow the DEVICE's zone, so the
// expected values below are New York wall time. The last test switches the zone to prove it.
// The 12/24-hour style follows the device too; each block sets it explicitly (setClockReader), so these never
// depend on the machine's locale.
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { formatHours } from './branches.js';
import { formatDate, formatDateTime, formatDayMonth, formatHour, formatOrderDate, formatTime, formatWindow, isSameDay, setClockReader, uses24HourClock } from './format.js';

const device24 = () => setClockReader(() => true);
const device12 = () => setClockReader(() => false);
afterEach(() => setClockReader(null));

describe("times follow the device's time zone (24-hour device)", () => {
  beforeEach(device24);

  test('the zone really is New York in these tests', () => {
    expect(new Date('2026-11-15T09:21:00Z').getHours()).toBe(4);
  });

  test('a UTC instant shows as the device clock: 09:21 UTC is 04:21 in New York', () => {
    expect(formatTime('2026-11-15T09:21:00Z')).toBe('04:21');
  });

  test('a delivery window is shown in device hours, on the device day', () => {
    const now = new Date('2026-11-15T09:21:00Z'); // 04:21 on 15 Nov in New York
    expect(formatWindow('2026-11-15T14:00:00Z', '2026-11-15T16:00:00Z', now)).toBe('Today, 09:00 – 11:00');
    expect(formatWindow('2026-11-16T09:00:00Z', '2026-11-16T11:00:00Z', now)).toBe('Tomorrow, 04:00 – 06:00');
    expect(formatWindow('2026-11-15T14:00:00Z', '2026-11-15T16:00:00Z', now, { long: false })).toBe('Today, 09:00 – 11:00');
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

  test('branch opening hours', () => {
    expect(formatHour(10)).toBe('10:00');
    expect(formatHour(24)).toBe('00:00');
    expect(formatHours({ open: 10, close: 24 })).toBe('10:00 – 00:00');
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

describe('12-hour device: every time uses AM/PM, never a mix', () => {
  beforeEach(device12);

  test('clock times always show minutes and AM/PM', () => {
    expect(formatTime('2026-11-15T09:21:00Z')).toBe('4:21 AM');
    expect(formatTime('2026-11-15T13:30:00Z')).toBe('8:30 AM');
    expect(formatTime('2026-11-15T21:00:00Z')).toBe('4:00 PM');
    expect(formatTime('2026-11-15T05:00:00Z')).toBe('12:00 AM');
    expect(formatTime('2026-11-15T17:00:00Z')).toBe('12:00 PM');
    expect(formatDateTime('2026-11-15T22:30:00Z')).toBe('15 Nov 2026, 5:30 PM');
    expect(formatOrderDate('2026-11-16T06:00:00Z', new Date('2026-11-16T08:00:00Z'))).toBe('Today, 1:00 AM');
  });

  test('delivery windows: AM/PM once when both ends share it, on each end when they do not', () => {
    const now = new Date('2026-11-15T09:21:00Z');
    expect(formatWindow('2026-11-15T14:00:00Z', '2026-11-15T16:00:00Z', now)).toBe('Today, 9:00 – 11:00 AM');
    expect(formatWindow('2026-11-15T14:00:00Z', '2026-11-15T16:00:00Z', now, { long: false })).toBe('Today, 9 – 11 AM');
    expect(formatWindow('2026-11-15T16:00:00Z', '2026-11-15T18:00:00Z', now)).toBe('Today, 11:00 AM – 1:00 PM');
    expect(formatWindow('2026-11-16T04:00:00Z', '2026-11-16T06:00:00Z', now)).toBe('Today, 11:00 PM – 1:00 AM');
  });

  test('branch opening hours', () => {
    expect(formatHour(10)).toBe('10 AM');
    expect(formatHour(24)).toBe('12 AM');
    expect(formatHours({ open: 10, close: 24 })).toBe('10 AM – 12 AM');
  });
});

describe('reading the device setting', () => {
  test('the platform reader decides; a reader that cannot tell or fails falls back to the locale', () => {
    device24();
    expect(uses24HourClock()).toBe(true);
    device12();
    expect(uses24HourClock()).toBe(false);
    setClockReader(() => null);
    const fromLocale = uses24HourClock();
    expect(typeof fromLocale).toBe('boolean');
    setClockReader(() => {
      throw new Error('native module missing');
    });
    expect(uses24HourClock()).toBe(fromLocale);
  });
});
