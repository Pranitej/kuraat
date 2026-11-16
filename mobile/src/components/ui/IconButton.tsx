import type { LucideIcon } from '@/components/icons';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { colors, shadows } from '@/theme/theme';

export type IconButtonVariant = 'surface' | 'glass' | 'overlay' | 'maroon' | 'viewer' | 'sand' | 'plain';
const SIZE = { xs: 32, sm: 36, md: 40, lg: 44, xl: 64 } as const;

const VARIANT: Record<IconButtonVariant, { bg: string; pressed: string; fg: string; border?: string; float?: boolean }> = {
  surface: { bg: colors.white, pressed: colors.cream, fg: colors.maroon, border: colors.lineSubtle },
  glass: { bg: 'rgba(255,255,255,0.14)', pressed: 'rgba(255,255,255,0.22)', fg: colors.white, border: 'rgba(255,255,255,0.4)' },
  overlay: { bg: 'rgba(255,255,255,0.9)', pressed: colors.white, fg: colors.maroon, float: true },
  maroon: { bg: colors.maroon, pressed: colors.maroonDark, fg: colors.white },
  viewer: { bg: 'rgba(255,255,255,0.12)', pressed: 'rgba(255,255,255,0.2)', fg: colors.white, border: 'rgba(255,255,255,0.25)' },
  sand: { bg: colors.sand, pressed: '#EDD2C3', fg: colors.maroon },
  plain: { bg: 'transparent', pressed: 'rgba(120,18,50,0.06)', fg: colors.maroon },
};

type Props = {
  icon?: LucideIcon;
  /** Spoken name (required: the button has no visible text). */
  label: string;
  onPress?: () => void;
  variant?: IconButtonVariant;
  size?: keyof typeof SIZE;
  iconSize?: number;
  strokeWidth?: number;
  /** Fill colour for an icon drawn filled (e.g. a hearted product). */
  fill?: string;
  badge?: ReactNode;
  children?: ReactNode;
  disabled?: boolean;
  selected?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/** Circular icon button (44 pt in the PDF). */
export function IconButton({
  icon: Icon,
  label,
  onPress,
  variant = 'surface',
  size = 'lg',
  iconSize = 20,
  strokeWidth = 1.8,
  fill,
  badge,
  children,
  disabled,
  selected,
  style,
  testID,
}: Props) {
  const v = VARIANT[variant];
  const d = SIZE[size];
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled, selected }}
      hitSlop={d < 44 ? (44 - d) / 2 : undefined}
      style={({ pressed }) => [
        styles.base,
        { width: d, height: d, backgroundColor: pressed ? v.pressed : v.bg },
        v.border ? { borderWidth: 1, borderColor: v.border } : null,
        v.float ? shadows.float : null,
        disabled && styles.disabled,
        pressed && styles.pressed,
        style,
      ]}
    >
      {Icon ? <Icon size={iconSize} color={v.fg} strokeWidth={strokeWidth} fill={fill ?? 'none'} /> : children}
      {badge}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.45 },
  pressed: { transform: [{ scale: 0.95 }] },
});
