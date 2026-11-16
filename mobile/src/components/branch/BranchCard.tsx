import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { Clock, Navigation, Phone, Store } from '@/components/icons';
import { Button, Tag, Text } from '@/components/ui';
import { ROUTES } from '@/config/routes.js';
import { directionsUrl, formatDistance, formatHours, telUrl } from '@/domain';
import { useOpenUrl } from '@/lib/linking';
import { colors, radii, shadows } from '@/theme/theme';
import type { Branch } from '@/types/api';

/** "Open · 10 AM – 12 AM · 2.4 km" (open/closed from the server, in Saudi time). */
export function OpenLine({ branch, distanceKm, showDistance }: { branch: Branch; distanceKm?: number | null; showDistance?: boolean }) {
  return (
    <View style={styles.openLine}>
      <Clock size={16} color={colors.ink} strokeWidth={1.8} />
      <Text variant="small" weight={600}>
        {branch.openNow ? 'Open' : 'Closed'} · {formatHours(branch.hours)}
      </Text>
      {showDistance && distanceKm != null ? (
        <Text variant="small" color="muted">
          · {formatDistance(distanceKm)}
        </Text>
      ) : null}
    </View>
  );
}

/** Home carousel card (PDF screen 08). */
export function BranchTeaserCard({ branch, distanceKm }: { branch: Branch; distanceKm?: number | null }) {
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.push(ROUTES.branch(branch.id))}
      accessibilityRole="button"
      accessibilityLabel={`${branch.name} branch${distanceKm != null ? `, ${formatDistance(distanceKm)}` : ''}`}
      style={({ pressed }) => [styles.teaser, pressed && shadows.float]}
    >
      <View style={styles.teaserTop}>
        <Tag icon={Store}>Branch</Tag>
        {distanceKm != null ? (
          <Text variant="small" weight={700}>
            {formatDistance(distanceKm)}
          </Text>
        ) : null}
      </View>
      <Text weight={700} numberOfLines={1} style={styles.name}>
        {branch.name}
      </Text>
      <Text variant="small" color="muted" numberOfLines={2} style={styles.address}>
        {branch.address}
      </Text>
      <View style={styles.teaserOpen}>
        <OpenLine branch={branch} />
      </View>
    </Pressable>
  );
}

/** Branch directory card (PDF screen 25): name, nearest tag, address, hours, Call + Directions. */
export function BranchListCard({
  branch,
  distanceKm,
  nearest,
  highlighted,
}: {
  branch: Branch;
  distanceKm?: number | null;
  nearest?: boolean;
  highlighted?: boolean;
}) {
  const openUrl = useOpenUrl();
  return (
    <View style={[styles.list, highlighted ? [styles.highlighted, shadows.ring] : null]}>
      <View style={styles.listTop}>
        <Text weight={700} style={[styles.listName, styles.flex]}>
          {branch.name}
        </Text>
        {nearest ? <Tag tone="dark">Nearest to you</Tag> : null}
      </View>
      <Text variant="small" color="muted" style={styles.listAddress}>
        {branch.address}
      </Text>
      <View style={styles.listOpen}>
        <OpenLine branch={branch} distanceKm={distanceKm} showDistance />
      </View>
      <View style={styles.actions}>
        <Button
          variant="secondary"
          size="md"
          leftIcon={Phone}
          block
          onPress={() => openUrl(telUrl(branch.phone))}
          accessibilityLabel={`Call ${branch.name}, ${branch.phone}`}
          style={styles.flex}
        >
          Call
        </Button>
        <Button size="md" leftIcon={Navigation} block onPress={() => openUrl(directionsUrl(branch.location))} style={styles.flex}>
          Directions
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  openLine: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  teaser: {
    width: 254,
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.lineSubtle,
    padding: 16,
  },
  teaserTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  name: { marginTop: 12, fontSize: 17, lineHeight: 24 },
  listName: { fontSize: 17, lineHeight: 24 },
  address: { marginTop: 2, minHeight: 40 },
  teaserOpen: { marginTop: 12 },
  list: { backgroundColor: colors.surface, borderRadius: radii.xl, borderWidth: 1, borderColor: colors.lineSubtle, padding: 16 },
  highlighted: { borderColor: colors.maroon },
  listTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  listAddress: { marginTop: 4 },
  listOpen: { marginTop: 10 },
  actions: { marginTop: 16, flexDirection: 'row', gap: 12 },
  flex: { flex: 1 },
});
