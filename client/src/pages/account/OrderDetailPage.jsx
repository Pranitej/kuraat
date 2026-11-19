import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ChevronDown, Navigation, PackageSearch, PackageX, Phone, Store } from 'lucide-react';
import ScreenHeader from '@/components/layout/ScreenHeader.jsx';
import { Button, Card, ConfirmDialog, EmptyState, MaroonPanel, SummaryRow, WhatsAppIcon } from '@/components/ui';
import { OrderItemImage, OrderTimeline, RefreshButton, StatusTag, branchLabel } from '@/components/account/OrderParts.jsx';
import PaymentDueCard from '@/components/checkout/PaymentDueCard.jsx';
import { useOrder, useOrders } from '@/context/OrderContext.jsx';
import { useToast } from '@/context/ToastContext.jsx';
import { PENDING_BRANCH, PICKUP, cancelRefundText, directionsUrl, formatAddress, isPickup, formatPhone, formatSAR, orderHistoryView, orderStatusView, orderTimelineView, paymentLabel, telUrl } from '@/domain';
import { ROUTES } from '@/config/routes.js';
import { useCountdown, useDocumentTitle } from '@/hooks';
import { t } from '@/i18n';

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
      toast.show(t('We sent the delivery code again on WhatsApp'));
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
        <p>{t('Your delivery code is sent on WhatsApp. Share it with the courier when your order arrives.')}</p>
        <button
          type="button"
          onClick={resend}
          disabled={!order.canResendCode || sending || left > 0}
          className="mt-1 font-bold text-maroon hover:underline disabled:cursor-default disabled:no-underline disabled:opacity-60"
        >
          {left > 0 ? t('Resend in 0:{seconds}', { seconds: String(left).padStart(2, '0') }) : sending ? t('Sending…') : t('Resend code')}
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
  const [showHistory, setShowHistory] = useState(false);
  useDocumentTitle(order ? t('Order #{number}', { number: order.number }) : t('Order'));

  if (!order) {
    return (
      <div className="mx-auto max-w-column lg:max-w-[720px]">
        <ScreenHeader title={t('Order')} backFallback={ROUTES.orders} />
        {!loading && (
          <EmptyState icon={PackageSearch} title={t('Order not found')} message={t('We could not find this order on your account.')} actionLabel={t('View my orders')} actionTo={ROUTES.orders} />
        )}
      </div>
    );
  }

  const status = orderStatusView(order);
  const steps = orderTimelineView(order, now);
  const history = orderHistoryView(order, now);
  const branch = order.branch;
  const pickup = isPickup(order);

  const doCancel = async () => {
    setCancelling(true);
    try {
      await cancel();
      toast.show(t('Order cancelled'), { tone: 'info' });
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
          title={t('Order #{number}', { number: order.number })}
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
          {/* RSOF says this order is not paid yet (or the attempt failed / ran out): the customer can pay right here. */}
          {order.canPay && <PaymentDueCard order={order} onOrderPage />}
          <Card className="p-4">
            <OrderTimeline steps={steps} />
            {status.id === 'out_for_delivery' && <DeliveryCodeNote order={order} onResend={resendCode} />}
            {/* The full history is already in this order's reply: the button only shows it, it asks for nothing. */}
            {history.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={() => setShowHistory((v) => !v)}
                  aria-expanded={showHistory}
                  className="mt-4 flex w-full items-center justify-center gap-1.5 border-t border-divider pt-3 text-label font-bold text-maroon"
                >
                  {showHistory ? t('Hide full history') : t('View full history')}
                  <ChevronDown size={16} strokeWidth={2.2} aria-hidden className={`transition-transform ${showHistory ? 'rotate-180' : ''}`} />
                </button>
                {showHistory && (
                  <ul className="mt-3 flex flex-col gap-3" aria-label={t('Order history')}>
                    {history.map((h) => (
                      <li key={h.id}>
                        <div className="flex items-baseline justify-between gap-4">
                          <span className={`text-[15px] font-semibold ${h.cancelled ? 'text-hotpink' : 'text-ink'}`}>{h.title}</span>
                          <span className="tabular shrink-0 text-label font-normal text-muted">{h.time}</span>
                        </div>
                        {h.note && <p className="mt-0.5 text-label font-normal text-muted">{h.note}</p>}
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </Card>

          {pickup && status.ongoing && (
            // Branch pickup: the number to show at the counter (the dashboard's pickup counter searches by order number or phone).
            <Card className="p-4 text-center">
              <p className="text-label font-normal text-muted">{PICKUP.counterTitle}</p>
              <p className="tabular mt-1 text-title text-maroon">#{order.number}</p>
              <p className="mt-1 text-small text-muted">{PICKUP.counterHelp(order.number)}</p>
            </Card>
          )}

          {branch && (
            <MaroonPanel className="rounded-xl p-4">
              <div className="flex items-center gap-3">
                <span className="grid size-11 shrink-0 place-items-center rounded-full bg-white/[0.16]" aria-hidden>
                  <Store size={20} strokeWidth={1.8} />
                </span>
                <div className="min-w-0">
                  <p className="text-label font-normal text-white/80">{branchLabel(status, order)}</p>
                  <Link to={ROUTES.branch(branch.id)} className="block truncate text-[18px] font-bold leading-6 hover:underline">
                    {branch.name}
                  </Link>
                </div>
              </div>
              {branch.address && <p className="mt-2.5 text-small text-white/90">{branch.address}</p>}
              {(branch.phone || branch.location) && (
                <div className="mt-4 flex flex-wrap gap-3">
                  {branch.phone && (
                    <Button variant="glass" size="sm" leftIcon={Phone} href={telUrl(branch.phone)}>{t('Call branch')}</Button>
                  )}
                  {branch.location && (
                    <Button variant="glass" size="sm" leftIcon={Navigation} href={directionsUrl(branch.location)} target="_blank" rel="noreferrer">{t('Directions')}</Button>
                  )}
                </div>
              )}
            </MaroonPanel>
          )}
          {!branch && !status.cancelled && (
            // ROF has not assigned a branch yet: the same maroon branch card, without its buttons.
            <MaroonPanel className="rounded-xl p-4">
              <div className="flex items-center gap-3">
                <span className="grid size-11 shrink-0 place-items-center rounded-full bg-white/[0.16]" aria-hidden>
                  <Store size={20} strokeWidth={1.8} />
                </span>
                <div className="min-w-0">
                  <p className="text-label font-normal text-white/80">{branchLabel(status, order)}</p>
                  <p className="truncate text-[18px] font-bold leading-6">{PENDING_BRANCH.title}</p>
                </div>
              </div>
              <p className="mt-2.5 text-small text-white/90">{PENDING_BRANCH.body}</p>
            </MaroonPanel>
          )}
        </div>

        <div className="mt-3 flex flex-col gap-3 lg:mt-0 lg:gap-5">
          <Card className="p-4">
            <ul className="flex flex-col gap-3">
              {order.items.map((item) => (
                <li key={item.productId}>
                  <Link to={ROUTES.product(item.productId)} className="flex items-center gap-3.5 rounded-md transition hover:bg-cream/60">
                    <OrderItemImage productId={item.productId} className="size-14 shrink-0 rounded-sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[16px] font-semibold text-ink">{item.name}</span>
                      <span className="block text-label font-normal text-muted">{t('Qty {qty}', { qty: item.qty })}</span>
                    </span>
                    <span className="tabular text-[15px] font-bold text-ink">{item.price == null ? '' : formatSAR(item.price * item.qty)}</span>
                  </Link>
                </li>
              ))}
            </ul>
            <div className="my-3.5 h-px bg-divider" />
            <div className="flex flex-col gap-2.5">
              <SummaryRow label={t('Total')} value={order.total == null ? '—' : formatSAR(order.total)} />
            </div>
          </Card>

          <Card className="p-4">
            <dl className="flex flex-col gap-3">
              {[
                pickup ? [PICKUP.collectFrom, branch?.name ?? PENDING_BRANCH.title] : [t('Deliver to'), formatAddress(order.address)],
                [t('Phone'), formatPhone(order.deliveryPhone)],
                ...(order.payment ? [[t('Payment'), paymentLabel(order.payment)]] : []),
                // RSOF's own payment status (Paid / Payment pending / Payment failed …), shown as it comes
                ...(order.paymentStatus ? [[t('Payment status'), t(order.paymentStatus.label)]] : []),
              ].map(([label, value]) => (
                <div key={label} className="flex items-start justify-between gap-6">
                  <dt className="shrink-0 text-body text-muted">{label}</dt>
                  <dd className="text-end text-[15px] font-semibold leading-[21px] text-ink">{value}</dd>
                </div>
              ))}
            </dl>
          </Card>

          {order.canCancel && (
            <Button variant="secondary" block onClick={() => setConfirmCancel(true)}>{t('Cancel order')}</Button>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirmCancel}
        onClose={() => setConfirmCancel(false)}
        onConfirm={doCancel}
        loading={cancelling}
        icon={PackageX}
        title={t('Cancel this order?')}
        message={`${t('You can cancel until the branch starts preparing it.')} ${cancelRefundText(order)}`}
        confirmLabel={t('Cancel order')}
        cancelLabel={t('Keep order')}
      />
    </div>
  );
}
