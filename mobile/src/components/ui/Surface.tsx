import { useEffect, type ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import type { LucideIcon } from '@/components/icons';
import { colors, radii } from '@/theme/theme';
import { Text } from './Text';

type CardProps = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Makes the whole card pressable (list rows that open a screen). */
  onPress?: () => void;
  accessibilityLabel?: string;
  selected?: boolean;
};

/** Flat white card: 1 pt warm border, r-xl 20, no shadow (brand rule §H.7). */
export function Card({ children, style, onPress, accessibilityLabel, selected }: CardProps) {
  if (!onPress) return <View style={[styles.card, style]}>{children}</View>;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected }}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed, style]}
    >
      {children}
    </Pressable>
  );
}

/** Sand info banner with a leading maroon icon. */
export function InfoBanner({ icon: Icon, children, style }: { icon?: LucideIcon; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.banner, style]}>
      {Icon ? <Icon size={20} color={colors.maroon} strokeWidth={1.8} style={styles.bannerIcon} /> : null}
      <View style={styles.flex}>
        {typeof children === 'string' ? (
          <Text color="copy" style={styles.bannerText}>
            {children}
          </Text>
        ) : (
          children
        )}
      </View>
    </View>
  );
}

/** Icon in a sand (or white / glass) circle or rounded tile. */
export function IconTile({
  icon: Icon,
  size = 44,
  iconSize = 20,
  tone = 'sand',
  shape = 'circle',
}: {
  icon: LucideIcon;
  size?: number;
  iconSize?: number;
  tone?: 'sand' | 'white' | 'glass';
  shape?: 'circle' | 'rounded';
}) {
  const bg = tone === 'sand' ? colors.sand : tone === 'white' ? colors.white : 'rgba(255,255,255,0.16)';
  return (
    <View
      style={[styles.tile, { width: size, height: size, backgroundColor: bg, borderRadius: shape === 'circle' ? size / 2 : radii.sm }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Icon size={iconSize} color={tone === 'glass' ? colors.white : colors.maroon} strokeWidth={1.8} />
    </View>
  );
}

/** Summary row: label (muted) ↔ value (ink); `strong` for the total. */
export function SummaryRow({
  label,
  value,
  strong,
  style,
}: {
  label: string;
  value: ReactNode;
  strong?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.summary, style]}>
      <Text variant={strong ? 'body-lg' : 'body'} weight={strong ? 700 : undefined} color={strong ? 'ink' : 'muted'}>
        {label}
      </Text>
      {typeof value === 'string' ? (
        <Text weight={strong ? 700 : 600} style={[styles.tabular, { fontSize: strong ? 16 : 15 }]}>
          {value}
        </Text>
      ) : (
        value
      )}
    </View>
  );
}

/** Section title (20/700) with an optional action on the right ("See all"). */
export function SectionTitle({ children, action, style }: { children: string; action?: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.section, style]}>
      <Text variant="heading" accessibilityRole="header">
        {children}
      </Text>
      {action}
    </View>
  );
}

/** Loading placeholder: sand block that gently pulses (UI thread). */
export function Skeleton({ style }: { style?: StyleProp<ViewStyle> }) {
  const o = useSharedValue(1);
  useEffect(() => {
    o.set(withRepeat(withTiming(0.55, { duration: 700 }), -1, true));
  }, [o]);
  const pulse = useAnimatedStyle(() => ({ opacity: o.get() }));
  return <Animated.View style={[styles.skeleton, pulse, style]} accessibilityElementsHidden />;
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.lineSubtle, borderRadius: radii.xl },
  cardPressed: { borderColor: colors.line, opacity: 0.96 },
  banner: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: colors.sand,
    borderRadius: radii.lg,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  bannerIcon: { marginTop: 1 },
  bannerText: { fontSize: 15, lineHeight: 22 },
  flex: { flex: 1, minWidth: 0 },
  tile: { alignItems: 'center', justifyContent: 'center' },
  summary: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 16 },
  tabular: { fontVariant: ['tabular-nums'], textAlign: 'right' },
  section: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16 },
  skeleton: { backgroundColor: colors.sand, borderRadius: radii.md },
});
