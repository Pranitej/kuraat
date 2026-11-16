import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { OrderCard } from '@/components/account/OrderParts';
import { Screen, ScreenHeader, useScreenScrollY } from '@/components/layout';
import { Package } from '@/components/icons';
import { Chip, EmptyState, Skeleton } from '@/components/ui';
import { ROUTES } from '@/config/routes.js';
import { useOrders } from '@/context/OrderContext';
import { orderStatusView } from '@/domain';
import { colors, radii } from '@/theme/theme';
import type { Order } from '@/types/api';

type Filter = 'all' | 'ongoing' | 'delivered';
const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'ongoing', label: 'Ongoing' },
  { id: 'delivered', label: 'Delivered' },
];

/** 20 · My orders  ·  21 · My orders (empty) */
export default function OrdersScreen() {
  const router = useRouter();
  const { orders, now, loaded } = useOrders();
  const [filter, setFilter] = useState<Filter>('all');

  // Ongoing = not delivered and not cancelled; Delivered = delivered (cancelled orders: All only).
  const list = useMemo(
    () =>
      orders.filter((o) => {
        const s = orderStatusView(o) as { ongoing: boolean; step: number; cancelled: boolean };
        if (filter === 'ongoing') return s.ongoing;
        if (filter === 'delivered') return s.step === 3 && !s.cancelled;
        return true;
      }),
    [orders, filter],
  );

  const header = <ScreenHeader title="My orders" backFallback={ROUTES.profile} />;

  if (!orders.length && loaded) {
    return (
      <Screen header={header} contentStyle={styles.emptyTop}>
        <EmptyState
          icon={Package}
          title="No orders yet"
          message="When you place an order it will appear here, together with the branch it was delivered from."
          actionLabel="Start shopping"
          onAction={() => router.replace(ROUTES.home)}
        />
      </Screen>
    );
  }

  return (
    <Screen header={header} scroll={false}>
      <OrderList
        list={list}
        loading={!orders.length && !loaded}
        filter={filter}
        setFilter={setFilter}
        now={now}
        anyOrders={orders.length > 0}
      />
    </Screen>
  );
}

function OrderList({
  list,
  loading,
  filter,
  setFilter,
  now,
  anyOrders,
}: {
  list: Order[];
  loading: boolean;
  filter: Filter;
  setFilter: (f: Filter) => void;
  now: Date;
  anyOrders: boolean;
}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scrollY = useScreenScrollY();
  const { refresh } = useOrders();
  const [refreshing, setRefreshing] = useState(false);

  return (
    <FlashList
      data={loading ? [] : list}
      keyExtractor={(o) => o.id}
      onScroll={(e) => scrollY?.set(e.nativeEvent.contentOffset.y)}
      scrollEventThrottle={16}
      contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 40 }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={async () => {
            setRefreshing(true);
            await refresh();
            setRefreshing(false);
          }}
          tintColor={colors.maroon}
          colors={[colors.maroon]}
        />
      }
      ListHeaderComponent={
        <View style={styles.chips}>
          {FILTERS.map((f) => (
            <Chip key={f.id} active={filter === f.id} onPress={() => setFilter(f.id)}>
              {f.label}
            </Chip>
          ))}
        </View>
      }
      ItemSeparatorComponent={() => <View style={styles.gap} />}
      renderItem={({ item }) => <OrderCard order={item} now={now} />}
      ListEmptyComponent={
        loading ? (
          <View style={styles.skeletons}>
            {[0, 1].map((i) => (
              <Skeleton key={i} style={styles.skeleton} />
            ))}
          </View>
        ) : anyOrders ? (
          <EmptyState
            compact
            icon={Package}
            title={filter === 'ongoing' ? 'No orders on the way' : 'No delivered orders yet'}
            message={
              filter === 'ongoing'
                ? 'Orders you place will show here until they are delivered.'
                : 'Delivered orders will show here with the branch they came from.'
            }
            actionLabel="Start shopping"
            onAction={() => router.replace(ROUTES.home)}
          />
        ) : null
      }
    />
  );
}

const styles = StyleSheet.create({
  emptyTop: { paddingTop: 32 },
  chips: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  gap: { height: 12 },
  skeletons: { gap: 12 },
  skeleton: { height: 220, borderRadius: radii.xl },
});
