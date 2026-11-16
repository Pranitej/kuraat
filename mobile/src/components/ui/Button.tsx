import type { LucideIcon } from '@/components/icons';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, radii, sizes } from '@/theme/theme';
import { Spinner } from './Spinner';
import { Text } from './Text';

export type ButtonVariant = 'primary' | 'secondary' | 'white' | 'glass' | 'ghost' | 'sand';
export type ButtonSize = 'lg' | 'md' | 'sm' | 'xs';

const SIZE: Record<
  ButtonSize,
  { height: number; paddingHorizontal: number; gap: number; font: 16 | 15 | 14; weight: 600 | 700; icon: number }
> = {
  lg: { height: sizes.button, paddingHorizontal: 24, gap: 10, font: 16, weight: 700, icon: 20 },
  md: { height: sizes['button-md'], paddingHorizontal: 20, gap: 8, font: 15, weight: 600, icon: 18 },
  sm: { height: sizes['button-sm'], paddingHorizontal: 20, gap: 8, font: 15, weight: 700, icon: 18 },
  xs: { height: sizes.chip, paddingHorizontal: 16, gap: 6, font: 14, weight: 600, icon: 16 },
};

const VARIANT: Record<ButtonVariant, { bg: string; pressed: string; text: string; border?: string }> = {
  primary: { bg: colors.maroon, pressed: colors.maroonDark, text: colors.white },
  secondary: { bg: 'transparent', pressed: 'rgba(120,18,50,0.08)', text: colors.maroon, border: colors.maroon },
  white: { bg: colors.white, pressed: colors.cream, text: colors.maroon },
  glass: { bg: 'rgba(255,255,255,0.06)', pressed: 'rgba(255,255,255,0.14)', text: colors.white, border: 'rgba(255,255,255,0.6)' },
  ghost: { bg: 'transparent', pressed: 'rgba(120,18,50,0.05)', text: colors.maroon },
  sand: { bg: colors.sand, pressed: '#EDD2C3', text: colors.maroon },
};

export type ButtonProps = {
  children: ReactNode;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Full width (the PDF's bottom-bar buttons). */
  block?: boolean;
  loading?: boolean;
  disabled?: boolean;
  leftIcon?: LucideIcon | ((p: { size: number; color: string }) => ReactNode);
  rightIcon?: LucideIcon;
  iconSize?: number;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/** Pill button (PDF: Primary 54 pt maroon, Secondary maroon outline). Spinner replaces the label while loading. */
export function Button({
  children,
  onPress,
  variant = 'primary',
  size = 'lg',
  block = false,
  loading = false,
  disabled = false,
  leftIcon: Left,
  rightIcon: Right,
  iconSize,
  accessibilityLabel,
  accessibilityHint,
  style,
  testID,
}: ButtonProps) {
  const s = SIZE[size];
  const v = VARIANT[variant];
  const icon = iconSize ?? s.icon;
  const inactive = disabled || loading;
  const label = typeof children === 'string' ? children : accessibilityLabel;
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive, busy: loading }}
      hitSlop={size === 'xs' ? 6 : undefined}
      style={({ pressed }) => [
        styles.base,
        { height: s.height, paddingHorizontal: s.paddingHorizontal, backgroundColor: pressed ? v.pressed : v.bg },
        v.border ? { borderWidth: 1, borderColor: v.border } : null,
        block && styles.block,
        disabled && !loading && styles.disabled,
        pressed && styles.pressed,
        style,
      ]}
    >
      <View style={[styles.row, { gap: s.gap }, loading && styles.hidden]}>
        {Left ? <Left size={icon} color={v.text} strokeWidth={1.9} /> : null}
        {typeof children === 'string' ? (
          <Text weight={s.weight} style={{ fontSize: s.font, lineHeight: 20, color: v.text }} numberOfLines={1}>
            {children}
          </Text>
        ) : (
          children
        )}
        {Right ? <Right size={icon} color={v.text} strokeWidth={2} /> : null}
      </View>
      {loading ? (
        <View style={styles.spinner}>
          <Spinner color={v.text} />
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { borderRadius: radii.pill, alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-start' },
  block: { alignSelf: 'stretch' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  hidden: { opacity: 0 },
  spinner: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.45 },
  pressed: { transform: [{ scale: 0.985 }] },
});
