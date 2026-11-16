import { Check, Minus, Plus, type LucideIcon } from '@/components/icons';
import { useEffect, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { colors, motion, radii, sizes } from '@/theme/theme';
import { Text } from './Text';

type Option<T extends string> = { value: T; label: string };

/** Segmented control (Gender; Password | WhatsApp code). Sand track, maroon active pill. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  size = 'lg',
  style,
}: {
  options: readonly Option<T>[];
  value: T | null | undefined;
  onChange: (value: T) => void;
  label?: string;
  size?: 'lg' | 'sm';
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={[styles.segTrack, { height: size === 'lg' ? 52 : 44 }, style]}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => onChange(opt.value)}
            accessibilityRole="radio"
            accessibilityLabel={opt.label}
            accessibilityState={{ checked: active }}
            style={[styles.segItem, active && styles.segActive]}
          >
            <Text weight={active ? 700 : 600} color={active ? 'white' : 'maroon'} style={styles.segText} numberOfLines={1}>
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Filter chip (36 pt pill). */
export function Chip({
  active = false,
  onPress,
  children,
  icon: Icon,
}: {
  active?: boolean;
  onPress?: () => void;
  children: string;
  icon?: LucideIcon;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={children}
      accessibilityState={{ selected: active }}
      style={[styles.chip, active ? styles.chipOn : styles.chipOff]}
    >
      {Icon ? <Icon size={16} color={active ? colors.white : colors.maroon} strokeWidth={1.9} /> : null}
      {/* One line: Android can draw a label a hair narrower than it measured it and would
          wrap "Al Khobar" at the space, leaving "Al" and a gap inside the 36 pt pill. */}
      <Text variant="small" weight={600} color={active ? 'white' : 'maroon'} numberOfLines={1}>
        {children}
      </Text>
    </Pressable>
  );
}

/** Horizontally scrolling chip row that bleeds to the screen edge (20 pt gutter). */
export function ChipRow({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={[styles.chipRow, style]}
      contentContainerStyle={styles.chipRowContent}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );
}

export type TagTone = 'light' | 'dark' | 'alert';

/** Tag / badge: light (sand + maroon), dark (maroon + white), alert (hot pink, e.g. "Cancelled"). */
export function Tag({
  tone = 'light',
  icon: Icon,
  children,
  style,
}: {
  tone?: TagTone;
  icon?: LucideIcon;
  children: string;
  style?: StyleProp<ViewStyle>;
}) {
  const fg = tone === 'dark' ? colors.white : tone === 'alert' ? colors.hotpink : colors.maroon;
  return (
    <View style={[styles.tag, tone === 'dark' ? styles.tagDark : tone === 'alert' ? styles.tagAlert : styles.tagLight, style]}>
      {Icon ? <Icon size={13} color={fg} strokeWidth={2.4} /> : null}
      <Text variant="tag" style={{ color: fg }} numberOfLines={1}>
        {children}
      </Text>
    </View>
  );
}

/** − n + stepper on a sand pill. "−" at the minimum calls onRemoveAtMin (cart: ask to remove). */
export function Stepper({
  value,
  onChange,
  min = 1,
  max = 20,
  size = 'md',
  onRemoveAtMin,
  label = 'Quantity',
}: {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  size?: 'md' | 'lg';
  onRemoveAtMin?: () => void;
  label?: string;
}) {
  const d = size === 'lg' ? 38 : 32;
  const icon = size === 'lg' ? 20 : 17;
  const decDisabled = value <= min && !onRemoveAtMin;
  const incDisabled = value >= max;
  const dec = () => (value <= min ? onRemoveAtMin?.() : onChange(value - 1));
  return (
    <View style={styles.stepper} accessibilityLabel={`${label} ${value}`}>
      <Pressable
        onPress={dec}
        disabled={decDisabled}
        accessibilityRole="button"
        accessibilityLabel="Decrease quantity"
        accessibilityState={{ disabled: decDisabled }}
        hitSlop={4}
        style={({ pressed }) => [styles.stepBtn, { width: d, height: d }, decDisabled && styles.dim, pressed && styles.stepPressed]}
      >
        <Minus size={icon} color={colors.maroon} strokeWidth={2} />
      </Pressable>
      <Text weight={700} style={[styles.stepValue, size === 'lg' ? styles.stepValueLg : null]} accessibilityLiveRegion="polite">
        {value}
      </Text>
      <Pressable
        onPress={() => !incDisabled && onChange(Math.min(max, value + 1))}
        disabled={incDisabled}
        accessibilityRole="button"
        accessibilityLabel="Increase quantity"
        accessibilityState={{ disabled: incDisabled }}
        hitSlop={4}
        style={({ pressed }) => [styles.stepBtn, { width: d, height: d }, incDisabled && styles.dim, pressed && styles.stepPressed]}
      >
        <Plus size={icon} color={colors.maroon} strokeWidth={2} />
      </Pressable>
    </View>
  );
}

/** Switch (46 × 26): maroon on, sand off; the knob slides on the UI thread. */
export function Toggle({
  value,
  onChange,
  label,
  disabled,
}: {
  value: boolean;
  onChange: (value: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  const x = useSharedValue(value ? 22 : 2);
  useEffect(() => {
    x.set(withTiming(value ? 22 : 2, { duration: 200 }));
  }, [value, x]);
  const knob = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() }] }));
  return (
    <Pressable
      onPress={() => onChange(!value)}
      disabled={disabled}
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value, disabled }}
      hitSlop={10}
      style={[styles.toggle, { backgroundColor: value ? colors.maroon : colors.sand }, disabled && styles.dim]}
    >
      <Animated.View style={[styles.knob, knob]} />
    </Pressable>
  );
}

/** Radio indicator (the parent card is the pressable radio). */
export function RadioDot({ checked }: { checked: boolean }) {
  return (
    <View style={[styles.radio, { borderColor: checked ? colors.maroon : '#D9C1B5' }]}>
      {checked ? <View style={styles.radioDot} /> : null}
    </View>
  );
}

/** Round maroon check (password rules, success marks); faded when unmet. */
export function CheckCircle({ checked = true, size = 22 }: { checked?: boolean; size?: number }) {
  return (
    <View style={[styles.check, { width: size, height: size, borderRadius: size / 2, opacity: checked ? 1 : 0.3 }]}>
      <Check size={size * 0.62} color={colors.white} strokeWidth={3} />
    </View>
  );
}

/** Thin progress bar (maroon on sand); width animates on the UI thread. */
export function ProgressBar({ value, label }: { value: number; label?: string }) {
  const w = useSharedValue(value);
  useEffect(() => {
    w.set(withTiming(value, { duration: motion.slow }));
  }, [value, w]);
  const fill = useAnimatedStyle(() => ({ width: `${Math.max(0, Math.min(100, w.get()))}%` }));
  return (
    <View
      style={styles.progress}
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(value) }}
    >
      <Animated.View style={[styles.progressFill, fill]} />
    </View>
  );
}

/** Horizontal rule with a centred caption ("or", "Did not get the code on WhatsApp?"). */
export function TextDivider({ children, style }: { children: string; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.divider, style]}>
      <View style={styles.dividerLine} />
      <Text variant="small" color="muted">
        {children}
      </Text>
      <View style={styles.dividerLine} />
    </View>
  );
}

const styles = StyleSheet.create({
  segTrack: { flexDirection: 'row', backgroundColor: colors.sand, borderRadius: radii.md, padding: 4 },
  segItem: { flex: 1, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  segActive: { backgroundColor: colors.maroon, boxShadow: '0 1px 2px rgba(73,17,33,0.2)' },
  segText: { fontSize: 15, lineHeight: 20 },
  chip: {
    height: sizes.chip,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  chipOn: { backgroundColor: colors.maroon, borderColor: colors.maroon },
  chipOff: { backgroundColor: colors.white, borderColor: colors.line },
  chipRow: { marginHorizontal: -20, flexGrow: 0 },
  chipRowContent: { paddingHorizontal: 20, paddingVertical: 2, gap: 10 },
  tag: {
    height: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    borderRadius: radii.pill,
    // No alignSelf: the row a tag sits in decides its vertical position (e.g. centred pills).
  },
  tagLight: { backgroundColor: colors.sand },
  tagDark: { backgroundColor: colors.maroon },
  tagAlert: { backgroundColor: 'rgba(237,59,92,0.1)' },
  stepper: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.sand, borderRadius: radii.pill, padding: 4 },
  stepBtn: { borderRadius: 999, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  stepPressed: { transform: [{ scale: 0.9 }] },
  stepValue: { minWidth: 32, textAlign: 'center', fontSize: 16, lineHeight: 22, fontVariant: ['tabular-nums'] },
  stepValueLg: { minWidth: 30, fontSize: 17 },
  dim: { opacity: 0.5 },
  toggle: { width: sizes.toggleW, height: sizes.toggleH, borderRadius: radii.pill, justifyContent: 'center' },
  knob: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.white, boxShadow: '0 1px 3px rgba(73,17,33,0.25)' },
  radio: {
    width: sizes.radio,
    height: sizes.radio,
    borderRadius: 11,
    borderWidth: 1.5,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.maroon },
  check: { backgroundColor: colors.maroon, alignItems: 'center', justifyContent: 'center' },
  progress: { height: 4, borderRadius: radii.pill, backgroundColor: colors.sand, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: radii.pill, backgroundColor: colors.maroon },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dividerLine: { flex: 1, height: StyleSheet.hairlineWidth * 2, backgroundColor: colors.divider },
});
