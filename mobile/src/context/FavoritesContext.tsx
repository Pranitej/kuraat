import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { getFavorites, putFavorites } from '@/services/cartService.js';
import { useAuth } from './AuthContext';

export type FavoritesStatus = 'loading' | 'ready' | 'error';

export type FavoritesValue = {
  ids: string[];
  status: FavoritesStatus;
  isFavorite: (id: string) => boolean;
  toggle: (productId: string) => boolean;
  removeMany: (ids: string[]) => void;
  refresh: () => Promise<void>;
};

const FavoritesContext = createContext<FavoritesValue | null>(null);

/**
 * Hearted products, saved on the server (ROF product ids, oldest first). Taps update at once; saves
 * run one after another. `status`: 'loading' until the first answer, then 'ready' or 'error'.
 */
export function FavoritesProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id;
  const [ids, setIds] = useState<string[]>([]);
  const [status, setStatus] = useState<FavoritesStatus>('loading');
  const idsRef = useRef(ids);
  const queue = useRef<Promise<unknown>>(Promise.resolve());

  const apply = useCallback((next: string[]) => {
    idsRef.current = next;
    setIds(next);
  }, []);

  const load = useCallback(async () => {
    setStatus((s) => (s === 'ready' ? s : 'loading'));
    try {
      apply(await getFavorites());
      setStatus('ready');
    } catch {
      setStatus((s) => (s === 'ready' ? s : 'error'));
    }
  }, [apply]);

  useEffect(() => {
    apply([]);
    setStatus('loading');
    if (!userId) return undefined;
    let alive = true;
    getFavorites()
      .then((saved: string[]) => {
        if (!alive) return;
        apply(saved);
        setStatus('ready');
      })
      .catch(() => {
        if (alive) setStatus('error');
      });
    return () => {
      alive = false;
    };
  }, [userId, apply]);

  const save = useCallback(
    (next: string[]) => {
      apply(next);
      // Each save sends the latest list; a failure re-reads what the server has.
      queue.current = queue.current
        .then(() => putFavorites(idsRef.current))
        .catch(() => getFavorites().then(apply))
        .catch(() => {});
    },
    [apply],
  );

  const toggle = useCallback(
    (productId: string) => {
      const added = !idsRef.current.includes(productId);
      save(added ? [...idsRef.current, productId] : idsRef.current.filter((id) => id !== productId));
      return added;
    },
    [save],
  );

  /** Drops several ids in one save (products the catalogue no longer has). */
  const removeMany = useCallback((drop: string[]) => save(idsRef.current.filter((id) => !drop.includes(id))), [save]);

  const value = useMemo<FavoritesValue>(
    () => ({ ids, status, isFavorite: (id: string) => ids.includes(id), toggle, removeMany, refresh: load }),
    [ids, status, toggle, removeMany, load],
  );
  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
}

export function useFavorites(): FavoritesValue {
  const ctx = useContext(FavoritesContext);
  if (!ctx) throw new Error('useFavorites must be used inside FavoritesProvider');
  return ctx;
}
