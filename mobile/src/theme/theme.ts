/**
 * React Native theme built from the shared design tokens (tokens.js — identical to the web app's).
 * Components use only these values (DESIGN_SYSTEM.md §A.4: no ad-hoc colours, sizes or radii).
 */
import type { TextStyle, ViewStyle } from 'react-native';
import tokens from './tokens.js';

const t = tokens;

/** Font file per weight (custom fonts pick weight by family on Android; never set fontWeight). */
export const FONT_FAMILY = {
  400: 'SourceSans3_400Regular',
  500: 'SourceSans3_500Medium',
  600: 'SourceSans3_600SemiBold',
  700: 'SourceSans3_700Bold',
  arabic500: 'NotoSansArabic_500Medium',
  arabic700: 'NotoSansArabic_700Bold',
} as const;

export type Weight = 400 | 500 | 600 | 700;

export const colors = {
  cream: t.colors.cream,
  sand: t.colors.sand.DEFAULT,
  sandSoft: t.colors.sand.soft,
  maroon: t.colors.maroon.DEFAULT,
  maroonDark: t.colors.maroon.dark,
  maroonDeep: t.colors.maroon.deep,
  orange: t.colors.orange.DEFAULT,
  orangeLight: t.colors.orange.light,
  rose: t.colors.rose,
  pink: t.colors.pink,
  hotpink: t.colors.hotpink,
  surface: t.colors.surface,
  ink: t.colors.ink,
  copy: t.colors.copy,
  muted: t.colors.muted,
  placeholder: t.colors.placeholder,
  line: t.colors.line.DEFAULT,
  lineSubtle: t.colors.line.subtle,
  divider: t.colors.divider,
  viewer: t.colors.viewer,
  overlay: t.overlay,
  white: '#FFFFFF',
  /** White at the opacities the PDF uses on maroon (secondary lines, glass buttons). */
  white80: 'rgba(255,255,255,0.8)',
  white75: 'rgba(255,255,255,0.75)',
  white70: 'rgba(255,255,255,0.7)',
  white40: 'rgba(255,255,255,0.4)',
  glass: 'rgba(255,255,255,0.14)',
  glassBorder: 'rgba(255,255,255,0.35)',
} as const;

export type ColorName = keyof typeof colors;

export type TypeToken = keyof typeof t.typeScale;

function textStyle([size, lineHeight, weight, letterSpacing]: readonly (number | string)[]): TextStyle {
  const em = typeof letterSpacing === 'string' && letterSpacing.endsWith('em') ? parseFloat(letterSpacing) : null;
  return {
    fontSize: size as number,
    lineHeight: lineHeight as number,
    fontFamily: FONT_FAMILY[weight as Weight],
    ...(em !== null ? { letterSpacing: em * (size as number) } : {}),
  };
}

export const type = Object.fromEntries(Object.entries(t.typeScale).map(([name, spec]) => [name, textStyle(spec)])) as Record<
  TypeToken,
  TextStyle
>;

export const radii = t.radii;
export const space = t.spacing;
export const sizes = t.sizes;

export const shadows = {
  fab: { boxShadow: t.shadows.fab },
  bar: { boxShadow: t.shadows.bar },
  dialog: { boxShadow: t.shadows.dialog },
  float: { boxShadow: t.shadows.float },
  ring: { boxShadow: t.shadows.ring },
  ringError: { boxShadow: t.shadows['ring-error'] },
} satisfies Record<string, ViewStyle>;

/** CSS angle → expo-linear-gradient start/end (0° = up, clockwise). */
function angle(deg: number) {
  const rad = (deg * Math.PI) / 180;
  const dx = Math.sin(rad) / 2;
  const dy = -Math.cos(rad) / 2;
  return { start: { x: 0.5 - dx, y: 0.5 - dy }, end: { x: 0.5 + dx, y: 0.5 + dy } };
}

/** Same stops as tokens.gradients (maroon → deeper maroon only, brand rule §H.3). */
export const gradients = {
  maroon: { colors: ['#8A1A3E', '#781232', '#4F1124'] as const, locations: [0, 0.45, 1] as const, ...angle(165) },
  maroonFlat: { colors: ['#861A3C', '#781232', '#5A1329'] as const, locations: [0, 0.55, 1] as const, ...angle(160) },
};

export const pattern = t.pattern;
export const motion = t.motion;

/** Wide screens (tablets) centre the phone layout in a column, like the web's tablet rule. */
export const layout = { maxWidth: 640, headerTop: 8 } as const;

/** Largest text scaling the layouts are built for (accessibility font sizes beyond it are capped). */
export const MAX_FONT_SCALE = 1.3;
