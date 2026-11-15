import { colors, fontFamily, typeScale, radii, shadows, breakpoints, gradients } from './src/theme/tokens.js';

const px = (v) => `${v}px`;

const fontSize = Object.fromEntries(
  Object.entries(typeScale).map(([name, [size, lh, weight, tracking]]) => [
    name,
    [px(size), { lineHeight: px(lh), fontWeight: String(weight), ...(tracking ? { letterSpacing: tracking } : {}) }],
  ]),
);

const borderRadius = Object.fromEntries(Object.entries(radii).map(([k, v]) => [k, px(v)]));
borderRadius.DEFAULT = px(radii.md);
borderRadius.full = '9999px';

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    screens: Object.fromEntries(Object.entries(breakpoints).map(([k, v]) => [k, px(v)])),
    extend: {
      colors,
      fontFamily,
      fontSize,
      borderRadius,
      boxShadow: shadows,
      backgroundImage: {
        'maroon-gradient': gradients.maroon,
        'maroon-flat': gradients.maroonFlat,
      },
      maxWidth: {
        app: '1200px',
        column: '640px',
        form: '440px',
      },
      keyframes: {
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'fade-up': { from: { opacity: '0', transform: 'translateY(12px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        'scale-in': { from: { opacity: '0', transform: 'scale(.96)' }, to: { opacity: '1', transform: 'scale(1)' } },
        'sheet-up': { from: { transform: 'translateY(100%)' }, to: { transform: 'translateY(0)' } },
        'toast-in': { from: { opacity: '0', transform: 'translateY(16px) scale(.98)' }, to: { opacity: '1', transform: 'translateY(0) scale(1)' } },
        shimmer: { '0%': { backgroundPosition: '-400px 0' }, '100%': { backgroundPosition: '400px 0' } },
        pop: { '0%': { transform: 'scale(1)' }, '40%': { transform: 'scale(1.25)' }, '100%': { transform: 'scale(1)' } },
        'check-draw': { from: { strokeDashoffset: '48' }, to: { strokeDashoffset: '0' } },
        'ring-pulse': { '0%': { transform: 'scale(.85)', opacity: '0' }, '60%': { opacity: '1' }, '100%': { transform: 'scale(1)', opacity: '1' } },
        progress: { from: { width: '0%' }, to: { width: '100%' } },
      },
      animation: {
        'fade-in': 'fade-in .22s ease-out both',
        'fade-up': 'fade-up .32s cubic-bezier(.2,.8,.2,1) both',
        'scale-in': 'scale-in .24s cubic-bezier(.2,.8,.2,1) both',
        'sheet-up': 'sheet-up .3s cubic-bezier(.2,.8,.2,1) both',
        'toast-in': 'toast-in .28s cubic-bezier(.2,.8,.2,1) both',
        shimmer: 'shimmer 1.4s linear infinite',
        pop: 'pop .35s ease-out',
        'check-draw': 'check-draw .45s .15s ease-out both',
        'ring-pulse': 'ring-pulse .5s ease-out both',
      },
    },
  },
  plugins: [],
};
