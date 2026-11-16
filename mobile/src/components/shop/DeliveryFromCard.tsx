import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Store, Truck } from '@/components/icons';
import { Tag, Text } from '@/components/ui';
import { formatDistance } from '@/domain';
import { colors, radii } from '@/theme/theme';
import type { Branch } from '@/types/api';

type Props = {
  branch: Pick<Branch, 'displayName'> | null | undefined;
  distanceKm?: number | null;
  meta?: string | null;
  icon?: 'truck' | 'store';
  label?: string;
  showDistance?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
};

/**
 * "Will be delivered from <branch>" sand card — repeated across product, cart, delivery and orders
 * (a core idea of the product, DESIGN_SYSTEM §H.8).
 */
export function DeliveryFromCard({
  branch,
  distanceKm,
  meta,
  icon = 'truck',
  label = 'Will be delivered from',
  showDistance = false,
  onPress,
  style,
}: Props) {
  if (!branch) return null;
  const Icon = icon === 'store' ? Store : Truck;
  const content = (
    <>
      <View style={styles.icon}>
        <Icon size={21} color={colors.maroon} strokeWidth={1.8} />
      </View>
      <View style={styles.flex}>
        <Text variant="label" weight={400} color="muted">
          {label}
        </Text>
        <Text weight={700} numberOfLines={1} style={styles.name}>
          {branch.displayName}
        </Text>
        {meta ? (
          <Text variant="small" color="muted" style={styles.meta}>
            {meta}
          </Text>
        ) : null}
      </View>
      {showDistance && distanceKm != null ? <Tag tone="dark">{formatDistance(distanceKm)}</Tag> : null}
    </>
  );
  const a11y = `${label} ${branch.displayName}${meta ? `. ${meta}` : ''}`;
  if (!onPress) {
    return (
      <View style={[styles.card, style]} accessible accessibilityLabel={a11y}>
        {content}
      </View>
    );
  }
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      style={({ pressed }) => [styles.card, pressed && styles.pressed, style]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: radii.lg,
    backgroundColor: colors.sand,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  pressed: { backgroundColor: '#EFD5C7' },
  icon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1, minWidth: 0 },
  name: { fontSize: 16, lineHeight: 22 },
  meta: { marginTop: 2 },
});
