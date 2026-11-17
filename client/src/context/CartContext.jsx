import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { cartLines, isCartBlocked } from '@/domain';
import { getCart, putCart } from '@/services/cartService.js';
import { createCartSync } from '@/services/cartSync.js';
import { useAuth } from './AuthContext.jsx';
import { useCatalog } from './CatalogContext.jsx';

const CartContext = createContext(null);
const MAX_QTY = 20;
const EMPTY_TOTALS = { count: 0, subtotal: 0, discount: 0, delivery: 0, total: 0, vat: 0 };
const toItems = (priced) => priced.items.map((l) => ({ productId: l.productId, qty: l.qty }));
/** Warnings worth keeping on screen after the cart has been re-saved with the new values. */
const NOTICES = ['qty_reduced', 'price_changed'];

/**
 * The cart lives on the server, which prices it from RSOF. Taps change the local items at once and
 * are saved in the background (cartSync); totals and warnings come from the server's last answer
 * (`syncing` while a save is on its way). There are no promo codes: every save sends none, which
 * also clears one saved before they were removed.
 */
export function CartProvider({ children }) {
  const { user } = useAuth();
  const userId = user?.id;
  const { getProduct } = useCatalog();
  const [items, setItems] = useState([]);
  const [priced, setPriced] = useState(null);
  const [notices, setNotices] = useState({});
  const [status, setStatus] = useState('idle');
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState(null);
  const itemsRef = useRef(items);

  const syncRef = useRef(null);
  if (!syncRef.current) {
    syncRef.current = createCartSync({
      put: putCart,
      onResult: (answer) => {
        const next = toItems(answer); // the server may have capped a quantity at the stock
        itemsRef.current = next;
        setItems(next);
        setPriced(answer);
        setSyncing(false);
      },
      onError: (e) => {
        setError(e);
        setSyncing(false);
      },
    });
  }
  const sync = syncRef.current;

  const load = useCallback(async () => {
    sync.cancel();
    setSyncing(false);
    if (!userId) {
      itemsRef.current = [];
      setItems([]);
      setPriced(null);
      setNotices({});
      setStatus('idle');
      return;
    }
    setStatus((s) => (s === 'ready' ? s : 'loading'));
    setError(null);
    try {
      const answer = await getCart();
      const next = toItems(answer);
      itemsRef.current = next;
      setItems(next);
      setPriced(answer);
      setStatus('ready');
      const changed = answer.items.filter((l) => NOTICES.includes(l.warning));
      setNotices(Object.fromEntries(changed.map((l) => [l.productId, l.warning])));
      // Save the adjusted cart (or drop a code saved before promo codes were removed) so checkout
      // accepts it; the notices stay until the next change.
      if (changed.length || answer.promo) {
        setSyncing(true);
        sync.schedule({ items: next, promoCode: null });
      }
    } catch (e) {
      setError(e);
      setStatus('error');
    }
  }, [userId, sync]);

  useEffect(() => {
    load();
  }, [load]);

  const commit = useCallback(
    (nextItems) => {
      itemsRef.current = nextItems;
      setItems(nextItems);
      setNotices({});
      setError(null);
      setSyncing(true);
      sync.schedule({ items: nextItems, promoCode: null });
    },
    [sync],
  );

  const add = useCallback(
    (productId, qty = 1) => {
      const prev = itemsRef.current;
      const existing = prev.find((i) => i.productId === productId);
      commit(
        existing
          ? prev.map((i) => (i.productId === productId ? { ...i, qty: Math.min(MAX_QTY, i.qty + qty) } : i))
          : [...prev, { productId, qty: Math.min(MAX_QTY, qty) }],
      );
    },
    [commit],
  );

  const setQty = useCallback(
    (productId, qty) => commit(itemsRef.current.map((i) => (i.productId === productId ? { ...i, qty: Math.max(1, Math.min(MAX_QTY, qty)) } : i))),
    [commit],
  );

  const remove = useCallback(
    (productId) => {
      const prev = itemsRef.current;
      const index = prev.findIndex((i) => i.productId === productId);
      if (index < 0) return null;
      commit(prev.filter((i) => i.productId !== productId));
      return { item: prev[index], index };
    },
    [commit],
  );

  const restore = useCallback(
    ({ item, index }) => {
      const prev = itemsRef.current;
      if (prev.some((i) => i.productId === item.productId)) return;
      const next = [...prev];
      next.splice(Math.min(index, next.length), 0, item);
      commit(next);
    },
    [commit],
  );

  /** Waits for pending saves (before leaving the cart, before paying). Rejects if a save fails. */
  const flush = useCallback(() => sync.flush(), [sync]);

  const value = useMemo(() => {
    const lines = cartLines(items, priced?.items || [], getProduct).map((l) => ({ ...l, warning: l.warning || notices[l.productId] || null }));
    const count = items.reduce((s, i) => s + i.qty, 0);
    return {
      items,
      lines,
      totals: priced?.totals || EMPTY_TOTALS,
      count,
      status,
      syncing,
      error,
      blocked: isCartBlocked(lines),
      quantityOf: (productId) => items.find((i) => i.productId === productId)?.qty || 0,
      add,
      setQty,
      remove,
      restore,
      reload: load,
      flush,
    };
  }, [items, priced, notices, getProduct, status, syncing, error, add, setQty, remove, restore, load, flush]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used inside CartProvider');
  return ctx;
}
