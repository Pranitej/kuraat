import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Banknote, CreditCard, Lock, Store, TriangleAlert } from 'lucide-react';
import ScreenHeader from '@/components/layout/ScreenHeader.jsx';
import BottomBar from '@/components/layout/BottomBar.jsx';
import { Button, RadioDot, Skeleton, TextField, Toggle } from '@/components/ui';
import { CheckoutLayout, CheckoutSteps, OrderSummary } from '@/components/checkout/CheckoutParts.jsx';
import DeliveryFromCard from '@/components/shop/DeliveryFromCard.jsx';
import { useAddresses } from '@/context/AddressContext.jsx';
import { useCart } from '@/context/CartContext.jsx';
import { useCheckout } from '@/context/CheckoutContext.jsx';
import { useOrders } from '@/context/OrderContext.jsx';
import { useToast } from '@/context/ToastContext.jsx';
import { useDeliveryQuote } from '@/hooks/useDeliveryQuote.js';
import { offeredMethod, toPaymentBody } from '@/services/orderService.js';
import { PICKUP, formatCardNumber, formatExpiry, formatSAR, onlyDigits, validateCardNumber, validateCvv, validateExpiry } from '@/domain';
import { ROUTES } from '@/config/routes.js';
import { useDocumentTitle, useIsDesktop } from '@/hooks';
import { cn } from '@/lib/cn.js';

// Saudi Arabia: card (incl. Mada) and cash on delivery; branch pickup pays now (card) or at the branch.
// UPI (shown in the PDF) was removed — it is India-only.
const DELIVERY_METHODS = [
  { id: 'card', title: 'Credit / debit card', subtitle: 'Visa, Mastercard, Mada', icon: CreditCard },
  { id: 'cod', title: 'Cash on delivery', subtitle: 'Pay when your order arrives', icon: Banknote },
];
const PICKUP_METHODS = [
  { id: 'card', title: PICKUP.payNow, subtitle: PICKUP.payNowSub, icon: CreditCard },
  { id: 'branch', title: PICKUP.payAtBranch, subtitle: PICKUP.payAtBranchSub, icon: Store },
];

/** Server field names → this form's error slots. */
const FIELD_ERRORS = { 'card.number': 'number', 'card.expiry': 'expiry', 'card.cvv': 'cvv' };

/** 14 · Payment */
export default function PaymentPage() {
  useDocumentTitle('Payment');
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
  const [card, setCard] = useState({ number: '', expiry: '', cvv: '' });
  const [save, setSave] = useState(true);
  const [errors, setErrors] = useState({});
  const [processing, setProcessing] = useState(false);

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

  const validate = () => {
    if (!totals) return false;
    let errs = {};
    if (method === 'card') errs = { number: validateCardNumber(card.number), expiry: validateExpiry(card.expiry), cvv: validateCvv(card.cvv) };
    setErrors(errs);
    return !Object.values(errs).some(Boolean);
  };

  const pay = async () => {
    if (processing || !validate()) return;
    setProcessing(true);
    setErrors({});
    try {
      await cart.flush(); // the server places the cart it has
      const order = await placeOrder({
        fulfilment: pickup ? 'pickup' : 'delivery',
        addressId: address?.id,
        payment: toPaymentBody(method, { card, saveCard: save }),
        idempotencyKey: ensureIdempotencyKey(),
      });
      cart.reload(); // the server emptied it
      checkout.reset({ lastOrderId: order.id, paymentMethod: method, fulfilment: pickup ? 'pickup' : 'delivery' });
      navigate(ROUTES.paymentSuccess(order.id), { replace: true });
    } catch (err) {
      if (err.code === 'idempotency_conflict') checkout.renewIdempotencyKey();
      setProcessing(false);
      setErrors({ form: err.message, ...(FIELD_ERRORS[err.field] ? { [FIELD_ERRORS[err.field]]: err.message } : {}) });
      toast.show(err.code === 'card_declined' ? 'Payment declined' : 'Payment could not be completed', { tone: 'error' });
    }
  };

  const later = method === 'cod' || method === 'branch';
  const payLabel = !totals ? 'Pay' : later ? `Place order · ${formatSAR(totals.total)}` : `Pay ${formatSAR(totals.total)}`;
  const cta = (
    <Button block leftIcon={later ? undefined : Lock} loading={processing} disabled={!totals} onClick={pay}>
      {payLabel}
    </Button>
  );

  return (
    <CheckoutLayout
      header={<ScreenHeader title="Payment" backFallback={ROUTES.delivery} />}
      steps={<CheckoutSteps current={2} />}
      aside={
        <div className="flex flex-col gap-4">
          {totals ? (
            <OrderSummary totals={totals} title="Order summary" />
          ) : quoteError ? null : (
            <div role="status" aria-busy="true" aria-label="Getting your total">
              <Skeleton className="h-[180px] rounded-xl" />
            </div>
          )}
          {delivery?.branch && <DeliveryFromCard icon="store" label={pickup ? PICKUP.likely : undefined} branch={delivery.branch} distanceKm={delivery.distanceKm} showDistance />}
          {cta}
        </div>
      }
    >
      <h2 className="text-h3 text-ink">Payment method</h2>
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
          <Button variant="secondary" size="sm" onClick={retryQuote}>
            Try again
          </Button>
        </div>
      )}

      <div role="radiogroup" aria-label="Payment method" className="mt-3 flex flex-col gap-3">
        {METHODS.map((m) => {
          const checked = method === m.id;
          return (
            <div key={m.id} className={cn('rounded-xl bg-white transition-[border-color]', checked ? 'border-[1.5px] border-maroon' : 'border border-line-subtle')}>
              <button
                type="button"
                role="radio"
                aria-checked={checked}
                disabled={processing}
                onClick={() => choose(m.id)}
                className="flex w-full items-center gap-3.5 p-4 text-left disabled:cursor-default"
              >
                <RadioDot checked={checked} />
                <span className="grid size-[42px] shrink-0 place-items-center rounded-sm bg-sand text-maroon" aria-hidden>
<m.icon size={21} strokeWidth={1.8} />
                </span>
                <span className="min-w-0">
                  <span className="block text-[16px] font-bold leading-[22px] text-ink">{m.title}</span>
                  <span className="block text-small text-muted">{m.subtitle}</span>
                </span>
              </button>

              {checked && m.id === 'card' && (
                <fieldset disabled={processing} className="animate-fade-in px-4 pb-4">
                  <legend className="sr-only">Card details</legend>
                  <TextField
                    label="Card number"
                    icon={CreditCard}
                    inputMode="numeric"
                    autoComplete="cc-number"
                    placeholder="1234 5678 9012 3456"
                    value={card.number}
                    onChange={(e) => setCard((c) => ({ ...c, number: formatCardNumber(e.target.value) }))}
                    trailing={<Lock size={18} strokeWidth={1.8} className="shrink-0 text-ink" aria-hidden />}
                    error={errors.number}
                  />
                  <div className="mt-4 grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3">
                    <TextField
                      label="Expiry"
                      inputMode="numeric"
                      autoComplete="cc-exp"
                      placeholder="MM / YY"
                      value={card.expiry}
                      onChange={(e) => {
                        const value = e.target.value;
                        setCard((c) => ({ ...c, expiry: formatExpiry(value, c.expiry) }));
                      }}
                      error={errors.expiry}
                    />
                    <TextField
                      label="CVV"
                      inputMode="numeric"
                      autoComplete="cc-csc"
                      type="password"
                      placeholder="•••"
                      maxLength={4}
                      value={card.cvv}
                      onChange={(e) => setCard((c) => ({ ...c, cvv: onlyDigits(e.target.value).slice(0, 4) }))}
                      error={errors.cvv}
                    />
                  </div>
                  <div className="mt-4 flex items-center justify-between gap-3">
                    <label htmlFor="save-card" className="text-[15px] font-semibold text-ink">
                      Save this card for next time
                    </label>
                    <Toggle id="save-card" checked={save} onChange={setSave} label="Save this card for next time" />
                  </div>
                </fieldset>
              )}

              {checked && m.id === 'cod' && totals && (
                <p className="animate-fade-in px-4 pb-4 text-small text-muted">
                  Please keep {formatSAR(totals.total)} ready. The courier carries change and a card machine.
                </p>
              )}

              {checked && m.id === 'branch' && totals && <p className="animate-fade-in px-4 pb-4 text-small text-muted">{PICKUP.payAtBranchHint(formatSAR(totals.total))}</p>}
            </div>
          );
        })}
      </div>

      {!isDesktop && (
        <BottomBar>
          {!totals && !quoteError && <p className="mb-3 px-1 text-body text-muted">Getting your total…</p>}
          {totals && (
            <div className="mb-3 flex items-baseline justify-between px-1">
              <span className="text-body text-muted">
                Total · {totals.count} {totals.count === 1 ? 'item' : 'items'}
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
