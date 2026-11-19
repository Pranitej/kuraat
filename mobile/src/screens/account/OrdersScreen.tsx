import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { OrderCard, RefreshButton } from '@/components/account/OrderParts';
import { Screen, ScreenHeader, useScreenScrollY } from '@/components/layout';
import { CloudOff, Package } from '@/components/icons';
import { EmptyState, SelectField, Skeleton } from '@/components/ui';
import { ROUTES } from '@/lib/routes';
import { useOrders } from '@/context/OrderContext';
import { ORDER_FILTERS, filterOrders } from '@/domain';
import { colors, radii } from '@/theme/theme';
import type { Order } from '@/types/api';
import { t } from '@/i18n';

type Filter = string;
const FILTER_OPTIONS = (ORDER_FILTERS as { id: string; label: string }[]).map((f) => ({ value: f.id, label: f.label }));

/** 20 · My orders  ·  21 · My orders (empty) */
export default function OrdersScreen() {
  const router = useRouter();
  const { orders, now, loaded, error, refresh } = useOrders();
  const [filter, setFilter] = useState<Filter>('all');

  // The dropdown's groups come from the server's status table (design 2026-11-18 §5.4).
  const list = useMemo(() => filterOrders(orders, filter) as Order[], [orders, filter]);

  const header = (
    <ScreenHeader
      title={t('My orders')}
      backFallback={ROUTES.profile}
      right={loaded ? <RefreshButton label={t('Refresh orders')} onRefresh={() => refresh({ force: true })} /> : null}
    />
  );

  // The first load failed: say so and offer a retry — "No orders yet" would be wrong.
  if (!orders.length && loaded && error) {
    const e = error as { message?: string };
    return (
      <Screen header={header} contentStyle={styles.emptyTop}>
        <EmptyState
          icon={CloudOff}
          title={t('We can\'t load your orders')}
          message={e?.message || t('Please try again in a moment.')}
          actionLabel={t('Try again')}
          onAction={() => refresh()}
        />
      </Screen>
    );
  }

  if (!orders.length && loaded) {
    return (
      <Screen header={header} contentStyle={styles.emptyTop}>
        <EmptyState
          icon={Package}
          title={t('No orders yet')}
          message={t('When you place an order it will appear here, together with the branch it was delivered from.')}
          actionLabel={t('Start shopping')}
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
        <SelectField variant="chip" label={t('Show')} sheetTitle={t('Show orders')} value={filter} options={FILTER_OPTIONS} onChange={setFilter} style={styles.filter} />
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
            title={t('No orders here')}
            message={t('Orders with this status will show here.')}
            actionLabel={t('Show all orders')}
            onAction={() => setFilter('all')}
          />
        ) : null
      }
    />
  );
}

const styles = StyleSheet.create({
  emptyTop: { paddingTop: 32 },
  filter: { marginBottom: 16 },
  gap: { height: 12 },
  skeletons: { gap: 12 },
  skeleton: { height: 220, borderRadius: radii.xl },
});
