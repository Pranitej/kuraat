import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, CloudOff, ShoppingBag, Store } from 'lucide-react';
import ScreenHeader from '@/components/layout/ScreenHeader.jsx';
import BottomBar from '@/components/layout/BottomBar.jsx';
import { Button, EmptyState, InfoBanner, Skeleton, Tag } from '@/components/ui';
import { CartItemCard, CheckoutLayout, CheckoutSteps, OrderSummary } from '@/components/checkout/CheckoutParts.jsx';
import { useCart } from '@/context/CartContext.jsx';
import { useToast } from '@/context/ToastContext.jsx';
import { useDeliveryQuote } from '@/hooks/useDeliveryQuote.js';
import { useAddresses } from '@/context/AddressContext.jsx';
import { ROUTES } from '@/config/routes.js';
import { useDocumentTitle, useIsDesktop } from '@/hooks';
import { cn } from '@/lib/cn.js';

function availabilityText(count, delivery) {
  const lead = count === 1 ? 'This item is' : count === 2 ? 'Both items are' : `All ${count} items are`;
  if (delivery.inStock === false) return [`Some items are limited at `, `. We will confirm stock with the branch at checkout.`];
  return [`${lead} available at `, delivery.isNearest ? ', your nearest branch. Stock is confirmed at checkout.' : ', the nearest branch with everything in stock. Stock is confirmed at checkout.'];
}

/** 12 · Cart */
export default function CartPage() {
  useDocumentTitle('My cart');
  const navigate = useNavigate();
  const toast = useToast();
  const isDesktop = useIsDesktop();
  const { lines, count, totals, setQty, remove, restore, items, status, error, syncing, blocked, flush, reload } = useCart();
  const { defaultAddress } = useAddresses();
  const { quote: delivery } = useDeliveryQuote({ addressId: defaultAddress?.id, productIds: items.map((i) => i.productId) });
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
        <EmptyState
          icon={CloudOff}
          title="We can't reach the store right now"
          message={error?.code === 'network' ? error.message : 'Please try again in a moment.'}
          actionLabel="Try again"
          onAction={reload}
        />
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

  return (
    <CheckoutLayout
      header={header}
      steps={<CheckoutSteps current={0} />}
      aside={
        <div className="flex flex-col gap-4">
          <OrderSummary totals={totals} className={summaryClass} />
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
          <OrderSummary totals={totals} className={summaryClass} />
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
