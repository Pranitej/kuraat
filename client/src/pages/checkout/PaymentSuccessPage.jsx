import { useEffect, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { Check } from 'lucide-react';
import PaymentDueCard from '@/components/checkout/PaymentDueCard.jsx';
import { Button, Card, CirclePattern, ProgressBar, WhatsAppIcon } from '@/components/ui';
import { useOrder, useOrders } from '@/context/OrderContext.jsx';
import { CARD_PAYMENT, PENDING_BRANCH, PICKUP, formatDateTime, formatOrderNumber, formatSAR, isOnlinePayment, paymentLabel } from '@/domain';
import { ROUTES } from '@/config/routes.js';
import { useDocumentTitle } from '@/hooks';
import { ltr, t } from '@/i18n';

/**
 * 15 · Payment successful — then confirms the order with the branch before continuing.
 * An online-payment order is paid on RSOF's secure payment page after it is placed (19 Nov 2026): this screen is then
 * "Complete your payment" — Pay, and a button to the Orders page where RSOF's own status is. Nothing else is checked.
 */
export default function PaymentSuccessPage() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const { order, loading } = useOrder(orderId);
  const { refresh: refreshOrders } = useOrders();
  // The Orders page, with the latest status of every order (read fresh from RSOF while it opens).
  const toOrders = () => {
    refreshOrders({ force: true }).catch(() => {});
    navigate(ROUTES.orders, { replace: true });
  };
  const online = isOnlinePayment(order);
  // Cash on delivery and pay at the branch: placed now, paid later.
  const later = order?.payment?.method === 'cod' || order?.payment?.method === 'branch';
  useDocumentTitle(online ? CARD_PAYMENT.waitingTitle : later ? t('Order placed') : t('Payment successful'));
  const [progress, setProgress] = useState(8);
  const confirmed = progress >= 100;

  useEffect(() => {
    if (!order?.id || online) return undefined;
    const steps = [
      [500, 34],
      [1200, 58],
      [2000, 76],
      [2900, 100],
    ];
    const timers = steps.map(([t, v]) => setTimeout(() => setProgress(v), t));
    return () => timers.forEach(clearTimeout);
  }, [order?.id, online]);

  if (!order && loading) return <div className="min-h-[calc(100dvh-76px)]" aria-busy="true" />;
  if (!order) return <Navigate to={ROUTES.orders} replace />;

  if (online) {
    return (
      <div className="relative isolate min-h-[calc(100dvh-76px)] overflow-hidden">
        <CirclePattern variant="sand" fade="down" className="-z-10 h-[420px]" />
        <div className="mx-auto flex min-h-[calc(100dvh-76px)] max-w-column flex-col px-5 pb-[max(24px,env(safe-area-inset-bottom))] pt-16 lg:max-w-[520px] lg:pt-20">
          <h1 className="text-center text-title text-ink">{CARD_PAYMENT.waitingTitle}</h1>
          <p className="mt-2 text-center text-body text-muted">{t('Order #{number}', { number: order.number })}</p>
          <PaymentDueCard order={order} className="mt-6" />
          <div className="mt-auto pt-10">
            <Button block variant="secondary" onClick={toOrders}>
              {CARD_PAYMENT.viewOrders}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const rows = later
    ? [
        [t('Order number'), formatOrderNumber(order.number)],
        [t('Date'), formatDateTime(order.createdAt)],
        [t('Method'), paymentLabel(order.payment)],
        [t('Amount due'), formatSAR(order.total)],
      ]
    : [
        // Older simulated card payments (no new ones): they have a transaction id.
        order.payment?.transactionId ? [t('Transaction ID'), ltr(order.payment.transactionId)] : [t('Order number'), formatOrderNumber(order.number)],
        [t('Date'), formatDateTime(order.payment?.paidAt || order.createdAt)],
        [t('Method'), paymentLabel(order.payment)],
        [t('Amount'), formatSAR(order.total)],
      ];

  return (
    <div className="relative isolate min-h-[calc(100dvh-76px)] overflow-hidden">
      <CirclePattern variant="sand" fade="down" className="-z-10 h-[420px]" />
      <div className="mx-auto flex min-h-[calc(100dvh-76px)] max-w-column flex-col px-5 pb-[max(24px,env(safe-area-inset-bottom))] pt-24 lg:max-w-[520px] lg:pt-20">
        <div className="mx-auto grid size-[150px] animate-ring-pulse place-items-center rounded-full bg-[#EAD5D2]/80">
          <span className="grid size-[124px] place-items-center rounded-full bg-maroon text-white">
            <Check size={56} strokeWidth={2.6} className="animate-check-draw [stroke-dasharray:48]" />
          </span>
        </div>
        <h1 className="mt-8 text-center text-title text-ink">{later ? t('Order placed') : t('Payment successful')}</h1>
        <p className="mt-2 text-center text-body text-muted">
          {order.payment?.method === 'branch'
            ? PICKUP.paidLater(formatSAR(order.total))
            : later
              ? t('Pay {total} in cash when your order arrives', { total: formatSAR(order.total) })
              : t('{total} paid with {method}', { total: formatSAR(order.total), method: paymentLabel(order.payment) })}
        </p>

        <Card className="mt-6 px-4 py-2">
          <dl>
            {rows.map(([label, value]) => (
              <div key={label} className="flex items-baseline justify-between gap-4 py-2">
                <dt className="text-body text-muted">{label}</dt>
                <dd className="tabular text-end text-[15px] font-bold text-ink">{value}</dd>
              </div>
            ))}
          </dl>
        </Card>

        <p className="mt-8 flex items-center justify-center gap-2.5 text-body text-copy">
          <WhatsAppIcon size={20} className="text-muted" />
          {/* RSOF messages the customer about the order on WhatsApp; it sends no payment receipt (19 Nov 2026). */}{t('Your order details have been sent to your WhatsApp')}</p>

        <div className="mt-auto pt-10">
          <p className="text-center text-body text-muted" aria-live="polite">
            {confirmed ? (order.branch ? t('Confirmed by {name}', { name: order.branch.name }) : PENDING_BRANCH.sent) : t('Confirming your order with the branch…')}
          </p>
          <ProgressBar value={progress} className="mt-3" label={t('Confirming with the branch')} />
          <Button block className="mt-5" disabled={!confirmed} onClick={() => navigate(ROUTES.orderConfirmed(order.id), { replace: true })}>
            {t('Continue')}
          </Button>
        </div>
      </div>
    </div>
  );
}
