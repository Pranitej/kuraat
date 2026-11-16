import { StyleSheet, View, useWindowDimensions, type StyleProp, type ViewStyle } from 'react-native';
import type { LucideIcon } from '@/components/icons';
import { colors } from '@/theme/theme';
import { Button } from './Button';
import { Text } from './Text';

/** Scattered sand dots around the ring (as % of the 306 × 276 frame, PDF screen 21). */
const DOTS: { w: number; left?: number; right?: number; top?: number; bottom?: number }[] = [
  { w: 9.8, left: 6.5, top: 0.7 },
  { w: 6.5, right: 11.8, top: 18.8 },
  { w: 4.2, left: 2.6, top: 62.3 },
  { w: 11.1, right: 0, top: 75.4 },
  { w: 5.6, left: 20.9, bottom: 0 },
];

/** Empty-state illustration: sand ring + white disc + maroon line icon + sand dots. */
export function EmptyIllustration({ icon: Icon, maxWidth = 306 }: { icon: LucideIcon; maxWidth?: number }) {
  const { width: screen } = useWindowDimensions();
  const width = Math.min(maxWidth, screen - 48);
  const ring = width * 0.739;
  const disc = ring * 0.69;
  const pct = (n?: number) => (n == null ? undefined : (n / 100) * width);
  return (
    <View style={{ width, height: (width * 276) / 306 }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {DOTS.map((d, i) => {
        const size = pct(d.w) as number;
        return (
          <View
            key={i}
            style={[
              styles.dot,
              {
                width: size,
                height: size,
                borderRadius: size / 2,
                left: pct(d.left),
                right: pct(d.right),
                top: d.top != null ? (d.top / 100) * ((width * 276) / 306) : undefined,
                bottom: d.bottom != null ? 0 : undefined,
              },
            ]}
          />
        );
      })}
      <View
        style={[styles.ring, { width: ring, height: ring, borderRadius: ring / 2, left: width * 0.131, top: ((width * 276) / 306) * 0.08 }]}
      >
        <View style={[styles.disc, { width: disc, height: disc, borderRadius: disc / 2 }]}>
          <Icon size={disc * 0.4} color={colors.maroon} strokeWidth={1.6} />
        </View>
      </View>
    </View>
  );
}

type Props = {
  icon?: LucideIcon;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
};

/** Empty state (PDF screen 21): illustration, h1 title, muted text, 248 pt primary button. */
export function EmptyState({ icon, title, message, actionLabel, onAction, compact, style }: Props) {
  return (
    <View style={[styles.wrap, { paddingVertical: compact ? 24 : 40 }, style]}>
      {icon ? <EmptyIllustration icon={icon} maxWidth={compact ? 230 : 306} /> : null}
      <Text variant="h1" align="center" accessibilityRole="header" style={styles.title}>
        {title}
      </Text>
      {message ? (
        <Text color="muted" align="center" style={styles.message}>
          {message}
        </Text>
      ) : null}
      {actionLabel ? (
        <Button onPress={onAction} block style={styles.action}>
          {actionLabel}
        </Button>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', paddingHorizontal: 24 },
  dot: { position: 'absolute', backgroundColor: colors.sand },
  ring: { position: 'absolute', backgroundColor: colors.sand, alignItems: 'center', justifyContent: 'center' },
  disc: { backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  title: { marginTop: 8 },
  message: { marginTop: 8, maxWidth: 340 },
  action: { marginTop: 28, width: '100%', maxWidth: 248, alignSelf: 'center' },
});
