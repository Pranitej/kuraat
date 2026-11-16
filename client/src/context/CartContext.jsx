import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { cartLines, isCartBlocked } from '@/domain';
import { getCart, putCart } from '@/services/cartService.js';
import { createCartSync } from '@/services/cartSync.js';
import { ApiError } from '@/services/api.js';
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
 * are saved in the background (cartSync); totals, promo and warnings come from the server's last
 * answer (`syncing` while a save is on its way).
 */
export function CartProvider({ children }) {
  const { user } = useAuth();
  const userId = user?.id;
  const { getProduct } = useCatalog();
  const [items, setItems] = useState([]);
  const [promoCode, setPromoCode] = useState(null);
  const [priced, setPriced] = useState(null);
  const [notices, setNotices] = useState({});
  const [status, setStatus] = useState('idle');
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState(null);
  const itemsRef = useRef(items);
  const promoRef = useRef(promoCode);

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
      promoRef.current = null;
      setItems([]);
      setPromoCode(null);
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
      const code = answer.promo?.valid ? answer.promo.code : null;
      itemsRef.current = next;
      promoRef.current = code;
      setItems(next);
      setPromoCode(code);
      setPriced(answer);
      setStatus('ready');
      const changed = answer.items.filter((l) => NOTICES.includes(l.warning));
      setNotices(Object.fromEntries(changed.map((l) => [l.productId, l.warning])));
      // Save the adjusted cart so checkout accepts it; the notices stay until the next change.
      if (changed.length) {
        setSyncing(true);
        sync.schedule({ items: next, promoCode: code });
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
    (nextItems, nextPromo = promoRef.current) => {
      itemsRef.current = nextItems;
      promoRef.current = nextPromo;
      setItems(nextItems);
      setPromoCode(nextPromo);
      setNotices({});
      setError(null);
      setSyncing(true);
      sync.schedule({ items: nextItems, promoCode: nextPromo });
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
      const next = prev.filter((i) => i.productId !== productId);
      commit(next, next.length ? promoRef.current : null);
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

  /** Saves the cart with the code; an invalid code is refused with the server's reason. */
  const applyPromo = useCallback(
    async (code) => {
      await sync.flush().catch(() => {});
      const answer = await putCart({ items: itemsRef.current, promoCode: code });
      setPriced(answer);
      if (!answer.promo?.valid) {
        promoRef.current = null;
        setPromoCode(null);
        throw new ApiError(answer.promo?.error || "This code isn't valid.", { code: 'invalid_promo', field: 'promo' });
      }
      promoRef.current = answer.promo.code;
      setPromoCode(answer.promo.code);
      return answer.promo;
    },
    [sync],
  );

  const removePromo = useCallback(() => commit(itemsRef.current, null), [commit]);

  /** Waits for pending saves (before leaving the cart, before paying). Rejects if a save fails. */
  const flush = useCallback(() => sync.flush(), [sync]);

  const value = useMemo(() => {
    const lines = cartLines(items, priced?.items || [], getProduct).map((l) => ({ ...l, warning: l.warning || notices[l.productId] || null }));
    const count = items.reduce((s, i) => s + i.qty, 0);
    return {
      items,
      lines,
      totals: priced?.totals || EMPTY_TOTALS,
      promo: priced?.promo?.valid && promoCode ? priced.promo : null,
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
      applyPromo,
      removePromo,
      reload: load,
      flush,
      // Kept for the payment screen until it places orders through the server.
      raw: { items, promoCode },
    };
  }, [items, priced, promoCode, notices, getProduct, status, syncing, error, add, setQty, remove, restore, applyPromo, removePromo, load, flush]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used inside CartProvider');
  return ctx;
}
