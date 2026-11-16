import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { getProductDetail, listCategories, listProducts } from '@/services/catalogService.js';
import { useAuth } from './AuthContext.jsx';

const CatalogContext = createContext(null);
const STALE_MS = 60_000;
const EMPTY = { products: [], categories: [], status: 'loading', error: null };

/**
 * Products and categories, loaded once per session and again when the tab regains focus after a
 * minute. A failed reload keeps the last list; a failed first load gives status 'error'.
 */
export function CatalogProvider({ children }) {
  const { isAuthenticated } = useAuth();
  const [state, setState] = useState(EMPTY);
  const [full, setFull] = useState({}); // id → full product (with detail rows) or null when gone
  const loadedAt = useRef(0);

  /** Product page: fetch the full product once per session (the list copy shows meanwhile). */
  const loadProduct = useCallback(async (id) => {
    try {
      const product = await getProductDetail(id);
      setFull((f) => ({ ...f, [id]: product }));
    } catch (error) {
      if (error.code === 'not_found') setFull((f) => ({ ...f, [id]: null }));
    }
  }, []);

  const load = useCallback(async () => {
    setState((s) => ({ ...s, status: s.products.length ? 'ready' : 'loading', error: null }));
    try {
      const [categories, products] = await Promise.all([listCategories(), listProducts()]);
      loadedAt.current = Date.now();
      setState({ categories, products, status: 'ready', error: null });
    } catch (error) {
      setState((s) => ({ ...s, status: s.products.length ? 'ready' : 'error', error }));
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      loadedAt.current = 0;
      setState(EMPTY);
      setFull({});
      return undefined;
    }
    load();
    const onFocus = () => {
      if (Date.now() - loadedAt.current > STALE_MS) load();
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [isAuthenticated, load]);

  const value = useMemo(() => {
    const byId = new Map(state.products.map((p) => [p.id, p]));
    const getProduct = (id) => (id in full ? full[id] : byId.get(id) || null);
    return { ...state, refresh: load, getProduct, loadProduct };
  }, [state, full, load, loadProduct]);

  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>;
}

export function useCatalog() {
  const ctx = useContext(CatalogContext);
  if (!ctx) throw new Error('useCatalog must be used inside CatalogProvider');
  return ctx;
}
