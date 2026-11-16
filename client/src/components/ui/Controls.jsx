import { Check, Minus, Plus } from 'lucide-react';
import { cn } from '@/lib/cn.js';

/** Segmented control (Gender, Password | WhatsApp code). */
export function SegmentedControl({ options, value, onChange, label, className, size = 'lg' }) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn('flex rounded-md bg-sand p-1', size === 'lg' ? 'h-[52px]' : 'h-11', className)}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(opt.value)}
            className={cn(
              'flex-1 rounded-[11px] text-[15px] leading-5 transition-colors duration-150',
              active ? 'bg-maroon font-bold text-white shadow-[0_1px_2px_rgba(73,17,33,0.2)]' : 'font-semibold text-maroon hover:bg-white/40',
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

/** Filter chip (36 pt pill). */
export function Chip({ active, children, className, ...rest }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={cn(
        'inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-pill border px-4 text-small font-semibold transition-colors duration-150',
        active ? 'border-maroon bg-maroon text-white' : 'border-line bg-white text-maroon hover:border-maroon/40',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

/** Horizontally scrolling chip row that bleeds to the screen edge on mobile. */
export function ChipRow({ children, className }) {
  return (
    <div className={cn('no-scrollbar -mx-5 flex gap-2.5 overflow-x-auto px-5 py-0.5 lg:mx-0 lg:flex-wrap lg:px-0', className)}>
      {children}
    </div>
  );
}

/** Tag / badge (light: sand + maroon, dark: maroon + white, alert: hot pink — e.g. "Cancelled"). */
export function Tag({ tone = 'light', icon: Icon, children, className }) {
  return (
    <span
      className={cn(
        'inline-flex h-6 shrink-0 items-center gap-1 whitespace-nowrap rounded-pill px-2.5 text-tag',
        tone === 'dark' ? 'bg-maroon text-white' : tone === 'alert' ? 'bg-hotpink/10 text-hotpink' : 'bg-sand text-maroon',
        className,
      )}
    >
      {Icon && <Icon size={13} strokeWidth={2.4} aria-hidden />}
      {children}
    </span>
  );
}

/** − n + stepper on a sand pill. */
export function QuantityStepper({ value, onChange, min = 1, max = 20, size = 'md', onMinReached, label = 'Quantity', className }) {
  const btn = size === 'lg' ? 'size-[38px]' : 'size-8';
  const icon = size === 'lg' ? 20 : 17;
  const dec = () => (value <= min ? onMinReached?.() : onChange(value - 1));
  return (
    <div className={cn('inline-flex items-center rounded-pill bg-sand p-1', className)} role="group" aria-label={label}>
      <button
        type="button"
        onClick={dec}
        disabled={value <= min && !onMinReached}
        aria-label="Decrease quantity"
        className={cn(btn, 'grid place-items-center rounded-full bg-white text-maroon transition active:scale-90 disabled:opacity-50')}
      >
        <Minus size={icon} strokeWidth={2} />
      </button>
      <output aria-live="polite" className={cn('tabular text-center font-bold text-ink', size === 'lg' ? 'min-w-[30px] text-[17px]' : 'min-w-[32px] text-[16px]')}>
        {value}
      </output>
      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        aria-label="Increase quantity"
        className={cn(btn, 'grid place-items-center rounded-full bg-white text-maroon transition active:scale-90 disabled:opacity-50')}
      >
        <Plus size={icon} strokeWidth={2} />
      </button>
    </div>
  );
}

/** iOS-style switch (46 × 26). */
export function Toggle({ checked, onChange, label, id, disabled }) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative h-[26px] w-[46px] shrink-0 rounded-pill transition-colors duration-200 disabled:opacity-50',
        checked ? 'bg-maroon' : 'bg-sand',
      )}
    >
      <span
        className={cn(
          'absolute left-0 top-[2px] size-[22px] rounded-full bg-white shadow-[0_1px_3px_rgba(73,17,33,0.25)] transition-transform duration-200',
          checked ? 'translate-x-[22px]' : 'translate-x-[2px]',
        )}
      />
    </button>
  );
}

/** Radio indicator (visual only — the parent card is the actual radio). */
export function RadioDot({ checked, className }) {
  return (
    <span
      aria-hidden
      className={cn(
        'grid size-[22px] shrink-0 place-items-center rounded-full border-[1.5px] bg-white transition-colors',
        checked ? 'border-maroon' : 'border-[#D9C1B5]',
        className,
      )}
    >
      <span className={cn('size-[10px] rounded-full bg-maroon transition-transform duration-150', checked ? 'scale-100' : 'scale-0')} />
    </span>
  );
}

/** Round maroon check (password rules, success marks). */
export function CheckCircle({ checked = true, size = 22, className }) {
  return (
    <span
      aria-hidden
      className={cn('grid shrink-0 place-items-center rounded-full bg-maroon text-white transition-opacity', !checked && 'opacity-30', className)}
      style={{ width: size, height: size }}
    >
      <Check size={size * 0.62} strokeWidth={3} />
    </span>
  );
}

/** Thin progress bar (maroon on sand). */
export function ProgressBar({ value, className, label }) {
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(value)}
      className={cn('h-1 overflow-hidden rounded-pill bg-sand', className)}
    >
      <div className="h-full rounded-pill bg-maroon transition-[width] duration-300 ease-out" style={{ width: `${value}%` }} />
    </div>
  );
}

/** Horizontal rule with centred caption ("or", "Did not get the code on WhatsApp?"). */
export function TextDivider({ children, className }) {
  return (
    <div className={cn('flex items-center gap-3 text-small text-muted', className)}>
      <span className="h-px flex-1 bg-divider" />
      <span className="shrink-0">{children}</span>
      <span className="h-px flex-1 bg-divider" />
    </div>
  );
}
