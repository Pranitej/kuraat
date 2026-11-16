import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { getFavorites, putFavorites } from '@/services/cartService.js';
import { useAuth } from './AuthContext';

export type FavoritesValue = { ids: string[]; isFavorite: (id: string) => boolean; toggle: (productId: string) => boolean };

const FavoritesContext = createContext<FavoritesValue | null>(null);

/** Hearted products, saved on the server. Taps update at once; saves run one after another. */
export function FavoritesProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id;
  const [ids, setIds] = useState<string[]>([]);
  const idsRef = useRef(ids);
  const queue = useRef<Promise<unknown>>(Promise.resolve());

  useEffect(() => {
    idsRef.current = [];
    setIds([]);
    if (!userId) return undefined;
    let alive = true;
    getFavorites()
      .then((saved: string[]) => {
        if (!alive) return;
        idsRef.current = saved;
        setIds(saved);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [userId]);

  const toggle = useCallback((productId: string) => {
    const added = !idsRef.current.includes(productId);
    const next = added ? [...idsRef.current, productId] : idsRef.current.filter((id) => id !== productId);
    idsRef.current = next;
    setIds(next);
    // Each save sends the latest list; a failure re-reads what the server has.
    queue.current = queue.current
      .then(() => putFavorites(idsRef.current))
      .catch(() =>
        getFavorites().then((saved: string[]) => {
          idsRef.current = saved;
          setIds(saved);
        }),
      )
      .catch(() => {});
    return added;
  }, []);

  const value = useMemo<FavoritesValue>(() => ({ ids, isFavorite: (id: string) => ids.includes(id), toggle }), [ids, toggle]);
  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
}

export function useFavorites(): FavoritesValue {
  const ctx = useContext(FavoritesContext);
  if (!ctx) throw new Error('useFavorites must be used inside FavoritesProvider');
  return ctx;
}
