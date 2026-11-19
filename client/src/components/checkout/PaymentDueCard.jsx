import { Lock, TriangleAlert } from 'lucide-react';
import { Button, Card } from '@/components/ui';
import { CARD_PAYMENT, formatSAR } from '@/domain';
import { cn } from '@/lib/cn.js';

/**
 * "Complete your payment" for a card order that is not paid yet (server/README.md → Card payments). The Pay
 * button is a real link to RSOF's secure payment page, opened in a new tab; `payment` comes from useOrderPayment.
 */
export default function PaymentDueCard({ order, payment, className }) {
  const total = formatSAR(order.total);
  const message = payment.error?.message ?? (payment.notYet ? CARD_PAYMENT.notYet : null);
  return (
    <Card className={cn('p-4', className)}>
      <section aria-label={CARD_PAYMENT.waitingTitle}>
        <h2 className="text-h3 text-ink">{CARD_PAYMENT.waitingTitle}</h2>
        <p className="mt-1 text-body text-muted">{CARD_PAYMENT.waitingBody(total)}</p>
        {payment.popupOpen && (
          <p role="status" className="mt-3 rounded-lg bg-sand px-4 py-3 text-[15px] text-ink">
            {CARD_PAYMENT.popupHint}
          </p>
        )}
        {message && !payment.popupOpen && (
          <p role={payment.error ? 'alert' : 'status'} className="mt-3 flex gap-2.5 rounded-lg border border-hotpink/40 bg-hotpink/[0.06] px-4 py-3 text-[15px] text-ink">
            <TriangleAlert size={20} strokeWidth={1.8} className="mt-px shrink-0 text-hotpink" aria-hidden />
            {message}
          </p>
        )}
        {payment.link ? (
          <Button block className="mt-4" leftIcon={Lock} href={payment.link} target="_blank" rel="noopener noreferrer" onClick={payment.onOpen}>
            {CARD_PAYMENT.pay(total)}
          </Button>
        ) : (
          <Button block className="mt-4" leftIcon={Lock} disabled={!payment.error} loading={payment.checking} onClick={payment.check}>
            {payment.error ? CARD_PAYMENT.tryAgain : CARD_PAYMENT.pay(total)}
          </Button>
        )}
        {payment.link && (
          <Button block variant="secondary" size="md" className="mt-3" loading={payment.checking} onClick={payment.check}>
            {CARD_PAYMENT.check}
          </Button>
        )}
        <p className="mt-3 text-small text-muted">{CARD_PAYMENT.returnHint}</p>
      </section>
    </Card>
  );
}
