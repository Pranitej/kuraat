import { FlashList } from '@shopify/flash-list';
import { useRouter, type Href } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Screen, ScreenHeader, useScreenScrollY } from '@/components/layout';
import { BellOff, CreditCard, Gift, Lock, Package, PackageX, Tag, Truck, type LucideIcon } from '@/components/icons';
import { EmptyState, Spinner, Text } from '@/components/ui';
import { ROUTES, notificationTarget } from '@/lib/routes';
import { useNotifications } from '@/context/NotificationContext';
import { formatNotificationTime, isSameDay } from '@/domain';
import { colors } from '@/theme/theme';
import type { AppNotification } from '@/types/api';

const ICONS: Record<string, LucideIcon> = {
  order: Package,
  payment: CreditCard,
  welcome: Gift,
  delivered: Truck,
  out_for_delivery: Truck,
  product: Tag,
  security: Lock,
  cancelled: PackageX,
};

type Row = { kind: 'section'; id: string; label: string } | { kind: 'item'; id: string; item: AppNotification };

/** 26 · Notifications */
export default function NotificationsScreen() {
  const { items, unreadCount, markAllRead } = useNotifications();
  const [marking, setMarking] = useState(false);

  const rows = useMemo<Row[]>(() => {
    const now = new Date();
    const today = items.filter((n) => isSameDay(n.createdAt, now));
    const earlier = items.filter((n) => !isSameDay(n.createdAt, now));
    const out: Row[] = [];
    if (today.length)
      out.push({ kind: 'section', id: 's-today', label: 'TODAY' }, ...today.map((n) => ({ kind: 'item' as const, id: n.id, item: n })));
    if (earlier.length)
      out.push(
        { kind: 'section', id: 's-earlier', label: 'EARLIER' },
        ...earlier.map((n) => ({ kind: 'item' as const, id: n.id, item: n })),
      );
    return out;
  }, [items]);

  const markAll = async () => {
    setMarking(true);
    try {
      await markAllRead();
    } finally {
      setMarking(false);
    }
  };

  return (
    <Screen
      scroll={false}
      header={
        <ScreenHeader
          title="Notifications"
          right={
            <Pressable
              onPress={markAll}
              disabled={!unreadCount || marking}
              accessibilityRole="button"
              accessibilityLabel="Mark all read"
              accessibilityState={{ disabled: !unreadCount || marking }}
              hitSlop={8}
              style={[styles.markAll, (!unreadCount || marking) && styles.dim]}
            >
              {marking ? (
                <Spinner size={16} />
              ) : (
                <Text variant="label" weight={700} color="maroon" align="right" style={styles.markAllText}>
                  Mark all read
                </Text>
              )}
            </Pressable>
          }
        />
      }
    >
      <NotificationList rows={rows} />
    </Screen>
  );
}

function NotificationList({ rows }: { rows: Row[] }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scrollY = useScreenScrollY();
  const { markRead } = useNotifications();

  const open = (n: AppNotification) => {
    if (!n.read) markRead(n.id);
    router.push(notificationTarget(n.link) as Href);
  };

  if (!rows.length) {
    return (
      <EmptyState
        icon={BellOff}
        title="You are all caught up"
        message="Order updates, offers and account messages will appear here."
        actionLabel="Back to home"
        onAction={() => router.replace(ROUTES.home)}
      />
    );
  }

  return (
    <FlashList
      data={rows}
      keyExtractor={(r) => r.id}
      getItemType={(r) => r.kind}
      onScroll={(e) => scrollY?.set(e.nativeEvent.contentOffset.y)}
      scrollEventThrottle={16}
      contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
      renderItem={({ item: row }) => {
        if (row.kind === 'section') {
          return (
            <Text variant="overline" color="muted" accessibilityRole="header" style={styles.section}>
              {row.label}
            </Text>
          );
        }
        const n = row.item;
        const Icon = ICONS[n.type] || Package;
        return (
          <Pressable
            onPress={() => open(n)}
            accessibilityRole="button"
            accessibilityLabel={`${n.read ? '' : 'Unread. '}${n.title}. ${n.body}. ${formatNotificationTime(n.createdAt)}`}
            style={({ pressed }) => [
              styles.row,
              { backgroundColor: n.read ? 'transparent' : colors.sandSoft },
              pressed && styles.rowPressed,
            ]}
          >
            <View style={styles.icon}>
              <Icon size={19} color={colors.maroon} strokeWidth={1.8} />
            </View>
            <View style={styles.flex}>
              <Text weight={700} style={styles.title}>
                {n.title}
              </Text>
              <Text variant="small" color="muted" style={styles.body}>
                {n.body}
              </Text>
              <Text variant="caption" color="muted" style={styles.time}>
                {formatNotificationTime(n.createdAt)}
              </Text>
            </View>
            {!n.read ? <View style={styles.dot} /> : null}
          </Pressable>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  markAll: { width: 56, alignItems: 'flex-end' },
  markAllText: { lineHeight: 16 },
  dim: { opacity: 0.4 },
  section: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, paddingHorizontal: 20, paddingVertical: 16 },
  rowPressed: { backgroundColor: 'rgba(243,221,208,0.6)' },
  icon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.sand, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1, minWidth: 0 },
  title: { fontSize: 15, lineHeight: 20 },
  body: { marginTop: 2 },
  time: { marginTop: 4 },
  dot: { marginTop: 8, width: 8, height: 8, borderRadius: 4, backgroundColor: colors.maroon },
});
