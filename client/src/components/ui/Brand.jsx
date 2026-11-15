import { useMemo } from 'react';
import { pattern as patternTokens } from '@/theme/tokens.js';
import { logos } from '@/assets/images.js';
import { cn } from '@/lib/cn.js';
import { initials } from '@/domain';

/** Wordmark — solid white on maroon or solid maroon on cream (brand rule). */
export function Logo({ tone = 'maroon', className, alt = 'kuraat' }) {
  return <img src={tone === 'white' ? logos.white : logos.maroon} alt={alt} draggable="false" className={cn('h-auto select-none', className)} />;
}

function patternUrl({ a, b, cell }) {
  const c = cell;
  const r = (c * 0.36).toFixed(2);
  const h = c / 2;
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${c * 2}' height='${c * 2}'><rect width='${c}' height='${c}' fill='${a}'/><circle cx='${h}' cy='${h}' r='${r}' fill='${b}'/><rect x='${c}' width='${c}' height='${c}' fill='${b}'/><circle cx='${c + h}' cy='${h}' r='${r}' fill='${a}'/><rect y='${c}' width='${c}' height='${c}' fill='${b}'/><circle cx='${h}' cy='${c + h}' r='${r}' fill='${a}'/><rect x='${c}' y='${c}' width='${c}' height='${c}' fill='${a}'/><circle cx='${c + h}' cy='${c + h}' r='${r}' fill='${b}'/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

const FADES = { down: 'mask-fade-down', up: 'mask-fade-up', edges: 'mask-fade-edges', none: '' };

/** Brand circle pattern (checkerboard of squares with inverse-tone circles). */
export function CirclePattern({ variant = 'maroon', fade = 'down', className }) {
  const style = useMemo(() => ({ backgroundImage: patternUrl(patternTokens[variant]), backgroundPosition: '-2px -2px' }), [variant]);
  return <div aria-hidden className={cn('pointer-events-none absolute inset-0', FADES[fade], className)} style={style} />;
}

/** Maroon gradient surface with the circle pattern (headers, banners, footers). */
export function MaroonPanel({ as: As = 'div', fade = 'down', className, children, patternClassName, ...rest }) {
  return (
    <As className={cn('relative isolate overflow-hidden bg-maroon-gradient text-white', className)} {...rest}>
      <CirclePattern variant="maroon" fade={fade} className={cn('-z-10', patternClassName)} />
      {children}
    </As>
  );
}

/** WhatsApp glyph (brand mark — not available in Lucide). */
export function WhatsAppIcon({ size = 20, className }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path
        d="M3.7 20.3l1.2-4.2a8.55 8.55 0 1 1 3.2 3.1L3.7 20.3Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M9.2 7.9c.2-.4.4-.45.7-.45h.5c.17 0 .37.05.5.37l.68 1.62c.08.22.04.45-.1.63l-.5.6c-.13.17-.14.36-.02.55.33.56.74 1.05 1.24 1.48.47.41.98.74 1.53.97.2.09.4.04.55-.1l.57-.66c.17-.2.42-.24.65-.13l1.57.74c.27.13.37.33.37.56 0 .33-.1.92-.5 1.3-.47.42-1.12.7-1.87.56-1.16-.23-2.4-.88-3.56-1.95-1.2-1.11-2-2.4-2.32-3.6-.18-.74.05-1.44.3-1.86Z"
        fill="currentColor"
      />
    </svg>
  );
}

/** Initials avatar or photo. */
export function Avatar({ name, src, size = 44, tone = 'maroon', className, textClassName }) {
  return (
    <span
      className={cn(
        'grid shrink-0 select-none place-items-center overflow-hidden rounded-full font-bold',
        tone === 'maroon' ? 'bg-maroon text-white' : 'bg-cream text-maroon',
        className,
      )}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.36) }}
      aria-hidden={!src}
    >
      {src ? <img src={src} alt={name} className="size-full object-cover" /> : <span className={textClassName}>{initials(name)}</span>}
    </span>
  );
}
