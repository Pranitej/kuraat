/**
 * kuraat design tokens — single source of truth.
 *
 * Values come from `DESIGN_SYSTEM.md` (measured from the UI PDF). These tokens feed
 * `tailwind.config.js` for the web build and are plain JS (no CSS/DOM) so the React Native
 * app in ../mobile can start from a copy of this file.
 */

export const colors = {
  // Brand palette (exact, from the brand guide on PDF page 1)
  cream: '#FBF5EF',
  sand: {
    DEFAULT: '#F3DDD0',
    soft: '#F7E9E0', // sand 50% over cream — unread notification rows
  },
  maroon: {
    DEFAULT: '#781232',
    dark: '#5F0E28', // pressed state (derived)
    deep: '#491121',
  },
  orange: {
    DEFAULT: '#C8542D',
    light: '#DC785A',
  },
  rose: '#D7466D',
  pink: '#F59698',
  hotpink: '#ED3B5C',

  // Functional colours (measured from the screens)
  surface: '#FFFFFF',
  ink: '#491121', // headings, titles, values
  copy: '#5A3A41', // long-form paragraphs (est.) — named `copy` to avoid clashing with the `body` type token
  muted: '#73575D', // secondary text (est.)
  placeholder: '#8E747B', // input placeholder (est.)
  line: {
    DEFAULT: '#E6D3C9', // input border (est.)
    subtle: '#EEE1D8', // card border (est.)
  },
  divider: '#EBD9CF',
  viewer: '#2B0A13', // image zoom background (est.)
};

export const fontFamily = {
  // Brand typeface is Bahij TheSansArabic (licensed). Source Sans 3 / Noto Sans Arabic are the
  // stand-ins used in the PDF mockups — swap here when the licensed font is available.
  sans: ['"Source Sans 3"', '"Noto Sans Arabic"', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
  arabic: ['"Noto Sans Arabic"', '"Source Sans 3"', 'sans-serif'],
};

/** [size, lineHeight, weight, letterSpacing?] in px */
export const typeScale = {
  display: [30, 34, 700],
  title: [28, 34, 700],
  h1: [24, 30, 700],
  heading: [20, 26, 700],
  h3: [18, 24, 700],
  'body-lg': [16, 24, 400],
  input: [16, 22, 500],
  button: [16, 20, 700],
  body: [15, 22, 400],
  'body-strong': [15, 20, 600],
  small: [14, 20, 400],
  label: [13, 18, 600],
  caption: [12, 16, 400],
  overline: [12, 16, 700, '0.08em'],
  tag: [12, 16, 700],
};

export const radii = {
  none: 0,
  xs: 8,
  sm: 12,
  md: 14,
  lg: 16,
  xl: 20,
  '2xl': 24,
  sheet: 28,
  pill: 9999,
};

export const spacing = {
  gutter: 20, // app screens
  'gutter-auth': 24, // auth sheet forms
  'label-gap': 8,
  'field-gap': 20,
  'card-gap': 12,
  'grid-gap': 16,
  section: 28,
};

export const sizes = {
  button: 54,
  'button-md': 46,
  'button-sm': 44,
  input: 52,
  'icon-button': 44,
  chip: 36,
  fab: 64,
  toggleW: 46,
  toggleH: 26,
  radio: 22,
};

export const shadows = {
  fab: '0 12px 28px -8px rgba(73, 17, 33, 0.45)',
  bar: '0 -8px 24px rgba(73, 17, 33, 0.06)',
  dialog: '0 24px 60px -12px rgba(43, 10, 19, 0.40)',
  float: '0 4px 14px rgba(73, 17, 33, 0.10)',
  ring: '0 0 0 3px rgba(120, 18, 50, 0.10)',
  'ring-error': '0 0 0 3px rgba(237, 59, 92, 0.14)',
};

export const gradients = {
  maroon: 'linear-gradient(165deg, #8A1A3E 0%, #781232 45%, #4F1124 100%)',
  maroonFlat: 'linear-gradient(160deg, #861A3C 0%, #781232 55%, #5A1329 100%)',
};

export const overlay = 'rgba(64, 15, 30, 0.66)';

/** Brand circle pattern (checkerboard of squares holding inverse-tone circles). */
export const pattern = {
  maroon: { a: 'rgba(0,0,0,0.075)', b: 'rgba(255,255,255,0.035)', cell: 44 },
  splash: { a: 'rgba(0,0,0,0.085)', b: 'rgba(255,255,255,0.03)', cell: 52 },
  sand: { a: 'rgba(243,221,208,0.6)', b: 'rgba(251,245,239,0)', cell: 44 },
};

export const breakpoints = { sm: 640, md: 768, lg: 1024, xl: 1280 };

export const motion = {
  fast: 150,
  base: 220,
  slow: 320,
  easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
};

const tokens = { colors, fontFamily, typeScale, radii, spacing, sizes, shadows, gradients, overlay, pattern, breakpoints, motion };
export default tokens;
