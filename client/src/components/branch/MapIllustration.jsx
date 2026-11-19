import { cn } from '@/lib/cn.js';
import { t } from '@/i18n';

/**
 * Stylised map (PDF screens 24 & 25): sand blocks, cream roads, maroon pins, orange "you" dot.
 * Pins are buttons when `onSelect` is provided.
 */
export default function MapIllustration({ pins = [], selectedId, onSelect, you, className, children, height = 'h-[176px]' }) {
  return (
    <div className={cn('relative overflow-hidden rounded-xl bg-[#F1DACD]', height, className)}>
      <svg viewBox="0 0 390 190" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 size-full" aria-hidden>
        <rect width="390" height="190" fill="#F1DACD" />
        <path d="M300 120 L390 92 L390 190 L260 190 Z" fill="#F3CFCB" />
        <g fill="#EBC9BA">
          <rect x="22" y="18" width="38" height="34" rx="6" />
          <rect x="92" y="78" width="60" height="38" rx="6" />
          <rect x="160" y="100" width="54" height="34" rx="6" />
          <rect x="300" y="22" width="44" height="40" rx="6" />
          <rect x="22" y="152" width="64" height="30" rx="6" />
          <rect x="168" y="152" width="50" height="30" rx="6" />
          <rect x="324" y="122" width="58" height="36" rx="6" />
        </g>
        <g stroke="#FBF5EF" strokeLinecap="round" fill="none">
          <path d="M-10 70 L400 30" strokeWidth="11" />
          <path d="M-10 150 L400 104" strokeWidth="9" />
          <path d="M98 -10 L150 200" strokeWidth="10" />
          <path d="M268 -10 L246 200" strokeWidth="8" />
          <path d="M360 -10 L392 60" strokeWidth="6" />
        </g>
      </svg>

      {you && (
        <span className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${you.x}%`, top: `${you.y}%` }} aria-hidden>
          <span className="absolute left-1/2 top-1/2 size-9 -translate-x-1/2 -translate-y-1/2 rounded-full bg-orange/20" />
          <span className="relative block size-4 rounded-full border-[3px] border-white bg-orange shadow-[0_1px_3px_rgba(0,0,0,0.2)]" />
        </span>
      )}

      {pins.map((pin) => {
        const selected = pin.id === selectedId;
        const PinTag = onSelect ? 'button' : 'span';
        return (
          <PinTag
            key={pin.id}
            type={onSelect ? 'button' : undefined}
            onClick={onSelect ? () => onSelect(pin.id) : undefined}
            aria-label={onSelect ? t('Show {label}', { label: pin.label }) : undefined}
            aria-pressed={onSelect ? selected : undefined}
            className={cn('absolute -translate-x-1/2 -translate-y-full transition-transform duration-200', selected ? 'z-10 scale-125' : 'hover:scale-110')}
            style={{ left: `${pin.x}%`, top: `${pin.y}%` }}
          >
            <MapPinGlyph size={selected ? 34 : 28} />
          </PinTag>
        );
      })}
      {children}
    </div>
  );
}

export function MapPinGlyph({ size = 28 }) {
  return (
    <svg width={size} height={size * 1.2} viewBox="0 0 28 34" aria-hidden className="drop-shadow-[0_2px_3px_rgba(73,17,33,0.3)]">
      <path d="M14 33c-1-1.3-11-11.4-11-19A11 11 0 0 1 25 14c0 7.6-10 17.7-11 19Z" fill="#781232" />
      <circle cx="14" cy="13.5" r="4.2" fill="#fff" />
    </svg>
  );
}
