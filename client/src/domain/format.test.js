// vitest.config.js runs these in America/New_York: every result below must still be Saudi time.
import { describe, expect, test } from 'vitest';
import { formatDate, formatDateTime, formatDayMonth, formatOrderDate, formatTime, formatTime12, formatWindow, isSameDay } from './format.js';

describe('Saudi time whatever the browser’s zone', () => {
  test('the zone really is New York in these tests', () => {
    expect(new Date('2026-11-15T09:21:00Z').getHours()).toBe(4);
  });

  test('09:21 UTC shows as 12:21', () => {
    expect(formatTime('2026-11-15T09:21:00Z')).toBe('12:21');
  });

  test('12-hour times', () => {
    expect(formatTime12('2026-11-15T13:30:00Z', { compact: false })).toBe('4:30 PM');
    expect(formatTime12('2026-11-15T14:00:00Z')).toBe('5 PM');
    expect(formatTime12('2026-11-15T21:00:00Z')).toBe('12 AM');
  });

  test('a delivery window keeps its Saudi hours and day', () => {
    const now = new Date('2026-11-15T09:21:00Z');
    expect(formatWindow('2026-11-15T14:00:00Z', '2026-11-15T16:00:00Z', now)).toBe('Today, 5:00 – 7:00 PM');
    expect(formatWindow('2026-11-16T09:00:00Z', '2026-11-16T11:00:00Z', now)).toBe('Tomorrow, 12:00 – 2:00 PM');
    expect(formatWindow('2026-11-15T14:00:00Z', '2026-11-15T16:00:00Z', now, { long: false })).toBe('Today, 5 – 7 PM');
  });

  test('22:30 UTC is already the next day in Saudi Arabia', () => {
    expect(isSameDay('2026-11-15T22:30:00Z', '2026-11-16T08:00:00Z')).toBe(true);
    expect(isSameDay('2026-11-15T20:30:00Z', '2026-11-16T08:00:00Z')).toBe(false);
    expect(formatDate('2026-11-15T22:30:00Z')).toBe('16 Nov 2026');
    expect(formatDayMonth('2026-11-15T22:30:00Z')).toBe('16 Nov');
    expect(formatDateTime('2026-11-15T22:30:00Z')).toBe('16 Nov 2026, 01:30');
  });

  test('order dates use the Saudi today and yesterday', () => {
    const now = new Date('2026-11-16T08:00:00Z'); // 11:00, 16 Nov
    expect(formatOrderDate('2026-11-15T22:30:00Z', now)).toBe('Today, 01:30');
    expect(formatOrderDate('2026-11-15T09:21:00Z', now)).toBe('Yesterday, 12:21');
    expect(formatOrderDate('2026-11-08T10:05:00Z', now)).toBe('8 Nov 2026');
  });
});
