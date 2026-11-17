import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { RefreshControl, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Screen, ScreenHeader } from '@/components/layout';
import { CloudOff, Heart, PackageX } from '@/components/icons';
import { CartFab } from '@/components/shop/HomeSections';
import { ProductCard, ProductCardSkeleton } from '@/components/shop/ProductCard';
import { EmptyState, InfoBanner, Tag, Text, TextLink } from '@/components/ui';
import { useCart } from '@/context/CartContext';
import { useCatalog } from '@/context/CatalogContext';
import { useFavorites } from '@/context/FavoritesContext';
import { useToast } from '@/context/ToastContext';
import { favoriteProducts } from '@/domain';
import { productGrid } from '@/lib/grid';
import { ROUTES } from '@/lib/routes';
import { colors, layout } from '@/theme/theme';
import type { Product } from '@/types/api';

const GUTTER = 20;

/**
 * Favourites — the customer's hearted sweets (not in the PDF; built from the Home product grid).
 * The list of ids is ours (kuraat server); names, prices and photos come from the catalogue (ROF).
 */
export default function FavoritesScreen() {
  const router = useRouter();
  const toast = useToast();
  const { count } = useCart();
  const favorites = useFavorites();
  const catalog = useCatalog();
  const [refreshing, setRefreshing] = useState(false);
  const { width } = useWindowDimensions();
  const { cardWidth, gap } = productGrid(Math.min(width, layout.maxWidth) - GUTTER * 2);

  const { products, missingIds } = useMemo(
    () => favoriteProducts(favorites.ids, catalog.products) as { products: Product[]; missingIds: string[] },
    [favorites.ids, catalog.products],
  );
  const loading = favorites.status === 'loading' || catalog.status === 'loading';
  const failed = favorites.status === 'error' || catalog.status === 'error';

  const retry = async () => {
    await Promise.all([favorites.status === 'error' ? favorites.refresh() : null, catalog.status === 'error' ? catalog.refresh() : null]);
  };
  const refresh = async () => {
    setRefreshing(true);
    await Promise.all([favorites.refresh(), catalog.refresh()]);
    setRefreshing(false);
  };
  const clearMissing = () => {
    favorites.removeMany(missingIds);
    toast.show(missingIds.length === 1 ? 'Removed 1 sweet that is no longer sold' : `Removed ${missingIds.length} sweets that are no longer sold`, {
      tone: 'info',
    });
  };

  return (
    <Screen
      header={
        <ScreenHeader
          title="Favourites"
          backFallback={ROUTES.profile}
          right={products.length > 0 ? <Tag style={styles.countTag}>{`${products.length} saved`}</Tag> : null}
        />
      }
      gutter={GUTTER}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.maroon} colors={[colors.maroon]} />}
      overlay={<CartFab count={count} />}
      contentStyle={styles.content}
    >
      {loading ? (
        <View style={[styles.grid, { gap }]} accessibilityLabel="Loading your favourites">
          {[0, 1, 2, 3].map((i) => (
            <ProductCardSkeleton key={i} width={cardWidth} />
          ))}
        </View>
      ) : failed ? (
        <EmptyState
          icon={CloudOff}
          title="We can't load your favourites"
          message="Please check your connection and try again."
          actionLabel="Try again"
          onAction={retry}
        />
      ) : (
        <>
          {missingIds.length > 0 ? (
            <InfoBanner icon={PackageX} style={styles.banner}>
              <Text color="copy" style={styles.bannerText}>
                {missingIds.length === 1
                  ? '1 saved sweet is no longer on the menu.'
                  : `${missingIds.length} saved sweets are no longer on the menu.`}
              </Text>
              <TextLink onPress={clearMissing} style={styles.bannerAction}>
                {missingIds.length === 1 ? 'Remove it' : 'Remove them'}
              </TextLink>
            </InfoBanner>
          ) : null}
          {products.length ? (
            <View style={[styles.grid, { gap }]}>
              {products.map((p) => (
                <ProductCard key={p.id} product={p} width={cardWidth} />
              ))}
            </View>
          ) : (
            <EmptyState
              icon={Heart}
              title="No favourites yet"
              message="Tap the heart on any sweet to keep it here for next time."
              actionLabel="Browse sweets"
              onAction={() => router.navigate(ROUTES.home)}
            />
          )}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 112 },
  countTag: { height: 32, paddingHorizontal: 12 },
  grid: { marginTop: 8, flexDirection: 'row', flexWrap: 'wrap' },
  banner: { marginTop: 8, marginBottom: 8 },
  bannerText: { fontSize: 15, lineHeight: 22 },
  bannerAction: { marginTop: 2, alignSelf: 'flex-start' },
});
