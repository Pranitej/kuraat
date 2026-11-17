import { useRouter } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View, useWindowDimensions, type ScrollViewInstance } from 'react-native';
import { BranchTeaserCard } from '@/components/branch/BranchCard';
import { Screen } from '@/components/layout';
import { ChevronRight, CloudOff, SearchX } from '@/components/icons';
import {
  CartFab,
  ContactSection,
  FilterSheet,
  HomeHeader,
  NearestBranchStrip,
  PromoBanner,
  SearchBar,
} from '@/components/shop/HomeSections';
import { DeliverToBar, DeliverToSheet, useDeliveryAddress } from '@/components/shop/DeliverTo';
import { ProductCard, ProductCardSkeleton } from '@/components/shop/ProductCard';
import { Chip, ChipRow, EmptyState, SectionTitle, Text, TextLink } from '@/components/ui';
import { ROUTES } from '@/lib/routes';
import { useAuth } from '@/context/AuthContext';
import { useBranches } from '@/context/BranchContext';
import { useCart } from '@/context/CartContext';
import { useCatalog } from '@/context/CatalogContext';
import { areaLabel, categoryFilter, filterProducts, withDistances } from '@/domain';
import { productGrid } from '@/lib/grid';
import { colors, layout } from '@/theme/theme';
import type { Branch, Product } from '@/types/api';

const GUTTER = 20;

type Filters = { q: string; category: string; sort: string };
const DEFAULT_FILTERS: Filters = { q: '', category: 'all', sort: 'recommended' };

/** 07/08 · Home */
export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { count } = useCart();
  const { address, addresses, loaded: addressesLoaded, choose } = useDeliveryAddress();
  const catalog = useCatalog();
  const { branches: allBranches } = useBranches();
  const [filters, setFiltersState] = useState<Filters>(DEFAULT_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [addressSheet, setAddressSheet] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const scroll = useRef<ScrollViewInstance>(null);
  const sweetsY = useRef(0);
  const { width } = useWindowDimensions();

  const setFilters = (changes: Partial<Filters>) => setFiltersState((f) => ({ ...f, ...changes }));
  const { q: query, category, sort } = filters;

  // Pills only when every product has a category (design 2026-11-18 §5.5); otherwise no category filter.
  const { show: showCategories, chips } = useMemo(
    () => categoryFilter(catalog.products, catalog.categories) as { show: boolean; chips: { id: string; label: string }[] },
    [catalog.products, catalog.categories],
  );
  const activeCategory = showCategories ? category : 'all';
  const products = useMemo(
    () => filterProducts(catalog.products, { query, category: activeCategory, sort }) as Product[],
    [catalog.products, query, activeCategory, sort],
  );
  const branches = useMemo(() => withDistances(allBranches, address?.location) as Branch[], [allBranches, address]);
  const delivery =
    branches[0] && address ? { branch: branches[0], distanceKm: branches[0].distanceKm, area: areaLabel(address) } : null;
  const loading = catalog.status === 'loading';
  const failed = catalog.status === 'error';

  const contentWidth = Math.min(width, layout.maxWidth) - GUTTER * 2;
  const { cardWidth, gap } = productGrid(contentWidth);

  const scrollToSweets = () => scroll.current?.scrollTo({ y: Math.max(0, sweetsY.current - 8), animated: true });
  const refresh = async () => {
    setRefreshing(true);
    await catalog.refresh();
    setRefreshing(false);
  };

  return (
    <Screen
      header={<HomeHeader user={user} />}
      gutter={0}
      padBottom={false}
      scrollRef={scroll}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.maroon} colors={[colors.maroon]} />}
      overlay={<CartFab count={count} />}
    >
      <View style={styles.gutter}>
        <DeliverToBar address={address} loaded={addressesLoaded} onOpen={() => setAddressSheet(true)} style={styles.deliverTo} />
        <SearchBar
          value={query}
          onChange={(v) => setFilters({ q: v })}
          onOpenFilters={() => setFiltersOpen(true)}
          filtersActive={sort !== 'recommended'}
        />
        <View style={styles.top}>
          <NearestBranchStrip delivery={delivery} />
          <PromoBanner
            onShop={() => {
              setFilters({ category: 'truffles', q: '' });
              setTimeout(scrollToSweets, 50);
            }}
          />
        </View>

        <View
          style={styles.section}
          onLayout={(e) => {
            sweetsY.current = e.nativeEvent.layout.y;
          }}
        >
          <SectionTitle
            action={
              <TextLink
                onPress={() => {
                  setFiltersState(DEFAULT_FILTERS);
                  scrollToSweets();
                }}
              >
                See all
              </TextLink>
            }
          >
            Our sweets
          </SectionTitle>
          {showCategories ? (
            <ChipRow style={styles.chips}>
              {chips.map((c) => (
                <Chip key={c.id} active={activeCategory === c.id} onPress={() => setFilters({ category: c.id })}>
                  {c.label}
                </Chip>
              ))}
            </ChipRow>
          ) : null}

          {query ? (
            <Text variant="small" color="muted" style={styles.results} accessibilityLiveRegion="polite">
              {products.length} {products.length === 1 ? 'result' : 'results'} for “
              <Text variant="small" weight={600}>
                {query}
              </Text>
              ”
            </Text>
          ) : null}

          {loading ? (
            <View style={[styles.grid, { gap }]} accessibilityLabel="Loading sweets">
              {[0, 1, 2, 3].map((i) => (
                <ProductCardSkeleton key={i} width={cardWidth} />
              ))}
            </View>
          ) : failed ? (
            <EmptyState
              compact
              icon={CloudOff}
              title="We can't reach the store right now"
              message={
                (catalog.error as { code?: string; message?: string } | null)?.code === 'network'
                  ? (catalog.error as Error).message
                  : 'Please try again in a moment.'
              }
              actionLabel="Try again"
              onAction={catalog.refresh}
            />
          ) : products.length ? (
            <View style={[styles.grid, { gap }]}>
              {products.map((p) => (
                <ProductCard key={p.id} product={p} width={cardWidth} />
              ))}
            </View>
          ) : (
            <EmptyState
              compact
              icon={SearchX}
              title="No sweets found"
              message={query ? `Nothing matches “${query}”. Try another name or category.` : 'Nothing in this category right now.'}
              actionLabel="Show all sweets"
              onAction={() => setFiltersState(DEFAULT_FILTERS)}
            />
          )}
        </View>

        <View style={styles.branchesSection}>
          <SectionTitle
            action={
              <TextLink onPress={() => router.push(ROUTES.branches)}>
                View all <ChevronRight size={16} color={colors.maroon} strokeWidth={2} />
              </TextLink>
            }
          >
            Our branches
          </SectionTitle>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.branchRow}
            contentContainerStyle={styles.branchRowContent}
          >
            {branches.map((b) => (
              <BranchTeaserCard key={b.id} branch={b} distanceKm={b.distanceKm} />
            ))}
          </ScrollView>
        </View>
      </View>

      <ContactSection />

      <FilterSheet
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        categories={chips}
        category={activeCategory}
        sort={sort}
        onApply={(f) => setFilters(f)}
      />

      <DeliverToSheet
        open={addressSheet}
        onClose={() => setAddressSheet(false)}
        addresses={addresses}
        selectedId={address?.id}
        onChoose={(id) => choose(id, { makeDefault: true })}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  gutter: { paddingHorizontal: GUTTER },
  deliverTo: { marginBottom: 12 },
  top: { marginTop: 14, gap: 16 },
  section: { paddingTop: 28 },
  chips: { marginTop: 16 },
  results: { marginTop: 16 },
  grid: { marginTop: 16, flexDirection: 'row', flexWrap: 'wrap' },
  branchesSection: { paddingTop: 32 },
  branchRow: { marginTop: 16, marginHorizontal: -GUTTER },
  branchRowContent: { paddingHorizontal: GUTTER, paddingBottom: 4, gap: 12 },
});
