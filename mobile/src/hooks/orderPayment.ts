import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking } from 'react-native';
import { awaitingPayment } from '@/domain';
import { payOrder } from '@/services/orderService.js';
import type { Order, PayAnswer } from '@/types/api';
import { useAppActive } from './appState';

/** Coming back to the app twice within this time asks only once. */
const RECHECK_MS = 3000;

type WebBrowserModule = { openBrowserAsync: (url: string, options?: Record<string, unknown>) => Promise<unknown> };

/**
 * Opens RSOF's payment page in the in-app browser sheet (SFSafariViewController / Chrome Custom Tab): the customer
 * stays in the app, and this resolves when the sheet is closed. A build without the expo-web-browser native module
 * (an older dev build) falls back to the phone's own browser instead of crashing.
 */
async function openPaymentPage(url: string): Promise<void> {
  let browser: WebBrowserModule | null = null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    browser = require('expo-web-browser') as WebBrowserModule;
  } catch {
    browser = null;
  }
  if (browser) {
    await browser.openBrowserAsync(url, { dismissButtonStyle: 'close', showTitle: true, enableBarCollapsing: false });
    return;
  }
  await Linking.openURL(url);
}

export type OrderPayment = {
  waiting: boolean;
  link: string | null;
  checking: boolean;
  opening: boolean;
  error: Error | null;
  notYet: boolean;
  /** "I've paid · Check again" / "Try again". */
  check: () => void;
  /** Opens RSOF's secure payment page in the in-app browser sheet (a fresh one if this one has run out). */
  open: () => Promise<void>;
};

/**
 * A card order paid on RSOF's secure payment page (server/README.md → Card payments). While `order` waits for
 * its payment, this asks the kuraat server for the page when shown, and again each time the app comes back to
 * the front — that is how "paid" is learned (nothing tells the app by itself). `onPaid` runs once the payment
 * is seen (refresh the order there). The page opens in the in-app browser sheet; when the customer closes it the
 * payment is checked at once — paid, or "Payment not completed".
 */
export function useOrderPayment(order: Order | null | undefined, { onPaid }: { onPaid?: () => unknown } = {}): OrderPayment {
  const waiting = awaitingPayment(order) as boolean;
  const id = order?.id;
  const [state, setState] = useState<{ link: string | null; expiresAt: string | null; checking: boolean; opening: boolean; error: Error | null; notYet: boolean }>({
    link: null,
    expiresAt: null,
    checking: false,
    opening: false,
    error: null,
    notYet: false,
  });
  const lastCheck = useRef(0);
  const opened = useRef(false);
  const paidHandler = useRef(onPaid);
  useEffect(() => {
    paidHandler.current = onPaid;
  }, [onPaid]);

  /** One ask; resolves with the live page link (or null when paid / failed). */
  const ask = useCallback(
    async ({ manual = false } = {}): Promise<string | null> => {
      if (!id) return null;
      lastCheck.current = Date.now();
      setState((s) => ({ ...s, checking: true, error: null }));
      try {
        const answer = (await payOrder(id)) as PayAnswer;
        if (answer.status === 'paid') {
          setState({ link: null, expiresAt: null, checking: false, opening: false, error: null, notYet: false });
          await paidHandler.current?.();
          return null;
        }
        // "Not yet" only once the customer has opened the page or asked: never on the first look.
        setState((s) => ({ ...s, link: answer.link ?? null, expiresAt: answer.expiresAt ?? null, checking: false, error: null, notYet: manual || opened.current }));
        return answer.link ?? null;
      } catch (error) {
        setState((s) => ({ ...s, checking: false, error: error as Error }));
        return null;
      }
    },
    [id],
  );

  useEffect(() => {
    if (waiting) ask();
  }, [waiting, ask]);

  useAppActive(() => {
    if (waiting && Date.now() - lastCheck.current >= RECHECK_MS) ask();
  });

  const open = useCallback(async () => {
    let link = state.link;
    if (!link || (state.expiresAt && Date.parse(state.expiresAt) <= Date.now())) link = await ask();
    if (!link) return;
    // The kuraat server hands out only RSOF web pages; never open anything that is not a web address.
    if (!/^https?:\/\//i.test(link)) {
      setState((s) => ({ ...s, error: new Error("We couldn't open the payment page. Please try again.") }));
      return;
    }
    setState((s) => ({ ...s, opening: true }));
    let launched = false;
    try {
      opened.current = true;
      await openPaymentPage(link);
      launched = true;
    } catch {
      setState((s) => ({ ...s, error: new Error("We couldn't open the payment page. Please try again.") }));
    } finally {
      setState((s) => ({ ...s, opening: false }));
    }
    // The sheet was closed: paid, or "Payment not completed".
    if (launched) ask({ manual: true });
  }, [state.link, state.expiresAt, ask]);

  return {
    waiting,
    link: state.link,
    checking: state.checking,
    opening: state.opening,
    error: state.error,
    notYet: state.notYet,
    check: () => {
      ask({ manual: true });
    },
    open,
  };
}
