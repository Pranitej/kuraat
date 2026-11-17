import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Navigation, PackageSearch, PackageX, Phone, Store } from 'lucide-react';
import ScreenHeader from '@/components/layout/ScreenHeader.jsx';
import { Button, Card, ConfirmDialog, EmptyState, MaroonPanel, SummaryRow, WhatsAppIcon } from '@/components/ui';
import { OrderTimeline, RefreshButton, StatusTag, branchLabel } from '@/components/account/OrderParts.jsx';
import { useOrder, useOrders } from '@/context/OrderContext.jsx';
import { useToast } from '@/context/ToastContext.jsx';
import { directionsUrl, formatAddress, formatPhone, formatSAR, orderStatusView, orderTimelineView, paymentLabel, telUrl } from '@/domain';
import { ROUTES } from '@/config/routes.js';
import { useCountdown, useDocumentTitle } from '@/hooks';

function refundText(order) {
  if (!order.payment || order.payment.method === 'cod') return 'Nothing has been charged.';
  return `We will refund ${formatSAR(order.total)} to ${paymentLabel(order.payment)}.`;
}

/** "Your delivery code is sent on WhatsApp" + Resend (only while RSOF says out for delivery). */
function DeliveryCodeNote({ order, onResend }) {
  const [resendAt, setResendAt] = useState(0);
  const [sending, setSending] = useState(false);
  const toast = useToast();
  const left = useCountdown(resendAt);

  const resend = async () => {
    setSending(true);
    try {
      const result = await onResend();
      setResendAt(Date.parse(result.resendAt));
      toast.show('We sent the delivery code again on WhatsApp');
    } catch (err) {
      toast.show(err.message, { tone: 'error' });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="mt-4 flex items-start gap-3 rounded-lg bg-sand px-4 py-3.5">
      <WhatsAppIcon size={20} className="mt-0.5 shrink-0 text-maroon" />
      <div className="min-w-0 flex-1 text-[15px] leading-[22px] text-copy">
        <p>Your delivery code is sent on WhatsApp. Share it with the courier when your order arrives.</p>
        <button
          type="button"
          onClick={resend}
          disabled={!order.canResendCode || sending || left > 0}
          className="mt-1 font-bold text-maroon hover:underline disabled:cursor-default disabled:no-underline disabled:opacity-60"
        >
          {left > 0 ? `Resend in 0:${String(left).padStart(2, '0')}` : sending ? 'Sending…' : 'Resend code'}
        </button>
      </div>
    </div>
  );
}

/** 22 · Order detail / tracking */
export default function OrderDetailPage() {
  const { orderId } = useParams();
  const { now } = useOrders();
  const { order, loading, cancel, resendCode, refresh } = useOrder(orderId);
  const toast = useToast();
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  useDocumentTitle(order ? `Order #${order.number}` : 'Order');

  if (!order) {
    return (
      <div className="mx-auto max-w-column lg:max-w-[720px]">
        <ScreenHeader title="Order" backFallback={ROUTES.orders} />
        {!loading && (
          <EmptyState icon={PackageSearch} title="Order not found" message="We could not find this order on your account." actionLabel="View my orders" actionTo={ROUTES.orders} />
        )}
      </div>
    );
  }

  const status = orderStatusView(order);
  const steps = orderTimelineView(order, now);
  const branch = order.branch;

  const doCancel = async () => {
    setCancelling(true);
    try {
      await cancel();
      toast.show('Order cancelled', { tone: 'info' });
    } catch (err) {
      toast.show(err.message, { tone: 'error' });
    } finally {
      setCancelling(false);
      setConfirmCancel(false);
    }
  };

  return (
    <div className="pb-10">
      <div className="mx-auto max-w-column lg:max-w-[1080px] lg:px-8">
        <ScreenHeader
          title={`Order #${order.number}`}
          backFallback={ROUTES.orders}
          right={
            <span className="flex items-center gap-2">
              {/* Phones: the tag sits above the timeline so the order number keeps its room. */}
              <StatusTag status={status} className="hidden sm:inline-flex" />
              <RefreshButton onRefresh={() => refresh({ force: true })} />
            </span>
          }
        />
      </div>
      <div className="mx-auto max-w-column px-5 lg:grid lg:max-w-[1080px] lg:grid-cols-2 lg:items-start lg:gap-8 lg:px-8">
        <div className="flex flex-col gap-3 lg:gap-5">
          <StatusTag status={status} className="self-start sm:hidden" />
          <Card className="p-4">
            <OrderTimeline steps={steps} />
            {status.id === 'out_for_delivery' && <DeliveryCodeNote order={order} onResend={resendCode} />}
          </Card>

          {branch && (
            <MaroonPanel className="rounded-xl p-4">
              <div className="flex items-center gap-3">
                <span className="grid size-11 shrink-0 place-items-center rounded-full bg-white/[0.16]" aria-hidden>
                  <Store size={20} strokeWidth={1.8} />
                </span>
                <div className="min-w-0">
                  <p className="text-label font-normal text-white/80">{branchLabel(status)}</p>
                  <Link to={ROUTES.branch(branch.id)} className="block truncate text-[18px] font-bold leading-6 hover:underline">
                    {branch.name}
                  </Link>
                </div>
              </div>
              {branch.address && <p className="mt-2.5 text-small text-white/90">{branch.address}</p>}
              {(branch.phone || branch.location) && (
                <div className="mt-4 flex flex-wrap gap-3">
                  {branch.phone && (
                    <Button variant="glass" size="sm" leftIcon={Phone} href={telUrl(branch.phone)}>
                      Call branch
                    </Button>
                  )}
                  {branch.location && (
                    <Button variant="glass" size="sm" leftIcon={Navigation} href={directionsUrl(branch.location)} target="_blank" rel="noreferrer">
                      Directions
                    </Button>
                  )}
                </div>
              )}
            </MaroonPanel>
          )}
        </div>

        <div className="mt-3 flex flex-col gap-3 lg:mt-0 lg:gap-5">
          <Card className="p-4">
            <ul className="flex flex-col gap-3">
              {order.items.map((item) => (
                <li key={item.productId}>
                  <Link to={ROUTES.product(item.productId)} className="flex items-center gap-3.5 rounded-md transition hover:bg-cream/60">
                    {item.image ? (
                      <img src={item.image} alt="" className="size-14 shrink-0 rounded-sm object-cover" />
                    ) : (
                      <span className="size-14 shrink-0 rounded-sm bg-sand" aria-hidden />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[16px] font-semibold text-ink">{item.name}</span>
                      <span className="block text-label font-normal text-muted">Qty {item.qty}</span>
                    </span>
                    <span className="tabular text-[15px] font-bold text-ink">{formatSAR(item.price * item.qty)}</span>
                  </Link>
                </li>
              ))}
            </ul>
            <div className="my-3.5 h-px bg-divider" />
            <div className="flex flex-col gap-2.5">
              {order.discount > 0 && <SummaryRow label={`Discount (${order.promoCode})`} value={`− ${formatSAR(order.discount)}`} />}
              <SummaryRow label="Delivery" value={order.deliveryFee === 0 ? 'Free' : formatSAR(order.deliveryFee)} />
              <SummaryRow label="Total (incl. VAT)" value={formatSAR(order.total)} />
            </div>
          </Card>

          <Card className="p-4">
            <dl className="flex flex-col gap-3">
              {[
                ['Deliver to', formatAddress(order.address)],
                ['Phone', formatPhone(order.deliveryPhone)],
                ['Payment', paymentLabel(order.payment)],
              ].map(([label, value]) => (
                <div key={label} className="flex items-start justify-between gap-6">
                  <dt className="shrink-0 text-body text-muted">{label}</dt>
                  <dd className="text-right text-[15px] font-semibold leading-[21px] text-ink">{value}</dd>
                </div>
              ))}
            </dl>
          </Card>

          {order.canCancel && (
            <Button variant="secondary" block onClick={() => setConfirmCancel(true)}>
              Cancel order
            </Button>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirmCancel}
        onClose={() => setConfirmCancel(false)}
        onConfirm={doCancel}
        loading={cancelling}
        icon={PackageX}
        title="Cancel this order?"
        message={`You can cancel until the branch starts preparing it. ${refundText(order)}`}
        confirmLabel="Cancel order"
        cancelLabel="Keep order"
      />
    </div>
  );
}
