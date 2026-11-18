import { ChevronDown, Eye, EyeOff, Lock, type LucideIcon } from '@/components/icons';
import { useEffect, useState, type ReactNode, type Ref } from 'react';
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
import { COUNTRIES, countryOf, formatNationalInput, phonePlaceholder, splitPhone, toApiPhone } from '@/domain';
import { FONT_FAMILY, MAX_FONT_SCALE, colors, radii, shadows, sizes } from '@/theme/theme';
import { BottomSheet } from './BottomSheet';
import { Text } from './Text';

type Country = { iso: string; name: string; dial: string };

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

type PhoneProps = Omit<FieldProps, 'value' | 'onChangeText' | 'onChange'> & {
  /** The API form (domain/phone.js): Saudi Arabia → the 9 digits, any other country → "+" and the full number. */
  value: string;
  onChange: (value: string) => void;
  /** Sits at the end of the number box (e.g. a "Verified" tag). */
  trailing?: ReactNode;
};

/** Every country with its calling code, searchable, in a bottom sheet. */
function CountrySheet({ open, onClose, selected, onPick }: { open: boolean; onClose: () => void; selected: string; onPick: (iso: string) => void }) {
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase().replace(/^\+/, '');
  const list = q ? (COUNTRIES as Country[]).filter((c) => c.name.toLowerCase().includes(q) || c.dial.startsWith(q) || c.iso.toLowerCase() === q) : (COUNTRIES as Country[]);
  return (
    <BottomSheet open={open} onClose={onClose} title="Country code">
      <View style={styles.search}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search country or code"
          placeholderTextColor={colors.placeholder}
          accessibilityLabel="Search country or code"
          autoCorrect={false}
          maxFontSizeMultiplier={MAX_FONT_SCALE}
          selectionColor={colors.maroon}
          style={styles.searchInput}
        />
      </View>
      {list.length ? (
        list.map((c) => (
          <Pressable
            key={c.iso}
            onPress={() => {
              onPick(c.iso);
              setQuery('');
              onClose();
            }}
            accessibilityRole="button"
            accessibilityState={{ selected: c.iso === selected }}
            accessibilityLabel={`${c.name}, plus ${c.dial}`}
            style={styles.countryRow}
          >
            <Text weight={c.iso === selected ? 700 : 500} style={styles.countryName} numberOfLines={1}>
              {c.name}
            </Text>
            <Text weight={c.iso === selected ? 700 : 400} color={c.iso === selected ? 'maroon' : 'muted'}>
              +{c.dial}
            </Text>
          </Pressable>
        ))
      ) : (
        <Text color="muted">No country matches “{query}”.</Text>
      )}
    </BottomSheet>
  );
}

/**
 * Country code picker (every country, Saudi Arabia selected by default) + the number (PDF screens 03, 06, 13).
 * `value` / `onChange` use the API form, so forms and requests need no changes (same as the web).
 */
export function PhoneField({ label = 'Mobile number', value, onChange, error, helper, style, disabled, placeholder, trailing, ref, ...rest }: PhoneProps) {
  const [focused, setFocused] = useState(false);
  const [picking, setPicking] = useState(false);
  const [iso, setIso] = useState(() => splitPhone(value).iso as string);
  const [text, setText] = useState(() => {
    const s = splitPhone(value);
    return formatNationalInput(s.iso, s.national) as string;
  });
  // The value changed from outside (a form restored or cleared): follow it. Our own typing keeps value === toApiPhone(iso, text).
  useEffect(() => {
    if (value === toApiPhone(iso, text)) return;
    const s = splitPhone(value, iso);
    setIso(s.iso);
    setText(formatNationalInput(s.iso, s.national));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const country = countryOf(iso) as Country;
  const pickCountry = (next: string) => {
    const reformatted = formatNationalInput(next, text) as string;
    setIso(next);
    setText(reformatted);
    onChange(toApiPhone(next, reformatted));
  };
  const type = (raw: string) => {
    const next = formatNationalInput(iso, raw) as string;
    setText(next);
    onChange(toApiPhone(iso, next));
  };

  return (
    <FieldWrapper label={label} error={error} helper={helper} style={style}>
      <View style={styles.phoneRow}>
        <Pressable
          onPress={() => setPicking(true)}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel={`Country code: ${country.name}, plus ${country.dial}. Change`}
          style={[inputShellStyle({ disabled }), styles.country]}
        >
          <Text variant="input">+{country.dial}</Text>
          <ChevronDown size={18} color={colors.ink} strokeWidth={1.8} />
        </Pressable>
        <View style={[inputShellStyle({ focused, error: Boolean(error), disabled }), styles.flex]}>
          <TextInput
            ref={ref}
            value={text}
            onChangeText={type}
            keyboardType="phone-pad"
            textContentType="telephoneNumber"
            autoComplete="tel-national"
            maxLength={iso === 'SA' ? 11 : 20}
            editable={!disabled}
            placeholder={placeholder || (phonePlaceholder(iso) as string)}
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
          {trailing}
        </View>
      </View>
      {picking ? <CountrySheet open onClose={() => setPicking(false)} selected={iso} onPick={pickCountry} /> : null}
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
  country: { width: 100, paddingHorizontal: 14, justifyContent: 'space-between', gap: 4 },
  search: { height: 48, justifyContent: 'center', paddingHorizontal: 16, marginBottom: 8, borderRadius: radii.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface },
  searchInput: { height: '100%', paddingVertical: 0, fontSize: 16, fontFamily: FONT_FAMILY[500], color: colors.ink },
  countryRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderBottomWidth: 1, borderBottomColor: colors.divider },
  countryName: { flex: 1 },
  flex: { flex: 1 },
});
