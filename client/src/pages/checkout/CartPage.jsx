import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, CloudOff, ShoppingBag, Store, Tag as TagIcon, X } from 'lucide-react';
import ScreenHeader from '@/components/layout/ScreenHeader.jsx';
import BottomBar from '@/components/layout/BottomBar.jsx';
import { Button, EmptyState, InfoBanner, Skeleton, Tag, inputBase, inputShell } from '@/components/ui';
import { CartItemCard, CheckoutLayout, CheckoutSteps, OrderSummary } from '@/components/checkout/CheckoutParts.jsx';
import { useCart } from '@/context/CartContext.jsx';
import { useToast } from '@/context/ToastContext.jsx';
import { useDeliveryBranch } from '@/hooks/useDeliveryBranch.js';
import { ROUTES } from '@/config/routes.js';
import { useDocumentTitle, useIsDesktop } from '@/hooks';
import { cn } from '@/lib/cn.js';

function availabilityText(count, delivery) {
  const lead = count === 1 ? 'This item is' : count === 2 ? 'Both items are' : `All ${count} items are`;
  if (!delivery.inStock) return [`Some items are limited at `, `. We will confirm stock with the branch at checkout.`];
  return [`${lead} available at `, delivery.isNearest ? ', your nearest branch. Stock is confirmed at checkout.' : ', the nearest branch with everything in stock. Stock is confirmed at checkout.'];
}

/** 12 · Cart */
export default function CartPage() {
  useDocumentTitle('My cart');
  const navigate = useNavigate();
  const toast = useToast();
  const isDesktop = useIsDesktop();
  const { lines, count, totals, promo, setQty, remove, restore, applyPromo, removePromo, items, status, error, syncing, blocked, flush, reload } = useCart();
  const delivery = useDeliveryBranch(items.map((i) => i.productId));
  const [code, setCode] = useState('');
  const [promoError, setPromoError] = useState('');
  const [applying, setApplying] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const lineCount = lines.length;

  const removeLine = (line) => {
    const removed = remove(line.productId);
    if (removed) toast.show(`${line.product?.name ?? 'Item'} removed`, { tone: 'info', action: { label: 'Undo', onClick: () => restore(removed) } });
  };

  // Leave only once the server has the cart as shown (it prices and checks it again at payment).
  const continueToDelivery = async () => {
    setLeaving(true);
    try {
      await flush();
      navigate(ROUTES.delivery);
    } catch (err) {
      toast.show(err.message, { tone: 'error' });
    } finally {
      setLeaving(false);
    }
  };

  const apply = async (e) => {
    e.preventDefault();
    if (!code.trim()) {
      setPromoError('Enter a promo code');
      return;
    }
    setApplying(true);
    setPromoError('');
    try {
      const p = await applyPromo(code);
      setCode('');
      toast.show(`${p.code} applied — ${p.label.toLowerCase()}`);
    } catch (err) {
      setPromoError(err.message);
    } finally {
      setApplying(false);
    }
  };

  const header = (
    <ScreenHeader title="My cart" right={count > 0 ? <Tag className="h-8 px-3 text-[13px]">{count} {count === 1 ? 'item' : 'items'}</Tag> : null} />
  );

  if (!lineCount && status === 'loading') {
    return (
      <div className="mx-auto max-w-column lg:max-w-[1080px] lg:px-8">
        {header}
        <div className="flex flex-col gap-3 px-5 lg:px-0" aria-busy="true">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-[116px] rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!lineCount && status === 'error') {
    return (
      <div className="mx-auto max-w-column lg:max-w-[1080px] lg:px-8">
        {header}
        <EmptyState icon={CloudOff} title="We can't reach the store right now" message={error?.message} actionLabel="Try again" onAction={reload} />
      </div>
    );
  }

  if (!lineCount) {
    return (
      <div className="mx-auto max-w-column lg:max-w-[1080px] lg:px-8">
        {header}
        <EmptyState
          icon={ShoppingBag}
          title="Your cart is empty"
          message="Add truffles, cakes or pastries and they will appear here, ready for delivery from your nearest branch."
          actionLabel="Start shopping"
          actionTo={ROUTES.home}
        />
      </div>
    );
  }

  const [before, after] = delivery ? availabilityText(lineCount, delivery) : ['', ''];
  const cta = (
    <Button block rightIcon={ChevronRight} disabled={blocked} loading={leaving} onClick={continueToDelivery}>
      Continue to delivery
    </Button>
  );
  const summaryClass = cn('transition-opacity', syncing && 'opacity-60');

  const promoBlock = (
    <div>
      {promo ? (
        <div className="flex h-[52px] items-center gap-3 rounded-md bg-sand px-4">
          <TagIcon size={20} strokeWidth={1.8} className="text-maroon" aria-hidden />
          <p className="min-w-0 flex-1 truncate text-[15px] text-ink">
            <span className="font-bold">{promo.code}</span> applied · <span className="text-muted">{promo.label}</span>
          </p>
          <button type="button" onClick={removePromo} aria-label="Remove promo code" className="grid size-8 place-items-center rounded-full text-maroon hover:bg-white/60">
            <X size={18} strokeWidth={2} />
          </button>
        </div>
      ) : (
        <form noValidate onSubmit={apply} className="flex gap-3">
          <div className={cn(inputShell({ error: promoError }), 'min-w-0 flex-1')}>
            <TagIcon size={20} strokeWidth={1.8} className="shrink-0 text-maroon" aria-hidden />
            <input
              value={code}
              onChange={(e) => {
                setCode(e.target.value.toUpperCase());
                setPromoError('');
              }}
              placeholder="Promo code"
              aria-label="Promo code"
              aria-invalid={Boolean(promoError) || undefined}
              autoCapitalize="characters"
              className={cn(inputBase, 'uppercase placeholder:normal-case')}
            />
          </div>
          <Button type="submit" variant="secondary" size="sm" className="h-[52px] px-5" loading={applying}>
            Apply
          </Button>
        </form>
      )}
      {promoError && (
        <p role="alert" className="mt-1.5 text-label text-hotpink">
          {promoError}
        </p>
      )}
    </div>
  );

  return (
    <CheckoutLayout
      header={header}
      steps={<CheckoutSteps current={0} />}
      aside={
        <div className="flex flex-col gap-4">
          {promoBlock}
          <OrderSummary totals={totals} promo={promo} className={summaryClass} />
          {cta}
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        {lines.map((line) => (
          <CartItemCard
            key={line.productId}
            line={line}
            branchName={delivery?.branch.shortName}
            onQty={(q) => setQty(line.productId, q)}
            onRemove={() => removeLine(line)}
          />
        ))}
      </div>

      {!isDesktop && (
        <div className="mt-4 flex flex-col gap-3">
          {promoBlock}
          <OrderSummary totals={totals} promo={promo} className={summaryClass} />
        </div>
      )}

      {delivery && (
        <InfoBanner icon={Store} className="mt-3 lg:mt-4">
          {before}
          <strong className="font-bold text-ink">{delivery.branch.displayName}</strong>
          {after}
        </InfoBanner>
      )}

      {!isDesktop && <BottomBar>{cta}</BottomBar>}
    </CheckoutLayout>
  );
}
