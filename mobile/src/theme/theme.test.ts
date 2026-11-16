import { describe, expect, test } from 'vitest';
import { typeScale } from './tokens.js';
import { FONT_FAMILY, colors, gradients, radii, shadows, type } from './theme';

describe('theme from the shared design tokens', () => {
  test('every type token keeps its size and line height and uses the font file for its weight', () => {
    for (const [name, [size, lineHeight, weight]] of Object.entries(typeScale) as [string, [number, number, number]][]) {
      const style = type[name as keyof typeof type];
      expect(style, name).toMatchObject({ fontSize: size, lineHeight, fontFamily: FONT_FAMILY[weight as 400 | 500 | 600 | 700] });
      expect(style, name).not.toHaveProperty('fontWeight');
    }
  });

  test('overline letter spacing 0.08em becomes points', () => {
    expect(type.overline.letterSpacing).toBeCloseTo(0.96);
  });

  test('flat colour names for the nested tokens', () => {
    expect(colors).toMatchObject({
      maroon: '#781232',
      maroonDark: '#5F0E28',
      maroonDeep: '#491121',
      sandSoft: '#F7E9E0',
      lineSubtle: '#EEE1D8',
    });
  });

  test('maroon header gradient: 165° with the token stops', () => {
    expect(gradients.maroon.colors).toEqual(['#8A1A3E', '#781232', '#4F1124']);
    expect(gradients.maroon.locations).toEqual([0, 0.45, 1]);
    expect(gradients.maroon.start.x).toBeCloseTo(0.37, 2);
    expect(gradients.maroon.end.x).toBeCloseTo(0.63, 2);
  });

  test('shadows are native boxShadow strings from the tokens; radii unchanged', () => {
    expect(shadows.fab).toEqual({ boxShadow: '0 12px 28px -8px rgba(73, 17, 33, 0.45)' });
    expect(radii.sheet).toBe(28);
  });
});
