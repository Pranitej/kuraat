import { forwardRef, useId, useState } from 'react';
import { ChevronDown, Eye, EyeOff, Lock } from 'lucide-react';
import { cn } from '@/lib/cn.js';
import { formatPhoneLocal, onlyDigits } from '@/domain';

/** Label + control + helper/error (PDF: label 13/600 maroon, 8 pt gap). */
export function FieldWrapper({ id, label, error, helper, className, children, labelAction }) {
  return (
    <div className={cn('flex flex-col', className)}>
      {label && (
        <div className="mb-2 flex items-center justify-between gap-3">
          <label htmlFor={id} className="text-label text-maroon">
            {label}
          </label>
          {labelAction}
        </div>
      )}
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="mt-1.5 text-[13px] font-semibold leading-[18px] text-hotpink">
          {error}
        </p>
      ) : helper ? (
        <div id={`${id}-helper`} className="mt-2 text-label font-normal text-muted">
          {helper}
        </div>
      ) : null}
    </div>
  );
}

/** Input chrome: 52 pt, r-md, white, 1 pt border, maroon focus border + 3 pt ring. */
export function inputShell({ error, disabled, className, padded = true } = {}) {
  return cn(
    'flex h-[52px] items-center gap-3 rounded-md border bg-white transition-[border-color,box-shadow] duration-150',
    padded && 'px-4',
    error ? 'border-hotpink shadow-ring-error' : 'border-line focus-within:border-maroon focus-within:shadow-ring',
    disabled && 'opacity-60',
    className,
  );
}

export const inputBase =
  'h-full min-w-0 flex-1 bg-transparent text-input text-ink outline-none placeholder:font-normal placeholder:text-placeholder disabled:cursor-not-allowed';

export const TextField = forwardRef(function TextField(
  { label, icon: Icon, trailing, error, helper, className, inputClassName, id: idProp, labelAction, disabled, ...rest },
  ref,
) {
  const autoId = useId();
  const id = idProp || autoId;
  return (
    <FieldWrapper id={id} label={label} error={error} helper={helper} className={className} labelAction={labelAction}>
      <div className={inputShell({ error, disabled })}>
        {Icon && <Icon size={20} strokeWidth={1.8} className="shrink-0 text-maroon" aria-hidden />}
        <input
          ref={ref}
          id={id}
          disabled={disabled}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={error ? `${id}-error` : helper ? `${id}-helper` : undefined}
          className={cn(inputBase, inputClassName)}
          {...rest}
        />
        {trailing}
      </div>
    </FieldWrapper>
  );
});

export const PasswordField = forwardRef(function PasswordField({ showIcon = true, ...props }, ref) {
  const [visible, setVisible] = useState(false);
  return (
    <TextField
      ref={ref}
      icon={showIcon ? Lock : undefined}
      type={visible ? 'text' : 'password'}
      inputClassName={visible || !props.value ? '' : 'tracking-[0.12em]'}
      trailing={
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="-mr-1 grid size-9 shrink-0 place-items-center rounded-full text-maroon transition hover:bg-maroon/[0.06]"
          aria-label={visible ? 'Hide password' : 'Show password'}
          aria-pressed={visible}
        >
          {visible ? <EyeOff size={20} strokeWidth={1.8} /> : <Eye size={20} strokeWidth={1.8} />}
        </button>
      }
      {...props}
    />
  );
});

/** "+966 ⌄" country box + 9-digit number (PDF screens 03, 06, 13). */
export const PhoneField = forwardRef(function PhoneField(
  { label = 'Mobile number', value, onChange, error, helper, className, id: idProp, autoFocus, disabled, placeholder = '50 123 4821', ...rest },
  ref,
) {
  const autoId = useId();
  const id = idProp || autoId;
  return (
    <FieldWrapper id={id} label={label} error={error} helper={helper} className={className}>
      <div className="flex gap-3">
        <div className={inputShell({ disabled, padded: false, className: 'relative w-[90px] shrink-0 justify-between gap-1 px-3.5' })}>
          <span className="text-input text-ink" aria-hidden>
            +966
          </span>
          <ChevronDown size={18} strokeWidth={1.8} className="shrink-0 text-ink" aria-hidden />
          {/* Native select keeps it keyboard/screen-reader friendly; kuraat delivers in Saudi Arabia only. */}
          <select aria-label="Country code" disabled={disabled} defaultValue="+966" className="absolute inset-0 cursor-pointer opacity-0">
            <option value="+966">Saudi Arabia (+966)</option>
          </select>
        </div>
        <div className={cn(inputShell({ error, disabled }), 'min-w-0 flex-1')}>
          <input
            ref={ref}
            id={id}
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            autoFocus={autoFocus}
            disabled={disabled}
            placeholder={placeholder}
            value={formatPhoneLocal(value)}
            onChange={(e) => onChange(onlyDigits(e.target.value).slice(0, 9))}
            aria-invalid={Boolean(error) || undefined}
            aria-describedby={error ? `${id}-error` : helper ? `${id}-helper` : undefined}
            className={inputBase}
            {...rest}
          />
        </div>
      </div>
    </FieldWrapper>
  );
});

export const SelectField = forwardRef(function SelectField(
  { label, options, error, helper, className, id: idProp, icon: Icon, ...rest },
  ref,
) {
  const autoId = useId();
  const id = idProp || autoId;
  return (
    <FieldWrapper id={id} label={label} error={error} helper={helper} className={className}>
      <div className={inputShell({ error, padded: false, className: 'relative' })}>
        {Icon && <Icon size={20} strokeWidth={1.8} className="pointer-events-none absolute left-4 text-maroon" aria-hidden />}
        <select
          ref={ref}
          id={id}
          className={cn('h-full w-full cursor-pointer appearance-none bg-transparent pr-10 text-input text-ink outline-none', Icon ? 'pl-12' : 'pl-4')}
          {...rest}
        >
          {options.map((o) => (
            <option key={o.value ?? o} value={o.value ?? o}>
              {o.label ?? o}
            </option>
          ))}
        </select>
        <ChevronDown size={18} strokeWidth={1.8} className="pointer-events-none absolute right-4 text-ink" aria-hidden />
      </div>
    </FieldWrapper>
  );
});
