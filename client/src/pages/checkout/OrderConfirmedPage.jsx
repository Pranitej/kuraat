import { useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { Check, Clock, MapPin, Store } from 'lucide-react';
import { OrderItemImage } from '@/components/account/OrderParts.jsx';
import { Button, Card, IconTile, MaroonPanel, Modal } from '@/components/ui';
import { useOrder } from '@/context/OrderContext.jsx';
import { PENDING_BRANCH, PICKUP, formatAddress, formatDistance, formatOrderDate, formatSAR, formatWindow, isPickup } from '@/domain';
import { ROUTES } from '@/config/routes.js';
import { session } from '@/lib/storage.js';
import { useDocumentTitle } from '@/hooks';
import { t } from '@/i18n';

/** 16 · Order confirmed + "delivered from" branch popup */
export default function OrderConfirmedPage() {
  useDocumentTitle(t('Order confirmed'));
  const { orderId } = useParams();
  const navigate = useNavigate();
  const { order, loading } = useOrder(orderId);
  const popupKey = `branch-popup-seen:${orderId}`;
  const [popup, setPopup] = useState(() => !session.read(popupKey));

  if (!order && loading) return <div className="min-h-[60dvh]" aria-busy="true" />;
  if (!order) return <Navigate to={ROUTES.orders} replace />;
  // ROF assigns the branch (design 2026-11-18 §5.2); it may not have done so yet.
  const branch = order.branch;
  const pickup = isPickup(order);
  const closePopup = () => {
    session.write(popupKey, true);
    setPopup(false);
  };

  return (
    <div className="pb-10">
      <MaroonPanel className="pb-16 pt-12 text-center lg:pb-20 lg:pt-14">
        <div className="mx-auto grid size-[72px] animate-scale-in place-items-center rounded-full bg-white text-maroon">
          <Check size={34} strokeWidth={2.6} />
        </div>
        <h1 className="mt-5 text-title">{t('Order confirmed!')}</h1>
        <p className="mt-1 text-body text-white/80">{t('Order #{number} · {date}', { number: order.number, date: formatOrderDate(order.createdAt) })}</p>
      </MaroonPanel>

      <div className="relative -mt-7 rounded-t-sheet bg-cream">
        <div className="mx-auto max-w-column px-5 pt-6 lg:max-w-[640px]">
          <div className="flex items-center gap-3.5 rounded-lg bg-sand px-4 py-3.5">
            <IconTile icon={pickup ? Store : Clock} tone="white" />
            <div>
              <p className="text-label font-normal text-muted">{pickup ? PICKUP.confirmedCardLabel : t('Estimated delivery')}</p>
              <p className="text-[18px] font-bold leading-6 text-ink">
                {pickup ? t('Show #{number} at the pickup counter', { number: order.number }) : formatWindow(order.window.start, order.window.end)}
              </p>
            </div>
          </div>

          <h2 className="mt-6 text-h3 text-ink">{t('Your items')}</h2>
          <ul className="mt-3 flex flex-col gap-3">
            {order.items.map((item) => {
              return (
                <li key={item.productId} className="flex items-center gap-3.5">
                  <OrderItemImage productId={item.productId} className="size-14 shrink-0 rounded-sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-bold text-ink">{item.name}</p>
                    <p className="text-label font-normal text-muted">{t('Qty {qty}', { qty: item.qty })}</p>
                  </div>
                  <p className="tabular text-[15px] font-semibold text-ink">{formatSAR(item.price * item.qty)}</p>
                </li>
              );
            })}
          </ul>

          <Card className="mt-5 flex gap-3.5 p-4">
            <IconTile icon={MapPin} size={40} iconSize={19} />
            <div className="min-w-0">
              <p className="text-label font-normal text-muted">{pickup ? PICKUP.collectFrom : t('Delivering to')}</p>
              <p className="text-[15px] font-semibold leading-[21px] text-ink">
                {pickup ? (branch ? branch.name : PENDING_BRANCH.title) : formatAddress(order.address)}
              </p>
            </div>
          </Card>

          <div className="mt-6 grid grid-cols-2 gap-3">
            <Button variant="secondary" to={ROUTES.order(order.id)} replace>{t('Track order')}</Button>
            <Button to={ROUTES.home}>{t('Back to home')}</Button>
          </div>
        </div>
      </div>

      <Modal open={popup} onClose={closePopup} labelledBy="branch-popup-title">
        <div className="flex flex-col items-center text-center">
          <IconTile icon={Store} size={72} iconSize={30} />
          <p className="mt-5 text-body text-muted">{pickup ? PICKUP.confirmedLead : t('Your order will be delivered from')}</p>
          <h2 id="branch-popup-title" className="mt-1 text-[22px] font-bold leading-7 text-ink">
            {branch ? branch.name : PENDING_BRANCH.popupTitle}
          </h2>
          {branch ? (
            branch.address && <p className="mt-1.5 text-body text-muted">{branch.address}</p>
          ) : (
            <p className="mt-1.5 text-body text-muted">{PENDING_BRANCH.popupBody}</p>
          )}
          <div className="mt-5 flex w-full gap-3 rounded-lg bg-sand px-4 py-3.5 text-start text-[15px] leading-[22px] text-copy">
            <MapPin size={20} strokeWidth={1.8} className="mt-px shrink-0 text-maroon" aria-hidden />
            <p>
              {pickup
                ? PICKUP.confirmedNote
                : !branch
                  ? PENDING_BRANCH.popupNote
                  : order.distanceKm != null
                    ? t('Chosen for your delivery address, {distance} away. Stock confirmed at this branch.', { distance: formatDistance(order.distanceKm) })
                    : t('Chosen for your delivery address. Stock confirmed at this branch.')}
            </p>
          </div>
          <Button block className="mt-6" onClick={closePopup} data-autofocus>{t('Got it')}</Button>
          <button
            type="button"
            onClick={() => {
              closePopup();
              navigate(branch ? ROUTES.branch(branch.id) : ROUTES.order(order.id));
            }}
            className="mt-4 text-[15px] font-bold text-maroon hover:underline"
          >
            {branch ? t('View branch details') : t('Track order')}
          </button>
        </div>
      </Modal>
    </div>
  );
}
