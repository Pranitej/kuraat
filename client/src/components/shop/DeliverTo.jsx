import { useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronDown, MapPin, Plus } from 'lucide-react';
import { IconTile, RadioDot, Sheet, Tag } from '@/components/ui';
import { useAddresses } from '@/context/AddressContext.jsx';
import { useAuth } from '@/context/AuthContext.jsx';
import { useCheckout } from '@/context/CheckoutContext.jsx';
import { useToast } from '@/context/ToastContext.jsx';
import { deliverToLabel, deliveryAddress, formatAddress } from '@/domain';
import { ROUTES } from '@/config/routes.js';
import { cn } from '@/lib/cn.js';
import { t } from '@/i18n';

/**
 * The address we deliver to, shared by Home and checkout (checkout draft → default → first).
 * Choosing one on Home also makes it the default, so the choice is still there next time.
 */
export function useDeliveryAddress() {
  const { addresses, loaded, setDefault } = useAddresses();
  const checkout = useCheckout();
  const toast = useToast();
  const address = deliveryAddress(addresses, checkout.addressId);

  const choose = useCallback(
    (id, { makeDefault = false } = {}) => {
      checkout.patch({ addressId: id });
      const target = addresses.find((a) => a.id === id);
      if (makeDefault && target && !target.isDefault) {
        setDefault(id).catch((err) => toast.show(err.message, { tone: 'error' }));
      }
    },
    [addresses, checkout, setDefault, toast],
  );

  return { address, addresses, loaded, choose };
}

/** Address radio card (PDF 13): radio · label + Default tag · address · "Name · phone". */
export function AddressOption({ address, checked, onSelect }) {
  const { user } = useAuth();
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      onClick={() => onSelect(address.id)}
      className={cn(
        'flex w-full gap-3.5 rounded-xl bg-white p-4 text-start transition-[border-color,box-shadow]',
        checked ? 'border-[1.5px] border-maroon' : 'border border-line-subtle hover:border-line',
      )}
    >
      <RadioDot checked={checked} className="mt-px" />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate text-[16px] font-bold leading-[22px] text-ink">{address.label}</span>
          {address.isDefault && <Tag tone="dark">{t('Default')}</Tag>}
        </span>
        <span className="mt-1 block text-body text-copy">{formatAddress(address)}</span>
        <span className="mt-1 block text-label font-normal text-muted">
          {address.contactName || user?.name}
        </span>
      </span>
    </button>
  );
}

/** Dashed "+ Add new address" tile (PDF 13). */
export function AddAddressTile({ returnTo, className }) {
  return (
    <Link
      to={ROUTES.addressNew}
      state={{ returnTo }}
      className={cn(
        'flex h-[54px] items-center justify-center gap-2 rounded-xl border border-dashed border-[#D9C1B5] text-[16px] font-bold text-maroon transition hover:bg-white/60',
        className,
      )}
    >
      <Plus size={20} strokeWidth={2} aria-hidden />{' '}{t('Add new address')}</Link>
  );
}

/** Home: "Deliver to / Home · Al Rakah, Al Khobar ⌄" — opens the address sheet (or Add address). */
export function DeliverToBar({ address, loaded, onOpen, className }) {
  const navigate = useNavigate();
  const empty = loaded && !address;
  return (
    <button
      type="button"
      onClick={empty ? () => navigate(ROUTES.addressNew, { state: { returnTo: ROUTES.home } }) : onOpen}
      disabled={!loaded}
      aria-haspopup={empty ? undefined : 'dialog'}
      className={cn('group flex w-full min-w-0 items-center gap-3 rounded-xl py-1 text-start disabled:cursor-default lg:w-auto lg:max-w-[560px]', className)}
    >
      <IconTile icon={MapPin} size={40} iconSize={19} />
      <span className="min-w-0 flex-1">
        <span className="block text-label font-normal text-muted">{t('Deliver to')}</span>
        {!loaded ? (
          <span className="skeleton mt-1 block h-4 w-44 rounded" aria-label={t('Loading your address')} />
        ) : (
          <span className="flex min-w-0 items-center gap-1 text-[15px] font-bold leading-5 text-ink">
            <span className="truncate group-hover:underline">{empty ? t('Add a delivery address') : deliverToLabel(address)}</span>
            {empty ? (
              <Plus size={18} strokeWidth={2} className="shrink-0 text-maroon" aria-hidden />
            ) : (
              <ChevronDown size={18} strokeWidth={2} className="shrink-0 text-maroon" aria-hidden />
            )}
          </span>
        )}
      </span>
    </button>
  );
}

/** "Deliver to" sheet: saved addresses as radio cards, add, manage. Choosing closes it. */
export function DeliverToSheet({ open, onClose, selectedId, addresses, onChoose }) {
  return (
    <Sheet open={open} onClose={onClose} title={t('Deliver to')}>
      <p className="text-small text-muted">{t('The branch nearest to this address prepares your order.')}</p>
      <div role="radiogroup" aria-label={t('Delivery address')} className="mt-4 flex flex-col gap-3">
        {addresses.map((a) => (
          <AddressOption
            key={a.id}
            address={a}
            checked={a.id === selectedId}
            onSelect={(id) => {
              onChoose(id);
              onClose();
            }}
          />
        ))}
      </div>
      <AddAddressTile returnTo={ROUTES.home} className="mt-3" />
      <Link to={ROUTES.addresses} className="mx-auto mt-4 block w-fit pb-2 text-[15px] font-bold text-maroon hover:underline">{t('Manage saved addresses')}</Link>
    </Sheet>
  );
}
