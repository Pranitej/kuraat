import { cn } from '@/lib/cn.js';
import Button from './Button.jsx';

/** Scattered sand dots around the ring (positions as % of a 306 × 276 frame, from PDF screen 21). */
const DOTS = [
  { w: 9.8, left: 6.5, top: 0.7 },
  { w: 6.5, right: 11.8, top: 18.8 },
  { w: 4.2, left: 2.6, top: 62.3 },
  { w: 11.1, right: 0, top: 75.4 },
  { w: 5.6, left: 20.9, bottom: 0 },
];

/** Empty-state illustration: sand ring + white disc + maroon line icon + sand dots. Scales with its container. */
export function EmptyIllustration({ icon: Icon, maxWidth = 306 }) {
  return (
    <div className="relative mx-auto aspect-[306/276] w-full" style={{ maxWidth }} aria-hidden>
      {DOTS.map((d, i) => (
        <span
          key={i}
          className="absolute aspect-square rounded-full bg-sand"
          style={{ width: `${d.w}%`, left: d.left != null ? `${d.left}%` : undefined, right: d.right != null ? `${d.right}%` : undefined, top: d.top != null ? `${d.top}%` : undefined, bottom: d.bottom != null ? `${d.bottom}%` : undefined }}
        />
      ))}
      <span className="absolute grid aspect-square place-items-center rounded-full bg-sand" style={{ width: '73.9%', left: '13.1%', top: '8%' }}>
        <span className="grid aspect-square w-[69%] place-items-center rounded-full bg-white">
          <Icon strokeWidth={1.6} className="text-maroon" style={{ width: '40%', height: '40%' }} />
        </span>
      </span>
    </div>
  );
}

export default function EmptyState({ icon, title, message, actionLabel, actionTo, onAction, className, compact }) {
  return (
    <div className={cn('flex flex-col items-center px-6 text-center', compact ? 'py-6' : 'py-10', className)}>
      {icon && <EmptyIllustration icon={icon} maxWidth={compact ? 230 : 306} />}
      <h2 className="mt-2 text-h1 text-ink">{title}</h2>
      {message && <p className="mt-2 max-w-[340px] text-body text-muted">{message}</p>}
      {actionLabel && (
        <Button to={actionTo} onClick={onAction} className="mt-7 w-full max-w-[248px]">
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
