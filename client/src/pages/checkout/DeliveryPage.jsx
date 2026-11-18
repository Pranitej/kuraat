import { useMemo, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { ChevronRight, Store } from 'lucide-react';
import ScreenHeader from '@/components/layout/ScreenHeader.jsx';
import BottomBar from '@/components/layout/BottomBar.jsx';
import { Button, InfoBanner, PhoneField, SegmentedControl, Skeleton } from '@/components/ui';
import { CheckoutLayout, CheckoutSteps, OrderSummary } from '@/components/checkout/CheckoutParts.jsx';
import DeliveryFromCard from '@/components/shop/DeliveryFromCard.jsx';
import { AddAddressTile, AddressOption } from '@/components/shop/DeliverTo.jsx';
import { useAddresses } from '@/context/AddressContext.jsx';
import { useAuth } from '@/context/AuthContext.jsx';
import { useCart } from '@/context/CartContext.jsx';
import { useCheckout } from '@/context/CheckoutContext.jsx';
import { useDeliveryQuote } from '@/hooks/useDeliveryQuote.js';
import { PICKUP, deliveryAddress } from '@/domain';
import { offeredMethod } from '@/services/orderService.js';
import { ROUTES } from '@/config/routes.js';
import { useDocumentTitle, useIsDesktop } from '@/hooks';

/** 13 · Delivery details (and, for branch pickup, Pickup details) */
export default function DeliveryPage() {
  const checkout = useCheckout();
  const pickup = checkout.fulfilment === 'pickup';
  useDocumentTitle(pickup ? 'Pickup details' : 'Delivery details');
  const navigate = useNavigate();
  const isDesktop = useIsDesktop();
  const { user } = useAuth();
  const { items, totals, status: cartStatus } = useCart();
  const { addresses } = useAddresses();
  const selected = deliveryAddress(addresses, checkout.addressId);
  const [errors, setErrors] = useState({});
  const productIds = useMemo(() => items.map((i) => i.productId), [items]);
  const { quote: delivery, error: quoteError } = useDeliveryQuote({ addressId: pickup ? null : selected?.id, productIds, fulfilment: pickup ? 'pickup' : 'delivery' });

  // After a reload the cart is still on its way from the server: wait instead of bouncing to the cart.
  if (!items.length && cartStatus === 'loading') return <div className="min-h-[60dvh]" aria-busy="true" />;
  if (!items.length) return <Navigate to={ROUTES.cart} replace />;

  const select = (id) => {
    checkout.patch({ addressId: id });
    setErrors((e) => ({ ...e, address: '' }));
  };

  // Delivery or pickup: the payment methods differ, so a remembered one that the other way does not
  // offer falls back to card.
  const chooseFulfilment = (value) => {
    setErrors({});
    checkout.patch({ fulfilment: value, paymentMethod: offeredMethod(checkout.paymentMethod, value) });
  };

  const next = () => {
    const errs = { address: pickup || selected ? '' : 'Choose a delivery address' };
    setErrors(errs);
    if (errs.address) return;
    if (!pickup) checkout.patch({ addressId: selected.id });
    navigate(ROUTES.payment);
  };

  const summary = pickup ? (
    delivery?.totals ? <OrderSummary totals={delivery.totals} title="Order summary" /> : <Skeleton className="h-[180px] rounded-xl" />
  ) : (
    <OrderSummary totals={totals} title="Order summary" />
  );

  const cta = (
    <Button block rightIcon={ChevronRight} onClick={next}>
      Continue to payment
    </Button>
  );

  return (
    <CheckoutLayout
      header={<ScreenHeader title={pickup ? 'Pickup details' : 'Delivery details'} backFallback={ROUTES.cart} />}
      steps={<CheckoutSteps current={1} />}
      aside={
        <div className="flex flex-col gap-4">
          {summary}
          {cta}
        </div>
      }
    >
      <SegmentedControl
        label={PICKUP.switchLabel}
        options={[
          { value: 'delivery', label: PICKUP.delivery },
          { value: 'pickup', label: PICKUP.pickup },
        ]}
        value={pickup ? 'pickup' : 'delivery'}
        onChange={chooseFulfilment}
      />

      {pickup ? (
        <>
          <InfoBanner icon={Store} className="mt-5">
            {PICKUP.note}
          </InfoBanner>
          {/* The order always carries the account's number (it cannot be edited here): RSOF finds the customer's orders by it. */}
          <PhoneField className="mt-6" label={PICKUP.phoneLabel} value={user?.phone || ''} onChange={() => {}} disabled helper={PICKUP.phoneHelper} />
          {delivery?.branch && <DeliveryFromCard className="mt-5" icon="store" label={PICKUP.likely} branch={delivery.branch} distanceKm={delivery.distanceKm} showDistance />}
          {quoteError && (
            <p role="alert" className="mt-5 text-label text-hotpink">
              {quoteError.message}
            </p>
          )}
        </>
      ) : (
        <>
      <div className="mt-6 flex items-center justify-between">
        <h2 className="text-h3 text-ink">Deliver to</h2>
        <Link to={ROUTES.addresses} className="text-[15px] font-bold text-maroon hover:underline">
          Manage
        </Link>
      </div>

      <div role="radiogroup" aria-label="Delivery address" className="mt-3 flex flex-col gap-3">
        {addresses.map((a) => (
          <AddressOption key={a.id} address={a} checked={a.id === selected?.id} onSelect={select} />
        ))}
      </div>
      {errors.address && <p className="mt-2 text-label text-hotpink">{errors.address}</p>}

      <AddAddressTile returnTo={ROUTES.delivery} className="mt-3" />

      {/* The order always carries the account's number (it cannot be edited here): RSOF finds the customer's orders by it. */}
      <PhoneField
        className="mt-6"
        label="Phone number for this delivery"
        value={user?.phone || ''}
        onChange={() => {}}
        disabled
        helper="Your account's mobile number. The courier will call it on arrival."
      />

      {delivery?.branch && (
        <DeliveryFromCard className="mt-5" icon="store" branch={delivery.branch} distanceKm={delivery.distanceKm} showDistance />
      )}
      {quoteError && (
        <p role="alert" className="mt-5 text-label text-hotpink">
          {quoteError.message}
        </p>
      )}
        </>
      )}

      {!isDesktop && <BottomBar>{cta}</BottomBar>}
    </CheckoutLayout>
  );
}
