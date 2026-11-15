import { cn } from '@/lib/cn.js';

/** Flat white card: 1 pt warm border, r-xl, no shadow. */
export function Card({ as: As = 'div', className, children, ...rest }) {
  return (
    <As className={cn('rounded-xl border border-line-subtle bg-white', className)} {...rest}>
      {children}
    </As>
  );
}

/** Sand info banner with leading icon. */
export function InfoBanner({ icon: Icon, children, className }) {
  return (
    <div className={cn('flex gap-3 rounded-lg bg-sand px-4 py-3.5 text-[15px] leading-[22px] text-copy', className)}>
      {Icon && <Icon size={20} strokeWidth={1.8} className="mt-px shrink-0 text-maroon" aria-hidden />}
      <div className="min-w-0">{children}</div>
    </div>
  );
}

/** Circular icon tile (sand background, maroon line icon). */
export function IconTile({ icon: Icon, size = 44, iconSize = 20, tone = 'sand', className, shape = 'circle' }) {
  return (
    <span
      aria-hidden
      className={cn(
        'grid shrink-0 place-items-center',
        shape === 'circle' ? 'rounded-full' : 'rounded-sm',
        tone === 'sand' && 'bg-sand text-maroon',
        tone === 'white' && 'bg-white text-maroon',
        tone === 'glass' && 'bg-white/[0.16] text-white',
        className,
      )}
      style={{ width: size, height: size }}
    >
      <Icon size={iconSize} strokeWidth={1.8} />
    </span>
  );
}

/** Summary rows: label (muted) ↔ value (ink). */
export function SummaryRow({ label, value, strong, className }) {
  return (
    <div className={cn('flex items-baseline justify-between gap-4', className)}>
      <span className={strong ? 'text-[16px] font-bold leading-6 text-ink' : 'text-body text-muted'}>{label}</span>
      <span className={cn('tabular text-right', strong ? 'text-[16px] font-bold text-ink' : 'text-[15px] font-semibold text-ink')}>{value}</span>
    </div>
  );
}

export function Skeleton({ className }) {
  return <span aria-hidden className={cn('skeleton block rounded-md', className)} />;
}

export function SectionTitle({ children, action, className, as: As = 'h2' }) {
  return (
    <div className={cn('flex items-center justify-between gap-4', className)}>
      <As className="text-heading text-ink">{children}</As>
      {action}
    </div>
  );
}
