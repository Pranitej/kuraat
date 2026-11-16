import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View, type TextInputInstance } from 'react-native';
import { FONT_FAMILY, colors, radii, shadows } from '@/theme/theme';
import { Text } from './Text';

type Props = {
  value: string;
  onChange: (code: string) => void;
  onComplete?: (code: string) => void;
  length?: number;
  error?: string | null;
  disabled?: boolean;
  autoFocus?: boolean;
};

/**
 * 6-cell one-time code (PDF screen 04). One invisible TextInput takes the typing, paste and the
 * keyboard's code suggestion; the cells only draw it, so there is no focus juggling between cells.
 */
export function OtpInput({ value, onChange, onComplete, length = 6, error, disabled, autoFocus = true }: Props) {
  const input = useRef<TextInputInstance>(null);
  const [focused, setFocused] = useState(false);

  // After a wrong code the value is cleared — keep the keyboard up for the next try.
  useEffect(() => {
    if (value === '' && error) input.current?.focus();
  }, [value, error]);

  const change = (text: string) => {
    const code = text.replace(/\D/g, '').slice(0, length);
    onChange(code);
    if (code.length === length) onComplete?.(code);
  };

  const active = Math.min(value.length, length - 1);
  return (
    <Pressable onPress={() => input.current?.focus()} disabled={disabled} accessible={false} style={styles.row}>
      {Array.from({ length }, (_, i) => {
        const isActive = focused && i === active;
        return (
          <View
            key={i}
            style={[
              styles.cell,
              error ? [styles.cellError, shadows.ringError] : isActive ? [styles.cellActive, shadows.ring] : null,
              disabled && styles.disabled,
            ]}
          >
            <Text style={styles.digit}>{value[i] ?? ''}</Text>
          </View>
        );
      })}
      <TextInput
        ref={input}
        value={value}
        onChangeText={change}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        editable={!disabled}
        autoFocus={autoFocus}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="sms-otp"
        maxLength={length}
        caretHidden
        contextMenuHidden={false}
        accessibilityLabel="Verification code"
        accessibilityHint={error ?? `Enter the ${length}-digit code`}
        style={styles.hidden}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 10 },
  cell: {
    flex: 1,
    height: 61,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellActive: { borderColor: colors.maroon },
  cellError: { borderColor: colors.hotpink },
  disabled: { opacity: 0.6 },
  digit: { fontSize: 24, lineHeight: 30, fontFamily: FONT_FAMILY[600], fontVariant: ['tabular-nums'] },
  // Covers the cells so long-press "Paste" lands on it; invisible but focusable.
  hidden: { ...StyleSheet.absoluteFill, opacity: 0.015, color: 'transparent', fontSize: 1 },
});
