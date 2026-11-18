import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { session } from '@/lib/storage.js';
import { useAuth } from '@/context/AuthContext.jsx';
import { withIdempotencyKey } from '@/services/checkoutService.js';

/**
 * Checkout draft (delivery or pickup, selected address, phone, payment method, idempotency key, last order).
 * Kept in sessionStorage so a refresh mid-checkout keeps the choices — and the same key, so a
 * payment retried after a reload can never create a second order.
 */
const CheckoutContext = createContext(null);
const KEY = 'checkout';
const EMPTY = { fulfilment: 'delivery', addressId: null, deliveryPhone: '', paymentMethod: 'card', idempotencyKey: null, lastOrderId: null };

export function CheckoutProvider({ children }) {
  const [state, setState] = useState(() => ({ ...EMPTY, ...(session.read(KEY) || {}) }));
  const ref = useRef(state);

  const write = useCallback((next) => {
    ref.current = next;
    session.write(KEY, next);
    setState(next);
  }, []);

  const patch = useCallback((changes) => write({ ...ref.current, ...changes }), [write]);

  /** Fresh draft after an order (keeps what `keep` says, e.g. the last order and method). */
  const reset = useCallback((keep = {}) => write({ ...EMPTY, ...keep }), [write]);

  // Signed out (or the session expired): drop the draft so the next account starts clean.
  const { user, status } = useAuth();
  const signedOut = status === 'ready' && !user;
  useEffect(() => {
    if (signedOut) write({ ...EMPTY });
  }, [signedOut, write]);

  /** The key for this checkout's "Pay" attempts (created on first use). */
  const ensureIdempotencyKey = useCallback(() => {
    const next = withIdempotencyKey(ref.current);
    if (next !== ref.current) write(next);
    return next.idempotencyKey;
  }, [write]);

  /** The server refused the key (another session used it): start a new one. */
  const renewIdempotencyKey = useCallback(() => {
    write({ ...ref.current, idempotencyKey: null });
    return ensureIdempotencyKey();
  }, [write, ensureIdempotencyKey]);

  const value = useMemo(() => ({ ...state, patch, reset, ensureIdempotencyKey, renewIdempotencyKey }), [state, patch, reset, ensureIdempotencyKey, renewIdempotencyKey]);
  return <CheckoutContext.Provider value={value}>{children}</CheckoutContext.Provider>;
}

export function useCheckout() {
  const ctx = useContext(CheckoutContext);
  if (!ctx) throw new Error('useCheckout must be used inside CheckoutProvider');
  return ctx;
}
