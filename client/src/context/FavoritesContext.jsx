import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { readFavorites, writeFavorites } from '@/services/cartService.js';
import { useAuth } from './AuthContext.jsx';

const FavoritesContext = createContext(null);

export function FavoritesProvider({ children }) {
  const { user } = useAuth();
  const userId = user?.id;
  const [ids, setIds] = useState(() => (userId ? readFavorites(userId) : []));
  const idsRef = useRef(ids);
  idsRef.current = ids;

  useEffect(() => {
    setIds(userId ? readFavorites(userId) : []);
  }, [userId]);

  const toggle = useCallback(
    (productId) => {
      const added = !idsRef.current.includes(productId);
      const next = added ? [...idsRef.current, productId] : idsRef.current.filter((id) => id !== productId);
      idsRef.current = next;
      if (userId) writeFavorites(userId, next);
      setIds(next);
      return added;
    },
    [userId],
  );

  const value = useMemo(() => ({ ids, isFavorite: (id) => ids.includes(id), toggle }), [ids, toggle]);
  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
}

export function useFavorites() {
  const ctx = useContext(FavoritesContext);
  if (!ctx) throw new Error('useFavorites must be used inside FavoritesProvider');
  return ctx;
}
