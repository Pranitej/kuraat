import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Banknote, CreditCard, Lock, TriangleAlert } from 'lucide-react';
import ScreenHeader from '@/components/layout/ScreenHeader.jsx';
import BottomBar from '@/components/layout/BottomBar.jsx';
import { Button, RadioDot, TextField, Toggle } from '@/components/ui';
import { CheckoutLayout, CheckoutSteps, OrderSummary } from '@/components/checkout/CheckoutParts.jsx';
import DeliveryFromCard from '@/components/shop/DeliveryFromCard.jsx';
import { useAddresses } from '@/context/AddressContext.jsx';
import { useCart } from '@/context/CartContext.jsx';
import { useCheckout } from '@/context/CheckoutContext.jsx';
import { useOrders } from '@/context/OrderContext.jsx';
import { useToast } from '@/context/ToastContext.jsx';
import { useDeliveryQuote } from '@/hooks/useDeliveryQuote.js';
import { toPaymentBody } from '@/services/orderService.js';
import { formatCardNumber, formatExpiry, formatSAR, onlyDigits, validateCardNumber, validateCvv, validateExpiry, validateUpi } from '@/domain';
import { ROUTES } from '@/config/routes.js';
import { useDocumentTitle, useIsDesktop } from '@/hooks';
import { cn } from '@/lib/cn.js';

const METHODS = [
  { id: 'card', title: 'Credit / debit card', subtitle: 'Visa, Mastercard, Mada', icon: CreditCard },
  { id: 'upi', title: 'UPI', subtitle: 'Pay with any UPI app', text: 'UPI' },
  { id: 'cod', title: 'Cash on delivery', subtitle: 'Pay when your order arrives', icon: Banknote },
];

/** Server field names → this form's error slots. */
const FIELD_ERRORS = { 'card.number': 'number', 'card.expiry': 'expiry', 'card.cvv': 'cvv', upiId: 'upi' };

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
  const address = addresses.find((a) => a.id === checkout.addressId) || defaultAddress;
  const { quote: delivery } = useDeliveryQuote({ addressId: address?.id, productIds: cart.items.map((i) => i.productId) });
  const { ensureIdempotencyKey } = checkout;

  // One key per checkout, made when the payment screen opens and reused on every retry.
  useEffect(() => {
    ensureIdempotencyKey();
  }, [ensureIdempotencyKey]);

  const [method, setMethod] = useState(checkout.paymentMethod || 'card');
  const [card, setCard] = useState({ number: '', expiry: '', cvv: '' });
  const [save, setSave] = useState(true);
  const [upiId, setUpiId] = useState('');
  const [errors, setErrors] = useState({});
  const [processing, setProcessing] = useState(false);

  // After a reload the cart and addresses are still on their way from the server: wait for them.
  if (!processing && ((!cart.items.length && cart.status === 'loading') || !addressesLoaded)) return <div className="min-h-[60dvh]" aria-busy="true" />;
  if (!cart.items.length && !processing) return <Navigate to={ROUTES.cart} replace />;
  if (!address && !processing) return <Navigate to={ROUTES.delivery} replace />;

  const { totals } = cart;
  const choose = (id) => {
    setMethod(id);
    setErrors({});
    checkout.patch({ paymentMethod: id });
  };

  const validate = () => {
    let errs = {};
    if (method === 'card') errs = { number: validateCardNumber(card.number), expiry: validateExpiry(card.expiry), cvv: validateCvv(card.cvv) };
    if (method === 'upi') errs = { upi: validateUpi(upiId) };
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
        addressId: address.id,
        deliveryPhone: checkout.deliveryPhone || address.phone,
        payment: toPaymentBody(method, { card, upiId, saveCard: save }),
        idempotencyKey: ensureIdempotencyKey(),
      });
      cart.reload(); // the server emptied it
      checkout.reset({ lastOrderId: order.id, paymentMethod: method });
      navigate(ROUTES.paymentSuccess(order.id), { replace: true });
    } catch (err) {
      if (err.code === 'idempotency_conflict') checkout.renewIdempotencyKey();
      setProcessing(false);
      setErrors({ form: err.message, ...(FIELD_ERRORS[err.field] ? { [FIELD_ERRORS[err.field]]: err.message } : {}) });
      toast.show(err.code === 'card_declined' ? 'Payment declined' : 'Payment could not be completed', { tone: 'error' });
    }
  };

  const payLabel = method === 'cod' ? `Place order · ${formatSAR(totals.total)}` : `Pay ${formatSAR(totals.total)}`;
  const cta = (
    <Button block leftIcon={method === 'cod' ? undefined : Lock} loading={processing} onClick={pay}>
      {payLabel}
    </Button>
  );

  return (
    <CheckoutLayout
      header={<ScreenHeader title="Payment" backFallback={ROUTES.delivery} />}
      steps={<CheckoutSteps current={2} />}
      aside={
        <div className="flex flex-col gap-4">
          <OrderSummary totals={totals} promo={cart.promo} title="Order summary" />
          {delivery && <DeliveryFromCard icon="store" branch={delivery.branch} distanceKm={delivery.distanceKm} showDistance />}
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
                  {m.icon ? <m.icon size={21} strokeWidth={1.8} /> : <span className="text-[13px] font-bold">{m.text}</span>}
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

              {checked && m.id === 'upi' && (
                <div className="animate-fade-in px-4 pb-4">
                  <TextField
                    label="UPI ID"
                    placeholder="name@bank"
                    autoComplete="off"
                    value={upiId}
                    disabled={processing}
                    onChange={(e) => setUpiId(e.target.value)}
                    error={errors.upi}
                    helper="You will approve the payment in your UPI app."
                  />
                </div>
              )}

              {checked && m.id === 'cod' && (
                <p className="animate-fade-in px-4 pb-4 text-small text-muted">
                  Please keep {formatSAR(totals.total)} ready. The courier carries change and a card machine.
                </p>
              )}
            </div>
          );
        })}
      </div>

      {!isDesktop && (
        <BottomBar>
          <div className="mb-3 flex items-baseline justify-between px-1">
            <span className="text-body text-muted">
              Total · {totals.count} {totals.count === 1 ? 'item' : 'items'}
            </span>
            <span className="tabular text-[18px] font-bold text-ink">{formatSAR(totals.total)}</span>
          </div>
          {cta}
        </BottomBar>
      )}
    </CheckoutLayout>
  );
}
