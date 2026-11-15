import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { ChevronRight, Plus } from 'lucide-react';
import ScreenHeader from '@/components/layout/ScreenHeader.jsx';
import BottomBar from '@/components/layout/BottomBar.jsx';
import { Button, PhoneField, RadioDot, Tag } from '@/components/ui';
import { CheckoutLayout, CheckoutSteps, OrderSummary } from '@/components/checkout/CheckoutParts.jsx';
import DeliveryFromCard from '@/components/shop/DeliveryFromCard.jsx';
import { useAddresses } from '@/context/AddressContext.jsx';
import { useAuth } from '@/context/AuthContext.jsx';
import { useCart } from '@/context/CartContext.jsx';
import { useCheckout } from '@/context/CheckoutContext.jsx';
import { useDeliveryBranch } from '@/hooks/useDeliveryBranch.js';
import { formatAddress, formatPhone, validateMobile } from '@/domain';
import { ROUTES } from '@/config/routes.js';
import { useDocumentTitle, useIsDesktop } from '@/hooks';
import { cn } from '@/lib/cn.js';

/** 13 · Delivery details */
export default function DeliveryPage() {
  useDocumentTitle('Delivery details');
  const navigate = useNavigate();
  const isDesktop = useIsDesktop();
  const { user } = useAuth();
  const { items, totals, promo } = useCart();
  const { addresses, defaultAddress } = useAddresses();
  const checkout = useCheckout();

  const selectedId = addresses.some((a) => a.id === checkout.addressId) ? checkout.addressId : defaultAddress?.id;
  const selected = addresses.find((a) => a.id === selectedId) || null;
  const [phone, setPhone] = useState(checkout.deliveryPhone || selected?.phone || user?.phone || '');
  const [phoneTouched, setPhoneTouched] = useState(Boolean(checkout.deliveryPhone));
  const [errors, setErrors] = useState({});
  const productIds = useMemo(() => items.map((i) => i.productId), [items]);
  const delivery = useDeliveryBranch(productIds, selected);

  // Follow the selected address's phone until the user edits the field
  useEffect(() => {
    if (!phoneTouched && selected?.phone) setPhone(selected.phone);
  }, [selected, phoneTouched]);

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
        {addresses.map((a) => {
          const checked = a.id === selectedId;
          return (
            <button
              key={a.id}
              type="button"
              role="radio"
              aria-checked={checked}
              onClick={() => select(a.id)}
              className={cn(
                'flex w-full gap-3.5 rounded-xl bg-white p-4 text-left transition-[border-color,box-shadow]',
                checked ? 'border-[1.5px] border-maroon' : 'border border-line-subtle hover:border-line',
              )}
            >
              <RadioDot checked={checked} className="mt-px" />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="text-[16px] font-bold leading-[22px] text-ink">{a.label}</span>
                  {a.isDefault && <Tag tone="dark">Default</Tag>}
                </span>
                <span className="mt-1 block text-body text-copy">{formatAddress(a)}</span>
                <span className="mt-1 block text-label font-normal text-muted">
                  {a.contactName || user?.name} · {formatPhone(a.phone)}
                </span>
              </span>
            </button>
          );
        })}
      </div>
      {errors.address && <p className="mt-2 text-label text-hotpink">{errors.address}</p>}

      <Link
        to={ROUTES.addressNew}
        state={{ returnTo: ROUTES.delivery }}
        className="mt-3 flex h-[54px] items-center justify-center gap-2 rounded-xl border border-dashed border-[#D9C1B5] text-[16px] font-bold text-maroon transition hover:bg-white/60"
      >
        <Plus size={20} strokeWidth={2} aria-hidden /> Add new address
      </Link>

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

      {!isDesktop && <BottomBar>{cta}</BottomBar>}
    </CheckoutLayout>
  );
}
