import { useEffect, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { Check } from 'lucide-react';
import { Button, Card, CirclePattern, ProgressBar, WhatsAppIcon } from '@/components/ui';
import { useOrder } from '@/context/OrderContext.jsx';
import { formatDateTime, formatSAR, paymentLabel } from '@/domain';
import { ROUTES } from '@/config/routes.js';
import { useDocumentTitle } from '@/hooks';

/** 15 · Payment successful — then confirms the order with the branch before continuing. */
export default function PaymentSuccessPage() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const { order, loading } = useOrder(orderId);
  const cod = order?.payment?.method === 'cod';
  useDocumentTitle(cod ? 'Order placed' : 'Payment successful');
  const [progress, setProgress] = useState(8);
  const confirmed = progress >= 100;

  useEffect(() => {
    if (!order?.id) return undefined;
    const steps = [
      [500, 34],
      [1200, 58],
      [2000, 76],
      [2900, 100],
    ];
    const timers = steps.map(([t, v]) => setTimeout(() => setProgress(v), t));
    return () => timers.forEach(clearTimeout);
  }, [order?.id]);

  if (!order && loading) return <div className="min-h-[calc(100dvh-76px)]" aria-busy="true" />;
  if (!order) return <Navigate to={ROUTES.orders} replace />;
  const branchName = order.branch?.name || 'the branch';

  const rows = cod
    ? [
        ['Order number', `#${order.number}`],
        ['Date', formatDateTime(order.createdAt)],
        ['Method', 'Cash on delivery'],
        ['Amount due', formatSAR(order.total)],
      ]
    : [
        ['Transaction ID', order.payment.transactionId],
        ['Date', formatDateTime(order.payment.paidAt || order.createdAt)],
        ['Method', paymentLabel(order.payment)],
        ['Amount', formatSAR(order.total)],
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
        <h1 className="mt-8 text-center text-title text-ink">{cod ? 'Order placed' : 'Payment successful'}</h1>
        <p className="mt-2 text-center text-body text-muted">
          {cod ? `Pay ${formatSAR(order.total)} in cash when your order arrives` : `${formatSAR(order.total)} paid with ${paymentLabel(order.payment)}`}
        </p>

        <Card className="mt-6 px-4 py-2">
          <dl>
            {rows.map(([label, value]) => (
              <div key={label} className="flex items-baseline justify-between gap-4 py-2">
                <dt className="text-body text-muted">{label}</dt>
                <dd className="tabular text-right text-[15px] font-bold text-ink">{value}</dd>
              </div>
            ))}
          </dl>
        </Card>

        <p className="mt-8 flex items-center justify-center gap-2.5 text-body text-copy">
          <WhatsAppIcon size={20} className="text-muted" />
          {cod ? 'Your order details have been sent to your WhatsApp' : 'A receipt has been sent to your WhatsApp'}
        </p>

        <div className="mt-auto pt-10">
          <p className="text-center text-body text-muted" aria-live="polite">
            {confirmed ? `Confirmed by ${branchName}` : 'Confirming your order with the branch…'}
          </p>
          <ProgressBar value={progress} className="mt-3" label="Confirming with the branch" />
          <Button block className="mt-5" disabled={!confirmed} onClick={() => navigate(ROUTES.orderConfirmed(order.id), { replace: true })}>
            Continue
          </Button>
        </div>
      </div>
    </div>
  );
}
