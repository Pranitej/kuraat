import { forwardRef, useEffect, useId, useState } from 'react';
import { ChevronDown, Eye, EyeOff, Lock } from 'lucide-react';
import { cn } from '@/lib/cn.js';
import { COUNTRIES, countryOf, formatNationalInput, phonePlaceholder, splitPhone, toApiPhone } from '@/domain';
import { t } from '@/i18n';

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
          className="-me-1 grid size-9 shrink-0 place-items-center rounded-full text-maroon transition hover:bg-maroon/[0.06]"
          aria-label={visible ? t('Hide password') : t('Show password')}
          aria-pressed={visible}
        >
          {visible ? <EyeOff size={20} strokeWidth={1.8} /> : <Eye size={20} strokeWidth={1.8} />}
        </button>
      }
      {...props}
    />
  );
});

/**
 * Country code picker (every country, Saudi Arabia selected by default) + the number (PDF screens 03, 06, 13).
 * `value` and `onChange` use the API form (domain/phone.js): Saudi Arabia → the 9 digits, any other country →
 * "+" and the full number, so forms and requests need no changes. `trailing` sits at the end of the number box.
 */
export const PhoneField = forwardRef(function PhoneField(
  { label = t('Mobile number'), value, onChange, error, helper, className, id: idProp, autoFocus, disabled, placeholder, trailing, ...rest },
  ref,
) {
  const autoId = useId();
  const id = idProp || autoId;
  const [iso, setIso] = useState(() => splitPhone(value).iso);
  const [text, setText] = useState(() => {
    const s = splitPhone(value);
    return formatNationalInput(s.iso, s.national);
  });
  // The value changed from outside (a form restored or cleared): follow it. Our own typing keeps value === toApiPhone(iso, text).
  useEffect(() => {
    if (value === toApiPhone(iso, text)) return;
    const s = splitPhone(value, iso);
    setIso(s.iso);
    setText(formatNationalInput(s.iso, s.national));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const country = countryOf(iso);
  const pickCountry = (next) => {
    const reformatted = formatNationalInput(next, text);
    setIso(next);
    setText(reformatted);
    onChange(toApiPhone(next, reformatted));
  };
  const type = (raw) => {
    const next = formatNationalInput(iso, raw);
    setText(next);
    onChange(toApiPhone(iso, next));
  };

  return (
    <FieldWrapper id={id} label={label} error={error} helper={helper} className={className}>
      <div className="flex gap-3">
        <div className={inputShell({ disabled, padded: false, className: 'relative w-[100px] shrink-0 justify-between gap-1 px-3.5' })}>
          <span className="text-input text-ink" aria-hidden>
            +{country.dial}
          </span>
          <ChevronDown size={18} strokeWidth={1.8} className="shrink-0 text-ink" aria-hidden />
          {/* A native select keeps it keyboard and screen-reader friendly, and every phone has a good picker for it. */}
          <select
            aria-label={t('Country code')}
            disabled={disabled}
            value={iso}
            onChange={(e) => pickCountry(e.target.value)}
            className="absolute inset-0 cursor-pointer opacity-0"
          >
            {COUNTRIES.map((c) => (
              <option key={c.iso} value={c.iso}>
                {c.name} (+{c.dial})
              </option>
            ))}
          </select>
        </div>
        <div className={cn(inputShell({ error, disabled }), 'min-w-0 flex-1')}>
          <input
            ref={ref}
            id={id}
            type="tel"
            inputMode="tel"
            autoComplete="tel-national"
            autoFocus={autoFocus}
            disabled={disabled}
            placeholder={placeholder || phonePlaceholder(iso)}
            value={text}
            maxLength={iso === 'SA' ? 11 : 20}
            onChange={(e) => type(e.target.value)}
            aria-invalid={Boolean(error) || undefined}
            aria-describedby={error ? `${id}-error` : helper ? `${id}-helper` : undefined}
            className={inputBase}
            {...rest}
          />
          {trailing}
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
        {Icon && <Icon size={20} strokeWidth={1.8} className="pointer-events-none absolute start-4 text-maroon" aria-hidden />}
        <select
          ref={ref}
          id={id}
          className={cn('h-full w-full cursor-pointer appearance-none bg-transparent pe-10 text-input text-ink outline-none', Icon ? 'ps-12' : 'ps-4')}
          {...rest}
        >
          {options.map((o) => (
            <option key={o.value ?? o} value={o.value ?? o}>
              {o.label ?? o}
            </option>
          ))}
        </select>
        <ChevronDown size={18} strokeWidth={1.8} className="pointer-events-none absolute end-4 text-ink" aria-hidden />
      </div>
    </FieldWrapper>
  );
});
