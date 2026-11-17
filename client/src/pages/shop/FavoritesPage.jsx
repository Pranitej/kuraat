import { useMemo } from 'react';
import { CloudOff, Heart, PackageX } from 'lucide-react';
import ScreenHeader from '@/components/layout/ScreenHeader.jsx';
import ProductCard, { ProductCardSkeleton } from '@/components/shop/ProductCard.jsx';
import { CartFab } from '@/components/shop/HomeSections.jsx';
import { EmptyState, InfoBanner, Tag } from '@/components/ui';
import { useCart } from '@/context/CartContext.jsx';
import { useCatalog } from '@/context/CatalogContext.jsx';
import { useFavorites } from '@/context/FavoritesContext.jsx';
import { useToast } from '@/context/ToastContext.jsx';
import { favoriteProducts } from '@/domain';
import { ROUTES } from '@/config/routes.js';
import { useDocumentTitle } from '@/hooks';

const GRID = 'mt-2 grid grid-cols-2 gap-4 md:grid-cols-3 lg:mt-0 lg:gap-6 xl:grid-cols-4';

/**
 * Favourites — the customer's hearted sweets (not in the PDF; built from the Home product grid).
 * The list of ids is ours (kuraat server); names, prices and photos come from the catalogue (ROF).
 */
export default function FavoritesPage() {
  useDocumentTitle('Favourites');
  const toast = useToast();
  const { count } = useCart();
  const favorites = useFavorites();
  const catalog = useCatalog();
  const { products, missingIds } = useMemo(() => favoriteProducts(favorites.ids, catalog.products), [favorites.ids, catalog.products]);

  const loading = favorites.status === 'loading' || catalog.status === 'loading';
  const failed = favorites.status === 'error' || catalog.status === 'error';
  const retry = () => {
    if (favorites.status === 'error') favorites.refresh();
    if (catalog.status === 'error') catalog.refresh();
  };

  const clearMissing = () => {
    favorites.removeMany(missingIds);
    toast.show(missingIds.length === 1 ? 'Removed 1 sweet that is no longer sold' : `Removed ${missingIds.length} sweets that are no longer sold`, {
      tone: 'info',
    });
  };

  return (
    <div className="pb-28 lg:pb-16">
      <div className="mx-auto max-w-column lg:max-w-app lg:px-8">
        <ScreenHeader
          title="Favourites"
          backFallback={ROUTES.profile}
          right={products.length > 0 ? <Tag className="h-8 px-3 text-[13px]">{products.length} saved</Tag> : null}
        />
        <div className="px-5 lg:px-0">
          {loading ? (
            <div className={GRID} aria-busy="true" aria-label="Loading your favourites">
              {[0, 1, 2, 3].map((i) => (
                <ProductCardSkeleton key={i} />
              ))}
            </div>
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
              {missingIds.length > 0 && (
                <InfoBanner icon={PackageX} className="mb-4 items-center">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                    <span>
                      {missingIds.length === 1
                        ? '1 saved sweet is no longer on the menu.'
                        : `${missingIds.length} saved sweets are no longer on the menu.`}
                    </span>
                    <button type="button" onClick={clearMissing} className="text-[15px] font-bold text-maroon hover:underline">
                      Remove {missingIds.length === 1 ? 'it' : 'them'}
                    </button>
                  </div>
                </InfoBanner>
              )}
              {products.length ? (
                <div className={GRID}>
                  {products.map((p, i) => (
                    <ProductCard key={p.id} product={p} className="animate-fade-up" style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }} />
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={Heart}
                  title="No favourites yet"
                  message="Tap the heart on any sweet to keep it here for next time."
                  actionLabel="Browse sweets"
                  actionTo={ROUTES.home}
                />
              )}
            </>
          )}
        </div>
      </div>
      <CartFab count={count} />
    </div>
  );
}
