import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, Maximize, PackageSearch, ShoppingBag, ZoomIn } from 'lucide-react';
import { Button, Card, EmptyState, IconButton, QuantityStepper, Skeleton, Tag } from '@/components/ui';
import BottomBar from '@/components/layout/BottomBar.jsx';
import { BackButton } from '@/components/layout/ScreenHeader.jsx';
import DeliveryFromCard from '@/components/shop/DeliveryFromCard.jsx';
import { formatSAR, formatWindow, quoteStockLabel } from '@/domain';
import { ROUTES } from '@/config/routes.js';
import { useCart } from '@/context/CartContext.jsx';
import { useCatalog } from '@/context/CatalogContext.jsx';
import { useToast } from '@/context/ToastContext.jsx';
import { useDeliveryQuote } from '@/hooks/useDeliveryQuote.js';
import { useAddresses } from '@/context/AddressContext.jsx';
import { useDocumentTitle, useGoBack, useIsDesktop, useScrollY } from '@/hooks';
import { cn } from '@/lib/cn.js';

function Thumbs({ images, active, onSelect, className, size = 'sm' }) {
  return (
    <div className={cn('flex gap-2.5', className)} role="tablist" aria-label="Product photos">
      {images.map((src, i) => (
        <button
          key={src}
          type="button"
          role="tab"
          aria-selected={i === active}
          aria-label={`Photo ${i + 1}`}
          onClick={(e) => {
            e.stopPropagation();
            onSelect(i);
          }}
          className={cn(
            'overflow-hidden rounded-sm border-2 transition',
            size === 'sm' ? 'size-[50px]' : 'size-[84px] rounded-lg',
            i === active ? 'border-white shadow-float lg:border-maroon' : 'border-white/60 opacity-90 hover:opacity-100 lg:border-transparent',
          )}
        >
          <img src={src} alt="" className="size-full object-cover" />
        </button>
      ))}
    </div>
  );
}

/** 09/10 · Product detail (+ expanded description) */
export default function ProductDetailPage() {
  const { productId } = useParams();
  const catalog = useCatalog();
  const product = catalog.getProduct(productId);
  const { loadProduct } = catalog;
  useEffect(() => {
    loadProduct(productId);
  }, [productId, loadProduct]);
  useDocumentTitle(product?.name || 'Product');
  const navigate = useNavigate();
  const goBack = useGoBack(ROUTES.home);
  const toast = useToast();
  const { add, quantityOf } = useCart();
  const [active, setActive] = useState(0);
  const [qty, setQty] = useState(1);
  const [expanded, setExpanded] = useState(false);
  const scrollY = useScrollY();
  const isDesktop = useIsDesktop();
  const swipe = useRef(null);
  const { defaultAddress } = useAddresses();
  const { quote: delivery } = useDeliveryQuote({ addressId: product ? defaultAddress?.id : null, productIds: product ? [product.id] : [] });
  const images = useMemo(() => product?.images || [], [product]);

  if (!product && catalog.status === 'loading') {
    return (
      <div className="lg:mx-auto lg:max-w-app lg:px-8 lg:pt-8" aria-busy="true">
        <Skeleton className="h-[372px] md:h-[460px] lg:h-[520px] lg:rounded-2xl" />
        <div className="mx-auto max-w-column space-y-3 px-5 pt-6">
          <Skeleton className="h-7 w-2/3 rounded" />
          <Skeleton className="h-4 w-1/2 rounded" />
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="mx-auto max-w-column pt-10">
        <EmptyState icon={PackageSearch} title="This sweet is not available" message="It may have been removed from our menu." actionLabel="Browse sweets" actionTo={ROUTES.home} />
      </div>
    );
  }

  const openZoom = (i = active) => navigate(ROUTES.productPhotos(product.id, i));

  const deliveryMeta = delivery
    ? [delivery.isNearest ? 'Closest to you' : `${delivery.distanceKm} km away`, quoteStockLabel(delivery.inStock), formatWindow(delivery.window.start, delivery.window.end, new Date(), { long: false })].filter(Boolean).join(' · ')
    : null;
  const inCart = quantityOf(product.id);

  const addToCart = () => {
    add(product.id, qty);
    toast.show(`${qty} × ${product.name} added to your cart`, { action: { label: 'View cart', onClick: () => navigate(ROUTES.cart) } });
  };
  const buyNow = () => {
    add(product.id, qty);
    navigate(ROUTES.cart);
  };

  const onPointerDown = (e) => (swipe.current = { x: e.clientX, y: e.clientY });
  const onPointerUp = (e) => {
    if (!swipe.current) return;
    const dx = e.clientX - swipe.current.x;
    const dy = e.clientY - swipe.current.y;
    swipe.current = null;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) setActive((i) => (i + (dx < 0 ? 1 : images.length - 1)) % images.length);
    else if (Math.abs(dx) < 6 && Math.abs(dy) < 6) openZoom();
  };

  const showCompactHeader = scrollY > 300;

  return (
    <div className="lg:mx-auto lg:max-w-app lg:px-8 lg:pt-8">
      {/* Compact header once the hero scrolls away (PDF screen 10) */}
      <div
        className={cn(
          'fixed inset-x-0 top-0 z-30 border-b border-line-subtle bg-cream/95 backdrop-blur-sm transition-[opacity,transform] duration-200 lg:hidden',
          showCompactHeader ? 'translate-y-0 opacity-100' : 'pointer-events-none -translate-y-2 opacity-0',
        )}
        aria-hidden={!showCompactHeader}
      >
        <div className="mx-auto grid h-[76px] max-w-column grid-cols-[44px_1fr_44px] items-center gap-3 px-5">
          <IconButton icon={ChevronLeft} label="Back" iconSize={22} strokeWidth={2} onClick={goBack} tabIndex={showCompactHeader ? 0 : -1} />
          <p className="truncate text-center text-heading text-ink">{product.name}</p>
          <span aria-hidden />
        </div>
      </div>

      <div className="lg:grid lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:items-start lg:gap-12">
        {/* Gallery */}
        <div className="lg:sticky lg:top-[108px]">
          <div
            className="relative h-[372px] touch-pan-y select-none overflow-hidden bg-sand md:h-[460px] lg:aspect-square lg:h-auto lg:cursor-zoom-in lg:rounded-2xl"
            onPointerDown={onPointerDown}
            onPointerUp={onPointerUp}
          >
            {images.map((src, i) => (
              <img
                key={src}
                src={src}
                alt={i === active ? `${product.name} — photo ${i + 1} of ${images.length}` : ''}
                aria-hidden={i !== active}
                draggable="false"
                className={cn('absolute inset-0 size-full object-cover transition-opacity duration-300', i === active ? 'opacity-100' : 'opacity-0')}
              />
            ))}
            <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/10 to-transparent lg:hidden" aria-hidden />

            <div className="absolute inset-x-5 top-4 flex items-center justify-between lg:inset-x-auto lg:right-4" onPointerDown={(e) => e.stopPropagation()} onPointerUp={(e) => e.stopPropagation()}>
              <IconButton icon={ChevronLeft} label="Back" variant="overlay" iconSize={22} strokeWidth={2} onClick={goBack} className="lg:hidden" />
              <IconButton icon={Maximize} label="View full screen" variant="overlay" onClick={() => openZoom()} />
            </div>

            <div className="absolute inset-x-5 bottom-10 flex items-end justify-between lg:bottom-4 lg:left-auto lg:right-4" onPointerDown={(e) => e.stopPropagation()} onPointerUp={(e) => e.stopPropagation()}>
              <Thumbs images={images} active={active} onSelect={setActive} className="lg:hidden" />
              <button
                type="button"
                onClick={() => openZoom()}
                className="inline-flex h-8 items-center gap-1.5 rounded-pill bg-white/90 px-3 text-label text-ink shadow-float backdrop-blur-sm transition hover:bg-white"
              >
                <ZoomIn size={16} strokeWidth={2} className="text-maroon" aria-hidden />
                {active + 1} / {images.length} · Tap to zoom
              </button>
            </div>
          </div>
          <Thumbs images={images} active={active} onSelect={setActive} size="lg" className="mt-4 hidden lg:flex" />
        </div>

        {/* Info sheet */}
        <div className="relative -mt-7 rounded-t-sheet bg-cream px-5 pt-6 lg:mt-0 lg:rounded-none lg:px-0 lg:pt-0">
          <div className="mx-auto max-w-column lg:max-w-none">
            <BackButton fallback={ROUTES.home} className="mb-6 hidden lg:inline-grid" />
            <div className="flex items-start justify-between gap-4">
              <h1 className="text-h1 text-ink lg:text-[32px] lg:leading-10">{product.name}</h1>
              <p className="shrink-0 text-[22px] font-bold leading-[30px] text-maroon lg:text-[28px] lg:leading-10">{formatSAR(product.price, { decimals: 0 })}</p>
            </div>
            {product.subtitle && <p className="mt-1 text-body text-muted">{product.subtitle}</p>}

            {product.highlights.length > 0 && (
              <div className={cn('mt-4 grid gap-2.5', ['grid-cols-1', 'grid-cols-2', 'grid-cols-3'][Math.min(product.highlights.length, 3) - 1])}>
                {product.highlights.map(({ label, value }) => (
                  <div key={label} className="rounded-md border border-line-subtle bg-white px-3.5 py-2.5">
                    <p className="text-label font-normal text-muted">{label}</p>
                    <p className="mt-0.5 text-[15px] font-bold leading-5 text-ink min-[380px]:whitespace-nowrap">{value}</p>
                  </div>
                ))}
              </div>
            )}

            {delivery && (
              <DeliveryFromCard
                className="mt-4"
                branch={delivery.branch}
                meta={deliveryMeta}
                onClick={() => navigate(ROUTES.branch(delivery.branch.id))}
              />
            )}

            {isDesktop && (
              <div className="mt-6">
                <PurchaseControls qty={qty} setQty={setQty} onAdd={addToCart} onBuy={buyNow} inCart={inCart} />
              </div>
            )}

            <section className="mt-6 lg:mt-10" aria-labelledby="desc-title">
              <h2 id="desc-title" className="text-h3 text-ink">
                Description
              </h2>
              <div className={cn('mt-2 flex flex-col gap-3 text-body-lg text-copy', !expanded && 'lg:hidden')}>
                {expanded ? product.description.map((p) => <p key={p}>{p}</p>) : <p className="line-clamp-3">{product.description[0]}</p>}
              </div>
              {!expanded && (
                <>
                  <div className="mt-2 hidden flex-col gap-3 text-body-lg text-copy lg:flex">
                    {product.description.map((p) => (
                      <p key={p}>{p}</p>
                    ))}
                  </div>
                  <button type="button" onClick={() => setExpanded(true)} className="mt-2 text-[15px] font-bold text-maroon hover:underline lg:hidden" aria-expanded={false}>
                    Read more
                  </button>
                </>
              )}
            </section>

            <div className={cn(!expanded && 'hidden lg:block')}>
              {product.details.length > 0 && (
                <section className="mt-6" aria-labelledby="details-title">
                  <h2 id="details-title" className="text-h3 text-ink">
                    Product details
                  </h2>
                  <Card className="mt-3 px-4 py-1.5">
                    <dl>
                      {product.details.map(({ key, label, value }) => (
                        <div key={key} className="flex items-baseline justify-between gap-4 py-2">
                          <dt className="text-body text-muted">{label}</dt>
                          <dd className="text-right text-[15px] font-semibold text-ink">{value}</dd>
                        </div>
                      ))}
                    </dl>
                  </Card>
                </section>
              )}

              {(product.ingredients || product.allergens.length > 0) && (
                <section className="mt-6" aria-labelledby="ingredients-title">
                  <h2 id="ingredients-title" className="text-h3 text-ink">
                    Ingredients &amp; allergens
                  </h2>
                  {product.ingredients && <p className="mt-2 text-body-lg text-copy">{product.ingredients}</p>}
                  {product.allergens.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {product.allergens.map((a) => (
                        <Tag key={a}>{a}</Tag>
                      ))}
                    </div>
                  )}
                </section>
              )}

              {delivery && <DeliveryFromCard className="mt-6 lg:hidden" branch={delivery.branch} />}
            </div>
            <div className="h-6 lg:h-16" />
          </div>
        </div>
      </div>

      {!isDesktop && (
        <BottomBar>
          <PurchaseControls qty={qty} setQty={setQty} onAdd={addToCart} onBuy={buyNow} inCart={inCart} />
        </BottomBar>
      )}
    </div>
  );
}

function PurchaseControls({ qty, setQty, onAdd, onBuy, inCart }) {
  return (
    <div>
      <div className="flex items-center gap-2">
        <QuantityStepper value={qty} onChange={setQty} size="lg" />
        <Button variant="secondary" className="min-w-0 flex-[1.15] px-3" onClick={onAdd}>
          <ShoppingBag size={20} strokeWidth={1.9} className="max-[379px]:hidden" aria-hidden />
          Add to cart
        </Button>
        <Button className="min-w-0 flex-1 px-3" onClick={onBuy}>
          Buy now
        </Button>
      </div>
      {inCart > 0 && <p className="mt-2 hidden text-small text-muted lg:block">{inCart} already in your cart</p>}
    </div>
  );
}
