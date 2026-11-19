import { useState } from 'react';
import { Lock, TriangleAlert } from 'lucide-react';
import { Button, Card } from '@/components/ui';
import { CARD_PAYMENT, formatSAR, usablePaymentLink } from '@/domain';
import { payOrder } from '@/services/orderService.js';
import { cn } from '@/lib/cn.js';

/** The payment page opens in a popup window beside the site (a blocked popup falls back to the link's own new tab). */
const WINDOW_NAME = 'kuraat-payment';
const WINDOW_FEATURES = 'popup=yes,width=480,height=760,menubar=no,toolbar=no,location=yes,status=no,resizable=yes,scrollbars=yes';

/**
 * "Complete your payment" for an online-payment order that is not paid (right after ordering, and on the order
 * details while RSOF says the payment is open). Deliberately simple: Pay opens RSOF's secure payment page, and that is
 * all — whether the customer paid is RSOF's business, so nothing is checked or shown here.
 * `onOrderPage`: the hint says the status updates on this page (otherwise it points to the Orders page).
 * The page comes with a new order; otherwise one tap gets it from the kuraat server and opens it at once — the popup
 * is opened by the tap itself (so no browser blocks it) and pointed at the page when it arrives.
 */
export default function PaymentDueCard({ order, onOrderPage = false, className }) {
  const [link, setLink] = useState(() => usablePaymentLink(order.payment)); // an expired page is not used: Pay fetches a fresh one
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const total = formatSAR(order.total);

  const openWindow = (url) => {
    const win = window.open(url, WINDOW_NAME, WINDOW_FEATURES);
    if (win) {
      try {
        win.opener = null; // the payment page must not reach back into this page
      } catch {
        /* already cross-origin: nothing to do */
      }
      win.focus?.();
    }
    return win;
  };

  // A page we already hold: a real link, so a blocked popup still opens in a new tab.
  const openKnown = (event) => {
    if (openWindow(link)) event.preventDefault();
  };

  // No page yet: open the window now (a tap is allowed to), then send it to the page once the kuraat server has it.
  const getAndOpen = async () => {
    setBusy(true);
    setError('');
    const win = openWindow('');
    try {
      const page = (await payOrder(order.id)).link;
      if (win) win.location.href = page;
      else setLink(page); // popup blocked: show the real link, one more tap opens it in a new tab
    } catch (e) {
      win?.close();
      setError(e.message);
    } finally {
      setBusy(false);
    }
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
          <Button block className="mt-4" leftIcon={Lock} href={link} target="_blank" rel="noopener noreferrer" onClick={openKnown}>
            {CARD_PAYMENT.pay(total)}
          </Button>
        ) : (
          <Button block className="mt-4" leftIcon={Lock} loading={busy} onClick={getAndOpen}>
            {error ? CARD_PAYMENT.tryAgain : CARD_PAYMENT.pay(total)}
          </Button>
        )}
        <p className="mt-3 text-small text-muted">{onOrderPage ? CARD_PAYMENT.refreshHint : CARD_PAYMENT.returnHint}</p>
      </section>
    </Card>
  );
}
