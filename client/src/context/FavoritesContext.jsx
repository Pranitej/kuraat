import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { getFavorites, putFavorites } from '@/services/cartService.js';
import { useAuth } from './AuthContext.jsx';

const FavoritesContext = createContext(null);

/** Hearted products, saved on the server. Taps update at once; saves run one after another. */
export function FavoritesProvider({ children }) {
  const { user } = useAuth();
  const userId = user?.id;
  const [ids, setIds] = useState([]);
  const idsRef = useRef(ids);
  const queue = useRef(Promise.resolve());

  useEffect(() => {
    idsRef.current = [];
    setIds([]);
    if (!userId) return undefined;
    let alive = true;
    getFavorites()
      .then((saved) => {
        if (!alive) return;
        idsRef.current = saved;
        setIds(saved);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [userId]);

  const toggle = useCallback((productId) => {
    const added = !idsRef.current.includes(productId);
    const next = added ? [...idsRef.current, productId] : idsRef.current.filter((id) => id !== productId);
    idsRef.current = next;
    setIds(next);
    // Each save sends the latest list; a failure re-reads what the server has.
    queue.current = queue.current
      .then(() => putFavorites(idsRef.current))
      .catch(() =>
        getFavorites().then((saved) => {
          idsRef.current = saved;
          setIds(saved);
        }),
      )
      .catch(() => {});
    return added;
  }, []);

  const value = useMemo(() => ({ ids, isFavorite: (id) => ids.includes(id), toggle }), [ids, toggle]);
  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
}

export function useFavorites() {
  const ctx = useContext(FavoritesContext);
  if (!ctx) throw new Error('useFavorites must be used inside FavoritesProvider');
  return ctx;
}
