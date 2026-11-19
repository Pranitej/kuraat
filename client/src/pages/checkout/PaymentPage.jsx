import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Banknote, CreditCard, Lock, Store, TriangleAlert } from 'lucide-react';
import ScreenHeader from '@/components/layout/ScreenHeader.jsx';
import BottomBar from '@/components/layout/BottomBar.jsx';
import { Button, RadioDot, Skeleton } from '@/components/ui';
import { CheckoutLayout, CheckoutSteps, OrderSummary } from '@/components/checkout/CheckoutParts.jsx';
import DeliveryFromCard from '@/components/shop/DeliveryFromCard.jsx';
import { useAddresses } from '@/context/AddressContext.jsx';
import { useCart } from '@/context/CartContext.jsx';
import { useCheckout } from '@/context/CheckoutContext.jsx';
import { useOrders } from '@/context/OrderContext.jsx';
import { useToast } from '@/context/ToastContext.jsx';
import { useDeliveryQuote } from '@/hooks/useDeliveryQuote.js';
import { getPaymentOptions } from '@/services/checkoutService.js';
import { offeredMethod, toPaymentBody } from '@/services/orderService.js';
import { CARD_PAYMENT, PICKUP, formatSAR } from '@/domain';
import { ROUTES } from '@/config/routes.js';
import { useDocumentTitle, useIsDesktop } from '@/hooks';
import { cn } from '@/lib/cn.js';
import { t, localized } from '@/i18n';

// Saudi Arabia: card (incl. Mada) and cash on delivery; branch pickup pays now (card) or at the branch.
// UPI (shown in the PDF) was removed — it is India-only. A card is paid on RSOF's secure payment page after the
// order is placed (19 Nov 2026): no card details are typed here.
const DELIVERY_METHODS = localized([
  { id: 'card', title: CARD_PAYMENT.title, subtitle: CARD_PAYMENT.subtitle, icon: CreditCard },
  { id: 'cod', title: 'Cash on delivery', subtitle: 'Pay when your order arrives', icon: Banknote },
]);
const PICKUP_METHODS = [
  { id: 'card', title: PICKUP.payNow, subtitle: PICKUP.payNowSub, icon: CreditCard },
  { id: 'branch', title: PICKUP.payAtBranch, subtitle: PICKUP.payAtBranchSub, icon: Store },
];

/** 14 · Payment */
export default function PaymentPage() {
  useDocumentTitle(t('Payment'));
  const navigate = useNavigate();
  const toast = useToast();
  const isDesktop = useIsDesktop();
  const cart = useCart();
  const { addresses, defaultAddress, loaded: addressesLoaded } = useAddresses();
  const { placeOrder } = useOrders();
  const checkout = useCheckout();
  const pickup = checkout.fulfilment === 'pickup';
  const METHODS = pickup ? PICKUP_METHODS : DELIVERY_METHODS;
  const address = pickup ? null : addresses.find((a) => a.id === checkout.addressId) || defaultAddress;
  const { quote: delivery, error: quoteError, retry: retryQuote } = useDeliveryQuote({ addressId: address?.id, productIds: cart.items.map((i) => i.productId), fulfilment: pickup ? 'pickup' : 'delivery' });
  const { ensureIdempotencyKey } = checkout;

  // One key per checkout, made when the payment screen opens and reused on every retry.
  useEffect(() => {
    ensureIdempotencyKey();
  }, [ensureIdempotencyKey]);

  // The remembered method if this way of getting the order still offers it (a draft may even say "upi").
  const [method, setMethod] = useState(() => offeredMethod(checkout.paymentMethod, checkout.fulfilment));
  const [errors, setErrors] = useState({});
  const [processing, setProcessing] = useState(false);
  // Card works only while RSOF's payment page does (null = still asking the kuraat server).
  const [cardAvailable, setCardAvailable] = useState(null);

  useEffect(() => {
    let alive = true;
    getPaymentOptions().then(({ card }) => {
      if (!alive) return;
      setCardAvailable(card);
      if (!card) setMethod((m) => offeredMethod(m, checkout.fulfilment, { cardAvailable: false }));
    });
    return () => {
      alive = false;
    };
  }, [checkout.fulfilment]);

  // After a reload the cart and addresses are still on their way from the server: wait for them.
  if (!processing && ((!cart.items.length && cart.status === 'loading') || !addressesLoaded)) return <div className="min-h-[60dvh]" aria-busy="true" />;
  if (!cart.items.length && !processing) return <Navigate to={ROUTES.cart} replace />;
  if (!pickup && !address && !processing) return <Navigate to={ROUTES.delivery} replace />;

  // Pickup totals come priced from the server with the quote (the same RSOF product prices).
  const totals = pickup ? delivery?.totals : cart.totals;
  const choose = (id) => {
    setMethod(id);
    setErrors({});
    checkout.patch({ paymentMethod: id });
  };

  const cardOff = method === 'card' && cardAvailable !== true;

  const pay = async () => {
    if (processing || !totals || cardOff) return;
    setProcessing(true);
    setErrors({});
    try {
      await cart.flush(); // the server places the cart it has
      const order = await placeOrder({
        fulfilment: pickup ? 'pickup' : 'delivery',
        addressId: address?.id,
        payment: toPaymentBody(method),
        idempotencyKey: ensureIdempotencyKey(),
      });
      cart.reload(); // the server emptied it
      checkout.reset({ lastOrderId: order.id, paymentMethod: method, fulfilment: pickup ? 'pickup' : 'delivery' });
      navigate(ROUTES.paymentSuccess(order.id), { replace: true });
    } catch (err) {
      if (err.code === 'idempotency_conflict') checkout.renewIdempotencyKey();
      // Card stopped working between opening this screen and paying: grey it out and offer the other way.
      if (err.code === 'payment_unavailable' && method === 'card') {
        setCardAvailable(false);
        choose(offeredMethod('card', checkout.fulfilment, { cardAvailable: false }));
      }
      setProcessing(false);
      setErrors({ form: err.message });
      toast.show(t('Your order could not be placed'), { tone: 'error' });
    }
  };

  const later = method === 'cod' || method === 'branch';
  // Card: the order is placed first, then paid on the secure payment page (the next screen opens it).
  const payLabel = !totals ? t('Pay') : later ? t('Place order · {amount}', { amount: formatSAR(totals.total) }) : t('Continue to payment · {amount}', { amount: formatSAR(totals.total) });
  const cta = (
    <Button block leftIcon={later ? undefined : Lock} loading={processing} disabled={!totals || cardOff} onClick={pay}>
      {payLabel}
    </Button>
  );

  return (
    <CheckoutLayout
      header={<ScreenHeader title={t('Payment')} backFallback={ROUTES.delivery} />}
      steps={<CheckoutSteps current={2} />}
      aside={
        <div className="flex flex-col gap-4">
          {totals ? (
            <OrderSummary totals={totals} title={t('Order summary')} />
          ) : quoteError ? null : (
            <div role="status" aria-busy="true" aria-label={t('Getting your total')}>
              <Skeleton className="h-[180px] rounded-xl" />
            </div>
          )}
          {delivery?.branch && <DeliveryFromCard icon="store" label={pickup ? PICKUP.likely : undefined} branch={delivery.branch} distanceKm={delivery.distanceKm} showDistance />}
          {cta}
        </div>
      }
    >
      <h2 className="text-h3 text-ink">{t('Payment method')}</h2>
      {errors.form && (
        <div role="alert" className="mt-3 flex gap-2.5 rounded-lg border border-hotpink/40 bg-hotpink/[0.06] px-4 py-3 text-[15px] text-ink">
          <TriangleAlert size={20} strokeWidth={1.8} className="mt-px shrink-0 text-hotpink" aria-hidden />
          {errors.form}
        </div>
      )}

      {!totals && quoteError && (
        // Pickup prices come with the quote: say so when it fails, and let the customer try again.
        <div role="alert" className="mt-3 flex flex-col items-start gap-3 rounded-lg border border-hotpink/40 bg-hotpink/[0.06] px-4 py-3 text-[15px] text-ink">
          <span className="flex gap-2.5">
            <TriangleAlert size={20} strokeWidth={1.8} className="mt-px shrink-0 text-hotpink" aria-hidden />
            {quoteError.message}
          </span>
          <Button variant="secondary" size="sm" onClick={retryQuote}>{t('Try again')}</Button>
        </div>
      )}

      <div role="radiogroup" aria-label={t('Payment method')} className="mt-3 flex flex-col gap-3">
        {METHODS.map((m) => {
          const checked = method === m.id;
          const off = m.id === 'card' && cardAvailable === false;
          return (
            <div key={m.id} className={cn('rounded-xl bg-white transition-[border-color]', checked ? 'border-[1.5px] border-maroon' : 'border border-line-subtle')}>
              <button
                type="button"
                role="radio"
                aria-checked={checked}
                disabled={processing || off}
                onClick={() => choose(m.id)}
                className={cn('flex w-full items-center gap-3.5 p-4 text-start disabled:cursor-default', off && 'opacity-50')}
              >
                <RadioDot checked={checked} />
                <span className="grid size-[42px] shrink-0 place-items-center rounded-sm bg-sand text-maroon" aria-hidden>
<m.icon size={21} strokeWidth={1.8} />
                </span>
                <span className="min-w-0">
                  <span className="block text-[16px] font-bold leading-[22px] text-ink">{m.title}</span>
                  <span className="block text-small text-muted">{off ? CARD_PAYMENT.unavailable : m.subtitle}</span>
                </span>
              </button>

              {checked && m.id === 'card' && <p className="animate-fade-in px-4 pb-4 text-small text-muted">{CARD_PAYMENT.returnHint}</p>}

              {checked && m.id === 'cod' && totals && (
                <p className="animate-fade-in px-4 pb-4 text-small text-muted">{t('Please keep {total} ready. The courier carries change and a card machine.', { total: formatSAR(totals.total) })}</p>
              )}

              {checked && m.id === 'branch' && totals && <p className="animate-fade-in px-4 pb-4 text-small text-muted">{PICKUP.payAtBranchHint(formatSAR(totals.total))}</p>}
            </div>
          );
        })}
      </div>

      {!isDesktop && (
        <BottomBar>
          {!totals && !quoteError && <p className="mb-3 px-1 text-body text-muted">{t('Getting your total…')}</p>}
          {totals && (
            <div className="mb-3 flex items-baseline justify-between px-1">
              <span className="text-body text-muted">{t('Total · {count}', { count: totals.count })}{' '}{totals.count === 1 ? t('item') : t('items')}
              </span>
              <span className="tabular text-[18px] font-bold text-ink">{formatSAR(totals.total)}</span>
            </div>
          )}
          {cta}
        </BottomBar>
      )}
    </CheckoutLayout>
  );
}
