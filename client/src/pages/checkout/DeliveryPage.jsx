import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import ScreenHeader from '@/components/layout/ScreenHeader.jsx';
import BottomBar from '@/components/layout/BottomBar.jsx';
import { Button, PhoneField } from '@/components/ui';
import { CheckoutLayout, CheckoutSteps, OrderSummary } from '@/components/checkout/CheckoutParts.jsx';
import DeliveryFromCard from '@/components/shop/DeliveryFromCard.jsx';
import { AddAddressTile, AddressOption } from '@/components/shop/DeliverTo.jsx';
import { useAddresses } from '@/context/AddressContext.jsx';
import { useAuth } from '@/context/AuthContext.jsx';
import { useCart } from '@/context/CartContext.jsx';
import { useCheckout } from '@/context/CheckoutContext.jsx';
import { useDeliveryQuote } from '@/hooks/useDeliveryQuote.js';
import { deliveryAddress, validateMobile } from '@/domain';
import { ROUTES } from '@/config/routes.js';
import { useDocumentTitle, useIsDesktop } from '@/hooks';

/** 13 · Delivery details */
export default function DeliveryPage() {
  useDocumentTitle('Delivery details');
  const navigate = useNavigate();
  const isDesktop = useIsDesktop();
  const { user } = useAuth();
  const { items, totals, promo, status: cartStatus } = useCart();
  const { addresses } = useAddresses();
  const checkout = useCheckout();
  const selected = deliveryAddress(addresses, checkout.addressId);
  const [phone, setPhone] = useState(checkout.deliveryPhone || selected?.phone || user?.phone || '');
  const [phoneTouched, setPhoneTouched] = useState(Boolean(checkout.deliveryPhone));
  const [errors, setErrors] = useState({});
  const productIds = useMemo(() => items.map((i) => i.productId), [items]);
  const { quote: delivery, error: quoteError } = useDeliveryQuote({ addressId: selected?.id, productIds });

  // Follow the selected address's phone until the user edits the field
  useEffect(() => {
    if (!phoneTouched && selected?.phone) setPhone(selected.phone);
  }, [selected, phoneTouched]);

  // After a reload the cart is still on its way from the server: wait instead of bouncing to the cart.
  if (!items.length && cartStatus === 'loading') return <div className="min-h-[60dvh]" aria-busy="true" />;
  if (!items.length) return <Navigate to={ROUTES.cart} replace />;

  const select = (id) => {
    checkout.patch({ addressId: id });
    setErrors((e) => ({ ...e, address: '' }));
  };

  const next = () => {
    const errs = { address: selected ? '' : 'Choose a delivery address', phone: validateMobile(phone) };
    setErrors(errs);
    if (errs.address || errs.phone) return;
    checkout.patch({ addressId: selected.id, deliveryPhone: phone });
    navigate(ROUTES.payment);
  };

  const cta = (
    <Button block rightIcon={ChevronRight} onClick={next}>
      Continue to payment
    </Button>
  );

  return (
    <CheckoutLayout
      header={<ScreenHeader title="Delivery details" backFallback={ROUTES.cart} />}
      steps={<CheckoutSteps current={1} />}
      aside={
        <div className="flex flex-col gap-4">
          <OrderSummary totals={totals} promo={promo} title="Order summary" />
          {cta}
        </div>
      }
    >
      <div className="flex items-center justify-between">
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

      <PhoneField
        className="mt-6"
        label="Phone number for this delivery"
        value={phone}
        onChange={(v) => {
          setPhone(v);
          setPhoneTouched(true);
          setErrors((e) => ({ ...e, phone: '' }));
        }}
        error={errors.phone}
        helper="The courier will call this number on arrival."
      />

      {delivery && (
        <DeliveryFromCard className="mt-5" icon="store" branch={delivery.branch} distanceKm={delivery.distanceKm} showDistance />
      )}
      {quoteError && (
        <p role="alert" className="mt-5 text-label text-hotpink">
          {quoteError.message}
        </p>
      )}

      {!isDesktop && <BottomBar>{cta}</BottomBar>}
    </CheckoutLayout>
  );
}
