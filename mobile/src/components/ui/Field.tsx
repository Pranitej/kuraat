import { ChevronDown, Eye, EyeOff, Lock, type LucideIcon } from '@/components/icons';
import { useState, type ReactNode, type Ref } from 'react';
import {
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type StyleProp,
  type TextInputInstance,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { formatPhoneLocal, onlyDigits } from '@/domain';
import { FONT_FAMILY, MAX_FONT_SCALE, colors, radii, shadows, sizes } from '@/theme/theme';
import { Text } from './Text';

type WrapperProps = {
  label?: string;
  error?: string | null;
  helper?: ReactNode;
  labelAction?: ReactNode;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
};

/** Label (13/600 maroon) + control + error (13/600 hot pink) or helper (13 muted). */
export function FieldWrapper({ label, error, helper, labelAction, style, children }: WrapperProps) {
  return (
    <View style={style}>
      {label ? (
        <View style={styles.labelRow}>
          <Text variant="label" color="maroon">
            {label}
          </Text>
          {labelAction}
        </View>
      ) : null}
      {children}
      {error ? (
        <Text variant="label" color="hotpink" style={styles.error} accessibilityRole="alert" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : helper ? (
        typeof helper === 'string' ? (
          <Text variant="label" weight={400} color="muted" style={styles.helper}>
            {helper}
          </Text>
        ) : (
          <View style={styles.helper}>{helper}</View>
        )
      ) : null}
    </View>
  );
}

/** Input chrome: 52 pt, r-md, white, 1 pt border; maroon border + 3 pt ring on focus; hot pink on error. */
export function inputShellStyle({
  focused,
  error,
  disabled,
}: {
  focused?: boolean;
  error?: boolean;
  disabled?: boolean;
}): StyleProp<ViewStyle> {
  return [
    styles.shell,
    error ? [styles.shellError, shadows.ringError] : focused ? [styles.shellFocused, shadows.ring] : null,
    disabled ? styles.disabled : null,
  ];
}

export type FieldProps = Omit<TextInputProps, 'style'> & {
  label?: string;
  icon?: LucideIcon;
  trailing?: ReactNode;
  error?: string | null;
  helper?: ReactNode;
  labelAction?: ReactNode;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  inputStyle?: TextInputProps['style'];
  ref?: Ref<TextInputInstance>;
};

/** Text field (PDF: 52 pt, 20 pt maroon leading icon, 16/500 ink value). */
export function Field({
  label,
  icon: Icon,
  trailing,
  error,
  helper,
  labelAction,
  disabled,
  style,
  inputStyle,
  ref,
  onFocus,
  onBlur,
  ...input
}: FieldProps) {
  const [focused, setFocused] = useState(false);
  return (
    <FieldWrapper label={label} error={error} helper={helper} labelAction={labelAction} style={style}>
      <View style={inputShellStyle({ focused, error: Boolean(error), disabled })}>
        {Icon ? <Icon size={20} color={colors.maroon} strokeWidth={1.8} /> : null}
        <TextInput
          ref={ref}
          editable={!disabled}
          placeholderTextColor={colors.placeholder}
          selectionColor={colors.maroon}
          cursorColor={colors.maroon}
          maxFontSizeMultiplier={MAX_FONT_SCALE}
          accessibilityLabel={label}
          accessibilityHint={error ?? undefined}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          style={[styles.input, inputStyle]}
          {...input}
        />
        {trailing}
      </View>
    </FieldWrapper>
  );
}

/** Password with the eye toggle (and the lock icon). */
export function PasswordField({ showIcon = true, ...props }: FieldProps & { showIcon?: boolean }) {
  const [visible, setVisible] = useState(false);
  return (
    <Field
      icon={showIcon ? Lock : undefined}
      secureTextEntry={!visible}
      autoCapitalize="none"
      autoCorrect={false}
      textContentType="password"
      trailing={
        <Pressable
          onPress={() => setVisible((v) => !v)}
          accessibilityRole="button"
          accessibilityLabel={visible ? 'Hide password' : 'Show password'}
          accessibilityState={{ selected: visible }}
          hitSlop={8}
          style={styles.eye}
        >
          {visible ? (
            <EyeOff size={20} color={colors.maroon} strokeWidth={1.8} />
          ) : (
            <Eye size={20} color={colors.maroon} strokeWidth={1.8} />
          )}
        </Pressable>
      }
      {...props}
    />
  );
}

type PhoneProps = Omit<FieldProps, 'value' | 'onChangeText'> & { value: string; onChange: (digits: string) => void };

/** "+966 ⌄" box + 9-digit Saudi mobile shown as "50 123 4821" (PDF screens 03, 06, 13). */
export function PhoneField({
  label = 'Mobile number',
  value,
  onChange,
  error,
  helper,
  style,
  disabled,
  placeholder = '50 123 4821',
  ref,
  ...rest
}: PhoneProps) {
  const [focused, setFocused] = useState(false);
  return (
    <FieldWrapper label={label} error={error} helper={helper} style={style}>
      <View style={styles.phoneRow}>
        <View style={[inputShellStyle({ disabled }), styles.country]} accessibilityLabel="Country code Saudi Arabia, plus 966">
          <Text variant="input">+966</Text>
          <ChevronDown size={18} color={colors.ink} strokeWidth={1.8} />
        </View>
        <View style={[inputShellStyle({ focused, error: Boolean(error), disabled }), styles.flex]}>
          <TextInput
            ref={ref}
            value={formatPhoneLocal(value)}
            onChangeText={(text) => onChange(onlyDigits(text).slice(0, 9))}
            keyboardType="number-pad"
            textContentType="telephoneNumber"
            autoComplete="tel-national"
            maxLength={11}
            editable={!disabled}
            placeholder={placeholder}
            placeholderTextColor={colors.placeholder}
            selectionColor={colors.maroon}
            cursorColor={colors.maroon}
            maxFontSizeMultiplier={MAX_FONT_SCALE}
            accessibilityLabel={label}
            accessibilityHint={error ?? undefined}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            style={styles.input}
            {...rest}
          />
        </View>
      </View>
    </FieldWrapper>
  );
}

const styles = StyleSheet.create({
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 8 },
  error: { marginTop: 6 },
  helper: { marginTop: 8 },
  shell: {
    height: sizes.input,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  shellFocused: { borderColor: colors.maroon },
  shellError: { borderColor: colors.hotpink },
  disabled: { opacity: 0.6 },
  input: { flex: 1, height: '100%', paddingVertical: 0, fontSize: 16, fontFamily: FONT_FAMILY[500], color: colors.ink },
  eye: { width: 36, height: 36, marginRight: -4, alignItems: 'center', justifyContent: 'center', borderRadius: 18 },
  phoneRow: { flexDirection: 'row', gap: 12 },
  country: { width: 90, paddingHorizontal: 14, justifyContent: 'space-between', gap: 4 },
  flex: { flex: 1 },
});
