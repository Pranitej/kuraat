import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import Animated, { interpolateColor, useAnimatedStyle } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { promoBannerPhoto } from '@/assets/images';
import { useScreenScrollY } from '@/components/layout';
import { Bell, ChevronRight, ListFilter, Mail, MapPin, Phone, Search, ShoppingBag, Store, X } from '@/components/icons';
import { Avatar, BottomSheet, Button, Chip, IconButton, Logo, MaroonPanel, Tag, Text } from '@/components/ui';
import { ROUTES } from '@/config/routes.js';
import { HEAD_OFFICE, SORT_OPTIONS, formatDistance, mapsUrl, telUrl } from '@/domain';
import { useOpenUrl } from '@/lib/linking';
import { FONT_FAMILY, MAX_FONT_SCALE, colors, layout, radii, shadows } from '@/theme/theme';
import type { Branch, User } from '@/types/api';

/** Counter on the cart button (white on maroon with a cream ring). */
export function CountBadge({ count }: { count: number }) {
  if (!count) return null;
  return (
    <View style={styles.count} pointerEvents="none">
      <Text weight={700} color="white" style={styles.countText}>
        {count > 99 ? '99+' : count}
      </Text>
    </View>
  );
}

/** Unread dot on the bell. */
export function UnreadDot({ show }: { show: boolean }) {
  return show ? <View style={styles.unread} pointerEvents="none" /> : null;
}

/** Home header: bell · logo · avatar; pinned, with a hairline once the page scrolls. */
export function HomeHeader({ user, unread }: { user: User | null; unread: number }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scrollY = useScreenScrollY();
  const line = useAnimatedStyle(() => ({
    borderBottomColor: interpolateColor(scrollY ? Math.min(scrollY.get(), 8) : 0, [0, 8], ['rgba(238,225,216,0)', colors.lineSubtle]),
  }));
  return (
    <Animated.View style={[styles.header, { paddingTop: insets.top + layout.headerTop }, line]}>
      <View style={styles.headerRow}>
        <IconButton
          icon={Bell}
          label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
          onPress={() => router.push(ROUTES.notifications)}
          badge={<UnreadDot show={unread > 0} />}
        />
        <Logo width={116} />
        <Pressable onPress={() => router.push(ROUTES.profile)} accessibilityRole="button" accessibilityLabel="Profile" hitSlop={4}>
          <Avatar name={user?.name} src={user?.avatar} size={44} />
        </Pressable>
      </View>
    </Animated.View>
  );
}

/** Search pill with the maroon filter button (pink dot when a sort is active). */
export function SearchBar({
  value,
  onChange,
  onOpenFilters,
  filtersActive,
}: {
  value: string;
  onChange: (v: string) => void;
  onOpenFilters: () => void;
  filtersActive: boolean;
}) {
  return (
    <View style={styles.search}>
      <Search size={20} color={colors.maroon} strokeWidth={1.8} />
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder="Search truffles, cakes, pastries"
        placeholderTextColor={colors.placeholder}
        accessibilityLabel="Search products"
        returnKeyType="search"
        autoCorrect={false}
        maxFontSizeMultiplier={MAX_FONT_SCALE}
        selectionColor={colors.maroon}
        style={styles.searchInput}
      />
      {value ? <IconButton icon={X} label="Clear search" variant="plain" size="sm" iconSize={18} onPress={() => onChange('')} /> : null}
      <IconButton
        icon={ListFilter}
        label="Sort and filter"
        variant="maroon"
        size="md"
        iconSize={19}
        onPress={onOpenFilters}
        badge={filtersActive ? <View style={styles.filterDot} pointerEvents="none" /> : null}
      />
    </View>
  );
}

type Chip = { id: string; label: string };

/** Sort + category sheet from the filter button (derived from the chip styling). */
export function FilterSheet({
  open,
  onClose,
  categories,
  category,
  sort,
  onApply,
}: {
  open: boolean;
  onClose: () => void;
  categories: Chip[];
  category: string;
  sort: string;
  onApply: (f: { category: string; sort: string }) => void;
}) {
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="Sort & filter"
      footer={
        <View style={styles.sheetActions}>
          <Button variant="secondary" style={styles.flex} block onPress={() => onApply({ category: 'all', sort: 'recommended' })}>
            Reset
          </Button>
          <Button style={styles.flex} block onPress={onClose}>
            Show results
          </Button>
        </View>
      }
    >
      <Text variant="label" color="maroon" style={styles.sheetLabel}>
        Sort by
      </Text>
      <View style={styles.wrap}>
        {SORT_OPTIONS.map((o: Chip) => (
          <Chip key={o.id} active={sort === o.id} onPress={() => onApply({ category, sort: o.id })}>
            {o.label}
          </Chip>
        ))}
      </View>
      <Text variant="label" color="maroon" style={[styles.sheetLabel, styles.sheetGap]}>
        Category
      </Text>
      <View style={[styles.wrap, styles.sheetEnd]}>
        {categories.map((c) => (
          <Chip key={c.id} active={category === c.id} onPress={() => onApply({ category: c.id, sort })}>
            {c.label}
          </Chip>
        ))}
      </View>
    </BottomSheet>
  );
}

/** "Nearest branch to Al Rakah, Al Khobar · Kuraat · Al Khobar Corniche · 2.4 km" */
export function NearestBranchStrip({ delivery }: { delivery: { branch: Branch; distanceKm?: number | null; area: string } | null }) {
  const router = useRouter();
  if (!delivery) return null;
  return (
    <Pressable
      onPress={() => router.push(ROUTES.branch(delivery.branch.id))}
      accessibilityRole="button"
      accessibilityLabel={`Nearest branch to ${delivery.area}: ${delivery.branch.displayName}, ${formatDistance(delivery.distanceKm)}`}
      style={({ pressed }) => [styles.strip, pressed && styles.stripPressed]}
    >
      <View style={styles.stripIcon}>
        <Store size={20} color={colors.maroon} strokeWidth={1.8} />
      </View>
      <View style={styles.flex}>
        <Text variant="label" weight={400} color="muted" numberOfLines={1}>
          Nearest branch to {delivery.area}
        </Text>
        <Text weight={700} numberOfLines={1} style={styles.stripName}>
          {delivery.branch.displayName}
        </Text>
      </View>
      <Tag tone="dark">{formatDistance(delivery.distanceKm)}</Tag>
    </Pressable>
  );
}

/** "NEW COLLECTION · Made fresh for every gathering · Shop now" banner. */
export function PromoBanner({ onShop }: { onShop: () => void }) {
  return (
    <MaroonPanel style={styles.banner}>
      <View style={styles.flex}>
        <Text variant="overline" color="white80">
          NEW COLLECTION
        </Text>
        <Text weight={700} color="white" style={styles.bannerTitle}>
          Made fresh for every gathering
        </Text>
        <Button variant="white" size="sm" rightIcon={ChevronRight} onPress={onShop} style={styles.shopNow}>
          Shop now
        </Button>
      </View>
      <View style={styles.bannerPhoto}>
        <Image source={promoBannerPhoto} style={StyleSheet.absoluteFill} contentFit="cover" accessible={false} />
      </View>
    </MaroonPanel>
  );
}

/** Maroon "Contact us" footer (PDF screen 08). */
export function ContactSection() {
  const openUrl = useOpenUrl();
  const insets = useSafeAreaInsets();
  const rows = [
    { icon: MapPin, label: 'Head office', value: HEAD_OFFICE.address, url: mapsUrl(HEAD_OFFICE.location, 'kuraat head office') },
    { icon: Phone, label: `Support · ${HEAD_OFFICE.supportHours}`, value: HEAD_OFFICE.supportPhone, url: telUrl(HEAD_OFFICE.supportPhone) },
    { icon: Mail, label: 'Email', value: HEAD_OFFICE.email, url: `mailto:${HEAD_OFFICE.email}` },
  ];
  return (
    <MaroonPanel fade="edges" style={styles.contact}>
      <View style={[styles.contactInner, { paddingBottom: 112 + insets.bottom }]}>
        <Text variant="heading" color="white" accessibilityRole="header">
          Contact us
        </Text>
        <View style={styles.contactRows}>
          {rows.map((r) => (
            <Pressable
              key={r.label}
              onPress={() => openUrl(r.url)}
              accessibilityRole="link"
              accessibilityLabel={`${r.label}: ${r.value}`}
              style={styles.contactRow}
            >
              <View style={styles.contactIcon}>
                <r.icon size={20} color={colors.white} strokeWidth={1.8} />
              </View>
              <View style={styles.flex}>
                <Text variant="label" weight={400} color="white75">
                  {r.label}
                </Text>
                <Text weight={700} color="white" style={styles.contactValue}>
                  {r.value}
                </Text>
              </View>
            </Pressable>
          ))}
        </View>
      </View>
    </MaroonPanel>
  );
}

/** Floating cart button with the item count. */
export function CartFab({ count }: { count: number }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  return (
    <Pressable
      onPress={() => router.push(ROUTES.cart)}
      accessibilityRole="button"
      accessibilityLabel={`Cart, ${count} items`}
      style={({ pressed }) => [styles.fab, { bottom: Math.max(24, insets.bottom + 8) }, pressed && styles.fabPressed]}
    >
      <ShoppingBag size={26} color={colors.white} strokeWidth={1.8} />
      <CountBadge count={count} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  count: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 24,
    height: 24,
    paddingHorizontal: 4,
    borderRadius: 12,
    borderWidth: 3,
    borderColor: colors.cream,
    backgroundColor: colors.maroon,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countText: { fontSize: 11, lineHeight: 14 },
  unread: {
    position: 'absolute',
    top: 9,
    right: 9,
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: colors.white,
    backgroundColor: colors.maroon,
  },
  header: { backgroundColor: colors.cream, borderBottomWidth: 1, zIndex: 2 },
  headerRow: {
    height: 76,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  search: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingLeft: 16,
    paddingRight: 6,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  searchInput: { flex: 1, height: '100%', paddingVertical: 0, fontSize: 15, fontFamily: FONT_FAMILY[400], color: colors.ink },
  filterDot: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: colors.white,
    backgroundColor: colors.pink,
  },
  sheetActions: { flexDirection: 'row', gap: 12 },
  sheetLabel: { marginTop: 8 },
  sheetGap: { marginTop: 24 },
  sheetEnd: { paddingBottom: 8 },
  wrap: { marginTop: 10, flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  strip: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: radii.lg,
    backgroundColor: colors.sand,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  stripPressed: { backgroundColor: '#EFD5C7' },
  stripIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  stripName: { fontSize: 15, lineHeight: 20 },
  banner: {
    minHeight: 132,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: radii['2xl'],
    paddingVertical: 16,
    paddingLeft: 20,
    paddingRight: 16,
  },
  bannerTitle: { marginTop: 4, fontSize: 22, lineHeight: 27 },
  shopNow: { marginTop: 12 },
  bannerPhoto: { width: 108, height: 108, borderRadius: 54, borderWidth: 3, borderColor: 'rgba(251,245,239,0.9)', overflow: 'hidden' },
  contact: { marginTop: 40, borderTopLeftRadius: radii.sheet, borderTopRightRadius: radii.sheet },
  contactInner: { width: '100%', maxWidth: layout.maxWidth, alignSelf: 'center', paddingHorizontal: 24, paddingTop: 32 },
  contactRows: { marginTop: 20, gap: 16 },
  contactRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  contactIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.glass, alignItems: 'center', justifyContent: 'center' },
  contactValue: { fontSize: 15, lineHeight: 20 },
  fab: {
    position: 'absolute',
    right: 20,
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.maroon,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.fab,
  },
  fabPressed: { backgroundColor: colors.maroonDark, transform: [{ scale: 0.95 }] },
});
