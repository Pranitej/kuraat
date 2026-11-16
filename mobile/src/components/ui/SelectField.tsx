import { useState } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { ChevronDown, type LucideIcon } from '@/components/icons';
import { colors } from '@/theme/theme';
import { BottomSheet } from './BottomSheet';
import { RadioDot } from './Controls';
import { FieldWrapper, inputShellStyle } from './Field';
import { Text } from './Text';

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
};

/** Select (District, City): looks like a field with ⌄; opens a bottom sheet of options. */
export function SelectField({ label, value, options, onChange, icon: Icon, error, placeholder = 'Choose', style }: Props) {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => valueOf(o) === value);
  return (
    <FieldWrapper label={label} error={error} style={style}>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${current ? labelOf(current) : placeholder}`}
        accessibilityHint="Opens the list of options"
        style={inputShellStyle({ error: Boolean(error) })}
      >
        {Icon ? <Icon size={20} color={colors.maroon} strokeWidth={1.8} /> : null}
        <Text variant="input" color={current ? 'ink' : 'placeholder'} style={styles.flex} numberOfLines={1}>
          {current ? labelOf(current) : placeholder}
        </Text>
        <ChevronDown size={18} color={colors.ink} strokeWidth={1.8} />
      </Pressable>
      <BottomSheet open={open} onClose={() => setOpen(false)} title={label}>
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
    </FieldWrapper>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  list: { gap: 4 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, paddingHorizontal: 4, borderRadius: 12 },
  pressed: { backgroundColor: 'rgba(120,18,50,0.05)' },
});
