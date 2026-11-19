import { useState } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { ChevronDown, type LucideIcon } from '@/components/icons';
import { colors } from '@/theme/theme';
import { BottomSheet } from './BottomSheet';
import { RadioDot } from './Controls';
import { FieldWrapper, inputShellStyle } from './Field';
import { Text } from './Text';
import { t } from '@/i18n';

type Option = string | { value: string; label: string };
const valueOf = (o: Option) => (typeof o === 'string' ? o : o.value);
const labelOf = (o: Option) => (typeof o === 'string' ? o : o.label);

type Props = {
  label: string;
  value: string;
  options: readonly Option[];
  onChange: (value: string) => void;
  icon?: LucideIcon;
  error?: string | null;
  placeholder?: string;
  style?: StyleProp<ViewStyle>;
  /** 'chip': an inline "<label> [value ⌄]" pill (e.g. the My orders status filter) instead of a form field. */
  variant?: 'field' | 'chip';
  /** Bottom-sheet title; defaults to the label. */
  sheetTitle?: string;
};

/** Select (District, City): looks like a field with ⌄; opens a bottom sheet of options. */
export function SelectField({ label, value, options, onChange, icon: Icon, error, placeholder = t('Choose'), style, variant = 'field', sheetTitle }: Props) {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => valueOf(o) === value);
  const sheet = (
    <BottomSheet open={open} onClose={() => setOpen(false)} title={sheetTitle ?? label}>
      <View style={styles.list}>
        {options.map((o) => {
          const selected = valueOf(o) === value;
          return (
            <Pressable
              key={valueOf(o)}
              onPress={() => {
                onChange(valueOf(o));
                setOpen(false);
              }}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              accessibilityLabel={labelOf(o)}
              style={({ pressed }) => [styles.option, pressed && styles.pressed]}
            >
              <RadioDot checked={selected} />
              <Text variant="body-strong" weight={selected ? 700 : 600} style={styles.flex}>
                {labelOf(o)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </BottomSheet>
  );

  if (variant === 'chip') {
    const text = current ? labelOf(current) : placeholder;
    return (
      <View style={[styles.chipRow, style]}>
        <Text variant="label" color="muted">
          {label}
        </Text>
        <Pressable
          onPress={() => setOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={`${label}: ${text}`}
          accessibilityHint={t('Opens the list of options')}
          style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
        >
          <Text variant="small" weight={600} color="maroon" numberOfLines={1}>
            {text}
          </Text>
          <ChevronDown size={18} color={colors.maroon} strokeWidth={2} />
        </Pressable>
        {sheet}
      </View>
    );
  }

  return (
    <FieldWrapper label={label} error={error} style={style}>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${current ? labelOf(current) : placeholder}`}
        accessibilityHint={t('Opens the list of options')}
        style={inputShellStyle({ error: Boolean(error) })}
      >
        {Icon ? <Icon size={20} color={colors.maroon} strokeWidth={1.8} /> : null}
        <Text variant="input" color={current ? 'ink' : 'placeholder'} style={styles.flex} numberOfLines={1}>
          {current ? labelOf(current) : placeholder}
        </Text>
        <ChevronDown size={18} color={colors.ink} strokeWidth={1.8} />
      </Pressable>
      {sheet}
    </FieldWrapper>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  list: { gap: 4 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, paddingHorizontal: 4, borderRadius: 12 },
  pressed: { backgroundColor: 'rgba(120,18,50,0.05)' },
  chipRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  chip: {
    height: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingLeft: 16,
    paddingRight: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
  },
});
