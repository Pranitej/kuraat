import { useEffect, useRef } from 'react';
import { cn } from '@/lib/cn.js';
import { t } from '@/i18n';

/** 6-cell one-time code input with auto-advance, backspace and paste support. */
export default function OtpInput({ value, onChange, length = 6, error, disabled, autoFocus = true, onComplete }) {
  const refs = useRef([]);
  const digits = Array.from({ length }, (_, i) => value[i] || '');

  useEffect(() => {
    if (autoFocus) refs.current[Math.min(value.length, length - 1)]?.focus();
    // only on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // After a wrong code the value is cleared — put the cursor back in the first cell
  useEffect(() => {
    if (value === '' && error) refs.current[0]?.focus();
  }, [value, error]);

  const setAt = (index, char) => {
    const next = digits.slice();
    next[index] = char;
    const joined = next.join('').slice(0, length);
    onChange(joined);
    if (next.every(Boolean)) onComplete?.(joined);
  };

  const handleChange = (index, e) => {
    let raw = e.target.value.replace(/\D/g, '');
    if (!raw) return;
    // Typing over a filled cell yields two characters — keep the newly typed one
    if (raw.length === 2 && digits[index]) raw = raw.startsWith(digits[index]) ? raw.slice(1) : raw.slice(0, 1);
    if (raw.length > 1) {
      // paste / autofill into one cell
      const merged = (value.slice(0, index) + raw).slice(0, length);
      onChange(merged);
      refs.current[Math.min(merged.length, length - 1)]?.focus();
      if (merged.length === length) onComplete?.(merged);
      return;
    }
    // keep codes contiguous: typing into a later empty cell fills the first empty one
    const target = Math.min(index, value.length);
    setAt(target, raw);
    refs.current[Math.min(target + 1, length - 1)]?.focus();
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace') {
      e.preventDefault();
      if (digits[index]) {
        onChange(value.slice(0, index) + value.slice(index + 1));
      } else if (index > 0) {
        onChange(value.slice(0, index - 1) + value.slice(index));
        refs.current[index - 1]?.focus();
      }
    } else if (e.key === 'ArrowLeft' && index > 0) refs.current[index - 1]?.focus();
    else if (e.key === 'ArrowRight' && index < length - 1) refs.current[index + 1]?.focus();
  };

  return (
    <div className="grid grid-cols-6 gap-2.5" role="group" aria-label={t('Verification code')}>
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => (refs.current[i] = el)}
          type="text"
          inputMode="numeric"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          maxLength={length}
          value={d}
          disabled={disabled}
          aria-label={t('Digit {n}', { n: i + 1 })}
          aria-invalid={Boolean(error) || undefined}
          onChange={(e) => handleChange(i, e)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onFocus={(e) => e.target.select()}
          className={cn(
            'h-[61px] w-full min-w-0 rounded-md border bg-white text-center text-[24px] font-semibold text-ink outline-none transition-[border-color,box-shadow] duration-150 disabled:opacity-60',
            error ? 'border-hotpink shadow-ring-error' : 'border-line focus:border-maroon focus:shadow-ring',
          )}
        />
      ))}
    </div>
  );
}
