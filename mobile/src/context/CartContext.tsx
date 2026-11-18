import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { cartLines, isCartBlocked } from '@/domain';
import { getCart, putCart } from '@/services/cartService.js';
import { createCartSync as createCartSyncJs } from '@/services/cartSync.js';
import type { CartItem, CartWarning, PricedCart, PricedLine, Totals } from '@/types/api';
import { useAuth } from './AuthContext';
import { useCatalog } from './CatalogContext';

type CartSync = {
  schedule: (state: { items: CartItem[] }) => void;
  flush: () => Promise<void>;
  isPending: () => boolean;
  cancel: () => void;
};
const createCartSync = createCartSyncJs as unknown as (options: {
  put: (state: { items: CartItem[] }) => Promise<PricedCart>;
  delayMs?: number;
  onResult?: (answer: PricedCart) => void;
  onError?: (error: unknown) => void;
}) => CartSync;

const MAX_QTY = 20;
const EMPTY_TOTALS: Totals = { count: 0, subtotal: 0, total: 0 };
const toItems = (priced: PricedCart): CartItem[] => priced.items.map((l) => ({ productId: l.productId, qty: l.qty }));
/** Warnings worth keeping on screen after the cart has been re-saved with the new values. */
const NOTICES = ['qty_reduced', 'price_changed'];

export type CartLine = Omit<PricedLine, 'product'> & {
  product: { id: string; name: string; price: number; image?: string | null; images?: string[]; meta?: string | null } | null;
};
export type Removed = { item: CartItem; index: number };

export type CartValue = {
  items: CartItem[];
  lines: CartLine[];
  totals: Totals;
  count: number;
  status: 'idle' | 'loading' | 'ready' | 'error';
  syncing: boolean;
  error: unknown;
  blocked: boolean;
  quantityOf: (productId: string) => number;
  add: (productId: string, qty?: number) => void;
  setQty: (productId: string, qty: number) => void;
  remove: (productId: string) => Removed | null;
  restore: (removed: Removed) => void;
  reload: () => Promise<void>;
  flush: () => Promise<void>;
};

const CartContext = createContext<CartValue | null>(null);

/**
 * The cart lives on the server, which prices it from RSOF (same rules as the web's CartContext).
 * Taps change the local items at once and are saved in the background (cartSync: 300 ms of quiet,
 * one save at a time, latest state wins); totals and warnings come from the server's answer. The
 * total is RSOF's product prices: no delivery fee, VAT line or promo code.
 */
export function CartProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id;
  const { getProduct } = useCatalog();
  const [items, setItems] = useState<CartItem[]>([]);
  const [priced, setPriced] = useState<PricedCart | null>(null);
  const [notices, setNotices] = useState<Record<string, CartWarning>>({});
  const [status, setStatus] = useState<CartValue['status']>('idle');
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const itemsRef = useRef(items);

  const [sync] = useState(() =>
    createCartSync({
      put: putCart,
      onResult: (answer: PricedCart) => {
        const next = toItems(answer); // the server may have capped a quantity at the stock
        itemsRef.current = next;
        setItems(next);
        setPriced(answer);
        setSyncing(false);
      },
      onError: (e: unknown) => {
        setError(e);
        setSyncing(false);
      },
    }),
  );

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
      const answer: PricedCart = await getCart();
      const next = toItems(answer);
      itemsRef.current = next;
      setItems(next);
      setPriced(answer);
      setStatus('ready');
      const changed = answer.items.filter((l) => l.warning && NOTICES.includes(l.warning));
      setNotices(Object.fromEntries(changed.map((l) => [l.productId, l.warning])));
      // Save the adjusted cart so checkout accepts it; the notices stay until the next change.
      if (changed.length) {
        setSyncing(true);
        sync.schedule({ items: next });
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
    (nextItems: CartItem[]) => {
      itemsRef.current = nextItems;
      setItems(nextItems);
      setNotices({});
      setError(null);
      setSyncing(true);
      sync.schedule({ items: nextItems });
    },
    [sync],
  );

  const add = useCallback(
    (productId: string, qty = 1) => {
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
    (productId: string, qty: number) =>
      commit(itemsRef.current.map((i) => (i.productId === productId ? { ...i, qty: Math.max(1, Math.min(MAX_QTY, qty)) } : i))),
    [commit],
  );

  const remove = useCallback(
    (productId: string): Removed | null => {
      const prev = itemsRef.current;
      const index = prev.findIndex((i) => i.productId === productId);
      if (index < 0) return null;
      commit(prev.filter((i) => i.productId !== productId));
      return { item: prev[index], index };
    },
    [commit],
  );

  const restore = useCallback(
    ({ item, index }: Removed) => {
      const prev = itemsRef.current;
      if (prev.some((i) => i.productId === item.productId)) return;
      const next = [...prev];
      next.splice(Math.min(index, next.length), 0, item);
      commit(next);
    },
    [commit],
  );

  /** Waits for pending saves (before leaving the cart, before paying). Rejects if a save fails. */
  const flush = useCallback((): Promise<void> => sync.flush(), [sync]);

  const value = useMemo<CartValue>(() => {
    const lines = (cartLines(items, priced?.items || [], getProduct) as CartLine[]).map((l) => ({
      ...l,
      warning: l.warning || notices[l.productId] || null,
    }));
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
      quantityOf: (productId: string) => items.find((i) => i.productId === productId)?.qty || 0,
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

export function useCart(): CartValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used inside CartProvider');
  return ctx;
}
