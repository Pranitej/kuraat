import { describe, expect, test } from 'vitest';
import { productGrid } from './grid';

// Real phone widths in dp/pt, including the fractional ones Android reports (e.g. 411.43, 392.73).
const PHONES = [320, 360, 375, 384, 390, 392.72727, 393, 400, 411.428571, 412, 414, 428, 430];

describe('product grid', () => {
  test.each(PHONES)('two cards always fit side by side on a %s-wide phone', (screen) => {
    const content = screen - 40; // 20 pt gutters
    const { columns, cardWidth, gap } = productGrid(content);
    expect(columns).toBe(2);
    expect(Number.isInteger(cardWidth)).toBe(true);
    expect(cardWidth * columns + gap * (columns - 1)).toBeLessThanOrEqual(content);
    expect(content - (cardWidth * columns + gap)).toBeLessThan(2); // no visible leftover
  });

  test('tablets (wide column) get three columns', () => {
    expect(productGrid(600).columns).toBe(3);
  });
});
