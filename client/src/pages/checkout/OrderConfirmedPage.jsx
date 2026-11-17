import { useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { Check, Clock, MapPin, Store } from 'lucide-react';
import { Button, Card, IconTile, MaroonPanel, Modal } from '@/components/ui';
import { useOrder } from '@/context/OrderContext.jsx';
import { PENDING_BRANCH, formatAddress, formatDistance, formatOrderDate, formatSAR, formatWindow } from '@/domain';
import { ROUTES } from '@/config/routes.js';
import { session } from '@/lib/storage.js';
import { useDocumentTitle } from '@/hooks';

/** 16 · Order confirmed + "delivered from" branch popup */
export default function OrderConfirmedPage() {
  useDocumentTitle('Order confirmed');
  const { orderId } = useParams();
  const navigate = useNavigate();
  const { order, loading } = useOrder(orderId);
  const popupKey = `branch-popup-seen:${orderId}`;
  const [popup, setPopup] = useState(() => !session.read(popupKey));

  if (!order && loading) return <div className="min-h-[60dvh]" aria-busy="true" />;
  if (!order) return <Navigate to={ROUTES.orders} replace />;
  // ROF assigns the branch (design 2026-11-18 §5.2); it may not have done so yet.
  const branch = order.branch;
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
        <h1 className="mt-5 text-title">Order confirmed!</h1>
        <p className="mt-1 text-body text-white/80">
          Order #{order.number} · {formatOrderDate(order.createdAt)}
        </p>
      </MaroonPanel>

      <div className="relative -mt-7 rounded-t-sheet bg-cream">
        <div className="mx-auto max-w-column px-5 pt-6 lg:max-w-[640px]">
          <div className="flex items-center gap-3.5 rounded-lg bg-sand px-4 py-3.5">
            <IconTile icon={Clock} tone="white" />
            <div>
              <p className="text-label font-normal text-muted">Estimated delivery</p>
              <p className="text-[18px] font-bold leading-6 text-ink">{formatWindow(order.window.start, order.window.end)}</p>
            </div>
          </div>

          <h2 className="mt-6 text-h3 text-ink">Your items</h2>
          <ul className="mt-3 flex flex-col gap-3">
            {order.items.map((item) => {
              return (
                <li key={item.productId} className="flex items-center gap-3.5">
                  {item.image ? (
                    <img src={item.image} alt="" className="size-14 shrink-0 rounded-sm object-cover" />
                  ) : (
                    <span className="size-14 shrink-0 rounded-sm bg-sand" aria-hidden />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-bold text-ink">{item.name}</p>
                    <p className="text-label font-normal text-muted">Qty {item.qty}</p>
                  </div>
                  <p className="tabular text-[15px] font-semibold text-ink">{formatSAR(item.price * item.qty)}</p>
                </li>
              );
            })}
          </ul>

          <Card className="mt-5 flex gap-3.5 p-4">
            <IconTile icon={MapPin} size={40} iconSize={19} />
            <div className="min-w-0">
              <p className="text-label font-normal text-muted">Delivering to</p>
              <p className="text-[15px] font-semibold leading-[21px] text-ink">{formatAddress(order.address)}</p>
            </div>
          </Card>

          <div className="mt-6 grid grid-cols-2 gap-3">
            <Button variant="secondary" to={ROUTES.order(order.id)} replace>
              Track order
            </Button>
            <Button to={ROUTES.home}>Back to home</Button>
          </div>
        </div>
      </div>

      <Modal open={popup} onClose={closePopup} labelledBy="branch-popup-title">
        <div className="flex flex-col items-center text-center">
          <IconTile icon={Store} size={72} iconSize={30} />
          <p className="mt-5 text-body text-muted">Your order will be delivered from</p>
          <h2 id="branch-popup-title" className="mt-1 text-[22px] font-bold leading-7 text-ink">
            {branch ? branch.name : PENDING_BRANCH.popupTitle}
          </h2>
          {branch ? (
            branch.address && <p className="mt-1.5 text-body text-muted">{branch.address}</p>
          ) : (
            <p className="mt-1.5 text-body text-muted">{PENDING_BRANCH.popupBody}</p>
          )}
          <div className="mt-5 flex w-full gap-3 rounded-lg bg-sand px-4 py-3.5 text-left text-[15px] leading-[22px] text-copy">
            <MapPin size={20} strokeWidth={1.8} className="mt-px shrink-0 text-maroon" aria-hidden />
            <p>
              {!branch
                ? PENDING_BRANCH.popupNote
                : order.distanceKm != null
                  ? `Chosen for your delivery address, ${formatDistance(order.distanceKm)} away. Stock confirmed at this branch.`
                  : 'Chosen for your delivery address. Stock confirmed at this branch.'}
            </p>
          </div>
          <Button block className="mt-6" onClick={closePopup} data-autofocus>
            Got it
          </Button>
          <button
            type="button"
            onClick={() => {
              closePopup();
              navigate(branch ? ROUTES.branch(branch.id) : ROUTES.order(order.id));
            }}
            className="mt-4 text-[15px] font-bold text-maroon hover:underline"
          >
            {branch ? 'View branch details' : 'Track order'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
