import { useState } from 'react';
import { Lock, TriangleAlert } from 'lucide-react';
import { Button, Card } from '@/components/ui';
import { CARD_PAYMENT, formatSAR } from '@/domain';
import { payOrder } from '@/services/orderService.js';
import { cn } from '@/lib/cn.js';

/** The payment page opens in a popup window beside the site (a blocked popup falls back to the link's own new tab). */
const WINDOW_NAME = 'kuraat-payment';
const WINDOW_FEATURES = 'popup=yes,width=480,height=760,menubar=no,toolbar=no,location=yes,status=no,resizable=yes,scrollbars=yes';

/**
 * "Complete your payment" after an online-payment order is placed. Deliberately simple: Pay opens RSOF's secure
 * payment page, and that is all — whether the customer paid is RSOF's business, so nothing is checked or shown here;
 * the text tells them to look at the Orders page. `link` comes with the order; when RSOF gave none, one tap gets it.
 */
export default function PaymentDueCard({ order, className }) {
  const [link, setLink] = useState(order.payment?.link ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const total = formatSAR(order.total);

  const getPage = async () => {
    setBusy(true);
    setError('');
    try {
      setLink((await payOrder(order.id)).link);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const open = (event) => {
    const win = window.open(link, WINDOW_NAME, WINDOW_FEATURES);
    if (!win) return; // popup blocked: the link opens in a new tab
    event.preventDefault();
    try {
      win.opener = null; // the payment page must not reach back into this page
    } catch {
      /* already cross-origin: nothing to do */
    }
    win.focus?.();
  };

  return (
    <Card className={cn('p-4', className)}>
      <section aria-label={CARD_PAYMENT.waitingTitle}>
        <h2 className="text-h3 text-ink">{CARD_PAYMENT.waitingTitle}</h2>
        <p className="mt-1 text-body text-muted">{CARD_PAYMENT.waitingBody(total)}</p>
        {error && (
          <p role="alert" className="mt-3 flex gap-2.5 rounded-lg border border-hotpink/40 bg-hotpink/[0.06] px-4 py-3 text-[15px] text-ink">
            <TriangleAlert size={20} strokeWidth={1.8} className="mt-px shrink-0 text-hotpink" aria-hidden />
            {error}
          </p>
        )}
        {link ? (
          <Button block className="mt-4" leftIcon={Lock} href={link} target="_blank" rel="noopener noreferrer" onClick={open}>
            {CARD_PAYMENT.pay(total)}
          </Button>
        ) : (
          <Button block className="mt-4" leftIcon={Lock} loading={busy} onClick={getPage}>
            {error ? CARD_PAYMENT.tryAgain : CARD_PAYMENT.pay(total)}
          </Button>
        )}
        <p className="mt-3 text-small text-muted">{CARD_PAYMENT.returnHint}</p>
      </section>
    </Card>
  );
}
