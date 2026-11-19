import { useCallback, useEffect, useRef, useState } from 'react';
import { awaitingPayment } from '@/domain';
import { payOrder } from '@/services/orderService.js';

/** Coming back to the tab twice within this time asks only once. */
const RECHECK_MS = 3000;

/**
 * A card order paid on RSOF's secure payment page (server/README.md → Card payments). While `order` waits for
 * its payment, this asks the kuraat server for the payment page when shown, and again each time the customer
 * comes back to this tab — that is how "paid" is learned (nothing tells the website by itself). `onPaid` runs
 * once the payment is seen (refresh the order there).
 *
 * The page opens in a new tab from a real link (`<a target="_blank">`), so no browser blocks it.
 * @returns {{ waiting: boolean, link: string|null, checking: boolean, error: Error|null, notYet: boolean,
 *   check: () => void, onOpen: (event) => void }}
 */
export function useOrderPayment(order, { onPaid } = {}) {
  const waiting = awaitingPayment(order);
  const id = order?.id;
  const [state, setState] = useState({ link: null, expiresAt: null, checking: false, error: null, notYet: false });
  const lastCheck = useRef(0);
  const opened = useRef(false);
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

  /** The Pay link's onClick: a page that has run out is replaced first (the customer taps Pay again). */
  const onOpen = useCallback(
    (event) => {
      if (state.expiresAt && Date.parse(state.expiresAt) <= Date.now()) {
        event.preventDefault();
        check();
        return;
      }
      opened.current = true;
    },
    [state.expiresAt, check],
  );

  return { waiting, link: state.link, checking: state.checking, error: state.error, notYet: state.notYet, check: () => check({ manual: true }), onOpen };
}
