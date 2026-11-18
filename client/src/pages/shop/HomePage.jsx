import { useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ChevronRight, CloudOff, SearchX } from 'lucide-react';
import { Chip, ChipRow, EmptyState, SectionTitle } from '@/components/ui';
import ProductCard, { ProductCardSkeleton } from '@/components/shop/ProductCard.jsx';
import { BranchTeaserCard } from '@/components/branch/BranchCard.jsx';
import { CartFab, ContactSection, FilterSheet, HomeHeader, NearestBranchStrip, PromoBanner, SearchBar } from '@/components/shop/HomeSections.jsx';
import { useAuth } from '@/context/AuthContext.jsx';
import { useBranches } from '@/context/BranchContext.jsx';
import { useCart } from '@/context/CartContext.jsx';
import { useCatalog } from '@/context/CatalogContext.jsx';
import { DeliverToBar, DeliverToSheet, useDeliveryAddress } from '@/components/shop/DeliverTo.jsx';
import { areaLabel, categoryFilter, filterProducts, withDistances } from '@/domain';
import { ROUTES } from '@/config/routes.js';
import { useDocumentTitle, useIsDesktop } from '@/hooks';

/** 07/08 · Home */
export default function HomePage() {
  useDocumentTitle('Home');
  const { user } = useAuth();
  const { count } = useCart();
  const { address, addresses, loaded: addressesLoaded, choose } = useDeliveryAddress();
  const catalog = useCatalog();
  const { branches: allBranches } = useBranches();
  const [params, setParams] = useSearchParams();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [addressSheet, setAddressSheet] = useState(false);
  const sweetsRef = useRef(null);
  const isDesktop = useIsDesktop();

  const query = params.get('q') || '';
  const category = params.get('category') || 'all';
  const sort = params.get('sort') || 'recommended';

  const setFilters = (changes, { replace = true } = {}) => {
    const next = new URLSearchParams(params);
    Object.entries(changes).forEach(([k, v]) => {
      const isDefault = !v || (k === 'category' && v === 'all') || (k === 'sort' && v === 'recommended');
      if (isDefault) next.delete(k);
      else next.set(k, v);
    });
    setParams(next, { replace });
  };

  // Pills only when every product has a category (design 2026-11-18 §5.5); otherwise no category filter.
  const { show: showCategories, chips } = useMemo(() => categoryFilter(catalog.products, catalog.categories), [catalog.products, catalog.categories]);
  const activeCategory = showCategories ? category : 'all';
  const products = useMemo(() => filterProducts(catalog.products, { query, category: activeCategory, sort }), [catalog.products, query, activeCategory, sort]);
  const branches = useMemo(() => withDistances(allBranches, address?.location), [allBranches, address]);
  // "Nearest" is only known when the address has a location (the customer may not have shared one): without it the
  // branches are not ordered by distance, so no branch is called the nearest and no distance is shown.
  const delivery = address?.location && branches[0]?.distanceKm != null ? { branch: branches[0], distanceKm: branches[0].distanceKm, area: areaLabel(address) } : null;
  const loading = catalog.status === 'loading';
  const failed = catalog.status === 'error';

  const scrollToSweets = () => sweetsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  return (
    <div className="pb-0">
      {!isDesktop && <HomeHeader user={user} />}

      <div className="mx-auto max-w-column px-5 lg:max-w-app lg:px-8">
        <DeliverToBar address={address} loaded={addressesLoaded} onOpen={() => setAddressSheet(true)} className="mb-3 lg:mb-0 lg:mt-8" />
        {!isDesktop && (
          <SearchBar
            value={query}
            onChange={(v) => setFilters({ q: v })}
            onOpenFilters={() => setFiltersOpen(true)}
            filtersActive={sort !== 'recommended'}
          />
        )}

        {/* Two columns (banner + branch card) while the card is there; the banner takes the whole width when it is not. */}
        <div className={`mt-3.5 flex flex-col gap-4 lg:mt-5 lg:grid lg:items-stretch lg:gap-6 ${delivery || branches.length ? 'lg:grid-cols-[1fr_360px]' : 'lg:grid-cols-1'}`}>
          <NearestBranchStrip delivery={delivery} showAll={branches.length > 0} className="lg:order-2 lg:h-full lg:flex-col lg:items-start lg:justify-center lg:gap-4 lg:p-7" />
          <PromoBanner
            className="lg:order-1"
            onShop={() => {
              setFilters({ category: 'truffles', q: '' });
              setTimeout(scrollToSweets, 50);
            }}
          />
        </div>

        <section ref={sweetsRef} className="scroll-mt-24 pt-7 lg:pt-12" aria-labelledby="sweets-title">
          <SectionTitle
            action={
              <button
                type="button"
                onClick={() => {
                  setFilters({ category: 'all', q: '', sort: 'recommended' });
                  scrollToSweets();
                }}
                className="text-[15px] font-bold text-maroon hover:underline"
              >
                See all
              </button>
            }
          >
            <span id="sweets-title">Our sweets</span>
          </SectionTitle>

          <div className="mt-4 flex items-center gap-4">
            {showCategories ? (
              <ChipRow className="flex-1">
                {chips.map((c) => (
                  <Chip key={c.id} active={activeCategory === c.id} onClick={() => setFilters({ category: c.id })}>
                    {c.label}
                  </Chip>
                ))}
              </ChipRow>
            ) : (
              <span className="flex-1" />
            )}
            <button
              type="button"
              onClick={() => setFiltersOpen(true)}
              className="hidden shrink-0 items-center gap-2 rounded-pill border border-line bg-white px-4 py-2 text-small font-semibold text-maroon hover:border-maroon/40 lg:inline-flex"
            >
              Sort: {sort === 'recommended' ? 'Recommended' : sort === 'price-asc' ? 'Price ↑' : sort === 'price-desc' ? 'Price ↓' : 'A–Z'}
            </button>
          </div>

          {query && (
            <p className="mt-4 text-small text-muted" aria-live="polite">
              {products.length} {products.length === 1 ? 'result' : 'results'} for “<span className="font-semibold text-ink">{query}</span>”
            </p>
          )}

          {loading ? (
            <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-3 lg:mt-6 lg:gap-6" aria-busy="true" aria-label="Loading sweets">
              {[0, 1, 2, 3].map((i) => (
                <ProductCardSkeleton key={i} />
              ))}
            </div>
          ) : failed ? (
            <EmptyState
              compact
              icon={CloudOff}
              title="We can't reach the store right now"
              message={catalog.error?.code === 'network' ? catalog.error.message : 'Please try again in a moment.'}
              actionLabel="Try again"
              onAction={catalog.refresh}
            />
          ) : products.length ? (
            <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-3 lg:mt-6 lg:gap-6">
              {products.map((p, i) => (
                <ProductCard key={p.id} product={p} className="animate-fade-up" style={{ animationDelay: `${i * 40}ms` }} />
              ))}
            </div>
          ) : (
            <EmptyState
              compact
              icon={SearchX}
              title="No sweets found"
              message={query ? `Nothing matches “${query}”. Try another name or category.` : 'Nothing in this category right now.'}
              actionLabel="Show all sweets"
              onAction={() => setFilters({ category: 'all', q: '', sort: 'recommended' })}
            />
          )}
        </section>

        <section className="pt-8 lg:pt-14" aria-labelledby="branches-title">
          <SectionTitle
            action={
              <Link to={ROUTES.branches} className="inline-flex items-center gap-1 text-[15px] font-bold text-maroon hover:underline">
                View all <ChevronRight size={18} strokeWidth={2} />
              </Link>
            }
          >
            <span id="branches-title">Our branches</span>
          </SectionTitle>
          <div className="no-scrollbar -mx-5 mt-4 flex gap-3 overflow-x-auto px-5 pb-1 lg:mx-0 lg:grid lg:grid-cols-3 lg:gap-6 lg:overflow-visible lg:px-0">
            {branches.map((b) => (
              <BranchTeaserCard key={b.id} branch={b} distanceKm={b.distanceKm} />
            ))}
          </div>
        </section>
      </div>

      <ContactSection />
      <CartFab count={count} />

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
    </div>
  );
}
