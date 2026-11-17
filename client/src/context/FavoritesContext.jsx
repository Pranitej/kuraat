import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { getFavorites, putFavorites } from '@/services/cartService.js';
import { useAuth } from './AuthContext.jsx';

const FavoritesContext = createContext(null);

/**
 * Hearted products, saved on the server (ROF product ids, oldest first). Taps update at once; saves
 * run one after another. `status`: 'loading' until the first answer, then 'ready' or 'error'.
 */
export function FavoritesProvider({ children }) {
  const { user } = useAuth();
  const userId = user?.id;
  const [ids, setIds] = useState([]);
  const [status, setStatus] = useState('loading');
  const idsRef = useRef(ids);
  const queue = useRef(Promise.resolve());

  const apply = useCallback((next) => {
    idsRef.current = next;
    setIds(next);
  }, []);

  const load = useCallback(() => {
    setStatus((s) => (s === 'ready' ? s : 'loading'));
    return getFavorites().then(
      (saved) => {
        apply(saved);
        setStatus('ready');
      },
      () => setStatus((s) => (s === 'ready' ? s : 'error')),
    );
  }, [apply]);

  useEffect(() => {
    apply([]);
    setStatus('loading');
    if (!userId) return undefined;
    let alive = true;
    getFavorites()
      .then((saved) => {
        if (!alive) return;
        apply(saved);
        setStatus('ready');
      })
      .catch(() => alive && setStatus('error'));
    return () => {
      alive = false;
    };
  }, [userId, apply]);

  const save = useCallback((next) => {
    apply(next);
    // Each save sends the latest list; a failure re-reads what the server has.
    queue.current = queue.current
      .then(() => putFavorites(idsRef.current))
      .catch(() => getFavorites().then(apply))
      .catch(() => {});
  }, [apply]);

  const toggle = useCallback(
    (productId) => {
      const added = !idsRef.current.includes(productId);
      save(added ? [...idsRef.current, productId] : idsRef.current.filter((id) => id !== productId));
      return added;
    },
    [save],
  );

  /** Drops several ids in one save (products the catalogue no longer has). */
  const removeMany = useCallback((drop) => save(idsRef.current.filter((id) => !drop.includes(id))), [save]);

  const value = useMemo(
    () => ({ ids, status, isFavorite: (id) => ids.includes(id), toggle, removeMany, refresh: load }),
    [ids, status, toggle, removeMany, load],
  );
  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
}

export function useFavorites() {
  const ctx = useContext(FavoritesContext);
  if (!ctx) throw new Error('useFavorites must be used inside FavoritesProvider');
  return ctx;
}
