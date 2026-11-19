import { useCallback, useEffect, useRef, useState } from 'react';
import { awaitingPayment } from '@/domain';
import { payOrder } from '@/services/orderService.js';

/** Coming back to the tab twice within this time asks only once. */
const RECHECK_MS = 3000;
/** The payment window (a popup beside the page; a blocked popup falls back to a new tab). */
const WINDOW_NAME = 'kuraat-payment';
const WINDOW_FEATURES = 'popup=yes,width=480,height=760,menubar=no,toolbar=no,location=yes,status=no,resizable=yes,scrollbars=yes';

/**
 * A card order paid on RSOF's secure payment page (server/README.md → Card payments). While `order` waits for
 * its payment, this asks the kuraat server for the payment page when shown, and again each time the customer
 * comes back to this tab — that is how "paid" is learned (nothing tells the website by itself). `onPaid` runs
 * once the payment is seen (refresh the order there).
 *
 * The Pay button is a real link (`<a target="_blank">`). `onOpen` opens it as a popup window instead; when the
 * browser blocks the popup the link's own new tab is used. When the popup is closed the payment is checked at
 * once — paid, or "Payment not completed".
 * @returns {{ waiting: boolean, link: string|null, checking: boolean, error: Error|null, notYet: boolean,
 *   popupOpen: boolean, check: () => void, onOpen: (event) => void }}
 */
export function useOrderPayment(order, { onPaid } = {}) {
  const waiting = awaitingPayment(order);
  const id = order?.id;
  const [state, setState] = useState({ link: null, expiresAt: null, checking: false, error: null, notYet: false });
  const lastCheck = useRef(0);
  const opened = useRef(false);
  const popup = useRef(null);
  const [popupOpen, setPopupOpen] = useState(false);
  const paidHandler = useRef(onPaid);
  useEffect(() => {
    paidHandler.current = onPaid;
  }, [onPaid]);

  const check = useCallback(
    async ({ manual = false } = {}) => {
      if (!id) return;
      lastCheck.current = Date.now();
      setState((s) => ({ ...s, checking: true, error: null }));
      try {
        const answer = await payOrder(id);
        if (answer.status === 'paid') {
          setState({ link: null, expiresAt: null, checking: false, error: null, notYet: false });
          await paidHandler.current?.();
          return;
        }
        // "Not yet" only once the customer has opened the page or asked: never on the first look.
        setState({ link: answer.link ?? null, expiresAt: answer.expiresAt ?? null, checking: false, error: null, notYet: manual || opened.current });
      } catch (error) {
        setState((s) => ({ ...s, checking: false, error }));
      }
    },
    [id],
  );

  useEffect(() => {
    if (waiting) check();
  }, [waiting, check]);

  useEffect(() => {
    if (!waiting) return undefined;
    const onReturn = () => {
      if (document.visibilityState !== 'visible' || Date.now() - lastCheck.current < RECHECK_MS) return;
      check();
    };
    window.addEventListener('focus', onReturn);
    document.addEventListener('visibilitychange', onReturn);
    return () => {
      window.removeEventListener('focus', onReturn);
      document.removeEventListener('visibilitychange', onReturn);
    };
  }, [waiting, check]);

  // While the payment window is open, notice when it closes and check the payment at once.
  useEffect(() => {
    if (!popupOpen) return undefined;
    const timer = setInterval(() => {
      if (popup.current && !popup.current.closed) return;
      clearInterval(timer);
      popup.current = null;
      setPopupOpen(false);
      check({ manual: true });
    }, 500);
    return () => clearInterval(timer);
  }, [popupOpen, check]);

  // Leaving this screen with the window still open closes it: its result would have nowhere to show.
  useEffect(
    () => () => {
      if (popup.current && !popup.current.closed) popup.current.close();
    },
    [],
  );

  /** The Pay link's onClick: a page that has run out is replaced first (the customer taps Pay again). */
  const onOpen = useCallback(
    (event) => {
      if (state.expiresAt && Date.parse(state.expiresAt) <= Date.now()) {
        event.preventDefault();
        check();
        return;
      }
      opened.current = true;
      const win = window.open(state.link, WINDOW_NAME, WINDOW_FEATURES);
      if (!win) return; // popup blocked: the link opens in a new tab (and focus-return still checks)
      event.preventDefault();
      try {
        win.opener = null; // the payment page must not reach back into this page
      } catch {
        /* already cross-origin: nothing to do */
      }
      win.focus?.();
      popup.current = win;
      setPopupOpen(true);
    },
    [state.link, state.expiresAt, check],
  );

  return { waiting, link: state.link, checking: state.checking, error: state.error, notYet: state.notYet, popupOpen, check: () => check({ manual: true }), onOpen };
}
