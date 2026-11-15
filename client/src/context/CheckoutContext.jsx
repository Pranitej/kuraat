import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { session } from '@/lib/storage.js';

/**
 * Checkout draft (selected address, delivery phone, payment method, last result).
 * Kept in sessionStorage so a refresh mid-checkout keeps the user's choices.
 */
const CheckoutContext = createContext(null);
const KEY = 'checkout';
const EMPTY = { addressId: null, deliveryPhone: '', paymentMethod: 'card', lastOrderId: null, lastPayment: null };

export function CheckoutProvider({ children }) {
  const [state, setState] = useState(() => ({ ...EMPTY, ...(session.read(KEY) || {}) }));

  const patch = useCallback((changes) => {
    setState((prev) => {
      const next = { ...prev, ...changes };
      session.write(KEY, next);
      return next;
    });
  }, []);

  const reset = useCallback((keep = {}) => {
    const next = { ...EMPTY, ...keep };
    session.write(KEY, next);
    setState(next);
  }, []);

  const value = useMemo(() => ({ ...state, patch, reset }), [state, patch, reset]);
  return <CheckoutContext.Provider value={value}>{children}</CheckoutContext.Provider>;
}

export function useCheckout() {
  const ctx = useContext(CheckoutContext);
  if (!ctx) throw new Error('useCheckout must be used inside CheckoutProvider');
  return ctx;
}
