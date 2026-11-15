import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { computeTotals, getProduct, findPromo } from '@/domain';
import { readCart, writeCart } from '@/services/cartService.js';
import { hasOrders } from '@/services/orderService.js';
import { ApiError } from '@/services/request.js';
import { useAuth } from './AuthContext.jsx';

const CartContext = createContext(null);
const EMPTY = { items: [], promoCode: null };
const MAX_QTY = 20;

export function CartProvider({ children }) {
  const { user } = useAuth();
  const userId = user?.id;
  const [cart, setCart] = useState(() => (userId ? readCart(userId) : EMPTY));
  const loadedFor = useRef(userId);
  const cartRef = useRef(cart);
  cartRef.current = cart;

  // Reload the cart when the signed-in user changes
  useEffect(() => {
    if (loadedFor.current !== userId) {
      loadedFor.current = userId;
      setCart(userId ? readCart(userId) : EMPTY);
    }
  }, [userId]);

  const update = useCallback(
    (fn) => {
      setCart((prev) => {
        const next = fn(prev);
        if (userId) writeCart(userId, next);
        return next;
      });
    },
    [userId],
  );

  /** Re-read from storage (e.g. after an order empties the cart server-side). */
  const reload = useCallback(() => setCart(userId ? readCart(userId) : EMPTY), [userId]);

  const add = useCallback(
    (productId, qty = 1) =>
      update((prev) => {
        const existing = prev.items.find((i) => i.productId === productId);
        const items = existing
          ? prev.items.map((i) => (i.productId === productId ? { ...i, qty: Math.min(MAX_QTY, i.qty + qty) } : i))
          : [...prev.items, { productId, qty: Math.min(MAX_QTY, qty) }];
        return { ...prev, items };
      }),
    [update],
  );

  const setQty = useCallback(
    (productId, qty) =>
      update((prev) => ({
        ...prev,
        items: prev.items.map((i) => (i.productId === productId ? { ...i, qty: Math.max(1, Math.min(MAX_QTY, qty)) } : i)),
      })),
    [update],
  );

  const remove = useCallback(
    (productId) => {
      const index = cartRef.current.items.findIndex((i) => i.productId === productId);
      const removed = index >= 0 ? { item: cartRef.current.items[index], index } : null;
      update((prev) => {
        const items = prev.items.filter((i) => i.productId !== productId);
        return { ...prev, items, promoCode: items.length ? prev.promoCode : null };
      });
      return removed;
    },
    [update],
  );

  const restore = useCallback(
    ({ item, index }) =>
      update((prev) => {
        if (prev.items.some((i) => i.productId === item.productId)) return prev;
        const items = [...prev.items];
        items.splice(Math.min(index, items.length), 0, item);
        return { ...prev, items };
      }),
    [update],
  );

  const applyPromo = useCallback(
    async (code) => {
      await new Promise((r) => setTimeout(r, 500 + Math.random() * 300));
      const promo = findPromo(code);
      if (!promo) throw new ApiError('This promo code is not valid.', { field: 'promo' });
      if (promo.firstOrderOnly && userId && hasOrders(userId)) {
        throw new ApiError('This code is for your first order only.', { field: 'promo' });
      }
      update((prev) => ({ ...prev, promoCode: promo.code }));
      return promo;
    },
    [update, userId],
  );

  const removePromo = useCallback(() => update((prev) => ({ ...prev, promoCode: null })), [update]);

  const value = useMemo(() => {
    const promo = findPromo(cart.promoCode);
    const totals = computeTotals(cart.items, getProduct, promo);
    return {
      items: cart.items,
      promo,
      totals,
      count: totals.count,
      quantityOf: (productId) => cart.items.find((i) => i.productId === productId)?.qty || 0,
      add,
      setQty,
      remove,
      restore,
      applyPromo,
      removePromo,
      reload,
      raw: cart,
    };
  }, [cart, add, setQty, remove, restore, applyPromo, removePromo, reload]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used inside CartProvider');
  return ctx;
}
