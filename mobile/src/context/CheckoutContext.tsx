import { randomUUID } from 'expo-crypto';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { session } from '@/lib/storage.js';
import { withIdempotencyKey as withIdempotencyKeyJs } from '@/services/checkoutService.js';
import type { PaymentMethod } from '@/types/api';
import { useAuth } from './AuthContext';

const KEY = 'checkout';

const withIdempotencyKey = withIdempotencyKeyJs as unknown as (draft: Draft, makeKey: () => string) => Draft;

type Draft = {
  addressId: string | null;
  deliveryPhone: string;
  paymentMethod: PaymentMethod;
  idempotencyKey: string | null;
  lastOrderId: string | null;
};
const EMPTY: Draft = { addressId: null, deliveryPhone: '', paymentMethod: 'card', idempotencyKey: null, lastOrderId: null };

export type CheckoutValue = Draft & {
  patch: (changes: Partial<Draft>) => void;
  reset: (keep?: Partial<Draft>) => void;
  ensureIdempotencyKey: () => string;
  renewIdempotencyKey: () => string;
};

const CheckoutContext = createContext<CheckoutValue | null>(null);

/**
 * Checkout draft (address, delivery phone, payment method, idempotency key, last order), kept for
 * this app launch so every "Pay" retry sends the same key and can never create a second order.
 */
export function CheckoutProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<Draft>(() => ({ ...EMPTY, ...(session.read(KEY) || {}) }));
  const ref = useRef(state);

  const write = useCallback((next: Draft) => {
    ref.current = next;
    session.write(KEY, next);
    setState(next);
  }, []);

  const patch = useCallback((changes: Partial<Draft>) => write({ ...ref.current, ...changes }), [write]);

  /** Fresh draft after an order (keeps what `keep` says, e.g. the last order and method). */
  const reset = useCallback((keep: Partial<Draft> = {}) => write({ ...EMPTY, ...keep }), [write]);

  // Signed out (or the session expired): drop the draft so the next account starts clean.
  const { user, status } = useAuth();
  const signedOut = status === 'ready' && !user;
  useEffect(() => {
    if (signedOut) write({ ...EMPTY });
  }, [signedOut, write]);

  /** The key for this checkout's "Pay" attempts (created on first use). */
  const ensureIdempotencyKey = useCallback(() => {
    const next = withIdempotencyKey(ref.current, randomUUID);
    if (next !== ref.current) write(next);
    return next.idempotencyKey as string;
  }, [write]);

  /** The server refused the key (another session used it): start a new one. */
  const renewIdempotencyKey = useCallback(() => {
    write({ ...ref.current, idempotencyKey: null });
    return ensureIdempotencyKey();
  }, [write, ensureIdempotencyKey]);

  const value = useMemo<CheckoutValue>(
    () => ({ ...state, patch, reset, ensureIdempotencyKey, renewIdempotencyKey }),
    [state, patch, reset, ensureIdempotencyKey, renewIdempotencyKey],
  );
  return <CheckoutContext.Provider value={value}>{children}</CheckoutContext.Provider>;
}

export function useCheckout(): CheckoutValue {
  const ctx = useContext(CheckoutContext);
  if (!ctx) throw new Error('useCheckout must be used inside CheckoutProvider');
  return ctx;
}
