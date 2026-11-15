import { describe, expect, test } from 'vitest';
import { deliveryWindow, estimates } from '../../src/modules/checkout/window.js';

const win = (iso) => {
  const { start, end } = deliveryWindow(new Date(iso));
  return [start.toISOString(), end.toISOString()];
};

describe('deliveryWindow (Saudi time, 2 h slot ≥ 4.5 h ahead, slots start 12:00–22:00)', () => {
  test('12:21 Saudi → 17:00–19:00 Saudi (the PDF example)', () => {
    expect(win('2026-11-15T09:21:00Z')).toEqual(['2026-11-15T14:00:00.000Z', '2026-11-15T16:00:00.000Z']);
  });

  test('exactly on the hour does not round up: 12:30 Saudi → 17:00', () => {
    expect(win('2026-11-15T09:30:00Z')[0]).toBe('2026-11-15T14:00:00.000Z');
  });

  test('21:00 Saudi → next day 12:00–14:00', () => {
    expect(win('2026-11-15T18:00:00Z')).toEqual(['2026-11-16T09:00:00.000Z', '2026-11-16T11:00:00.000Z']);
  });

  test('18:00 Saudi (22:30 earliest → 23:00) → next day 12:00', () => {
    expect(win('2026-11-15T15:00:00Z')[0]).toBe('2026-11-16T09:00:00.000Z');
  });

  test('06:00 Saudi → 12:00–14:00 the same day', () => {
    expect(win('2026-11-15T03:00:00Z')).toEqual(['2026-11-15T09:00:00.000Z', '2026-11-15T11:00:00.000Z']);
  });

  test('end of month rolls into the next month', () => {
    expect(win('2026-11-30T19:00:00Z')[0]).toBe('2026-12-01T09:00:00.000Z');
  });
});

describe('estimates', () => {
  test('same-day order: preparing 4 min after ordering, out for delivery 30 min before the window', () => {
    expect(estimates(new Date('2026-11-15T09:21:00Z'))).toEqual({
      preparingAt: '2026-11-15T09:25:00.000Z',
      outForDeliveryAt: '2026-11-15T13:30:00.000Z',
      windowStart: '2026-11-15T14:00:00.000Z',
      windowEnd: '2026-11-15T16:00:00.000Z',
    });
  });

  test('next-day order: preparing 2 h before the window', () => {
    expect(estimates(new Date('2026-11-15T18:00:00Z')).preparingAt).toBe('2026-11-16T07:00:00.000Z');
  });
});
