import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useAppActive } from '@/hooks/appState';
import { getProductDetail, listCategories, listProducts } from '@/services/catalogService.js';
import type { Category, Product } from '@/types/api';
import { useAuth } from './AuthContext';

const STALE_MS = 60_000;

type State = { products: Product[]; categories: Category[]; status: 'loading' | 'ready' | 'error'; error: unknown };
const EMPTY: State = { products: [], categories: [], status: 'loading', error: null };

export type CatalogValue = State & {
  refresh: () => Promise<void>;
  getProduct: (id: string) => Product | null;
  loadProduct: (id: string) => Promise<void>;
};

const CatalogContext = createContext<CatalogValue | null>(null);

/**
 * Products and categories, loaded once per session and again when the app comes back to the front
 * after a minute (web: tab focus). A failed reload keeps the last list; a failed first load → 'error'.
 */
export function CatalogProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [state, setState] = useState<State>(EMPTY);
  const [full, setFull] = useState<Record<string, Product | null>>({});
  const loadedAt = useRef(0);

  /** Product screen: the full product once per session (the list copy shows meanwhile). */
  const loadProduct = useCallback(async (id: string) => {
    try {
      const product = await getProductDetail(id);
      setFull((f) => ({ ...f, [id]: product }));
    } catch (error) {
      if ((error as { code?: string }).code === 'not_found') setFull((f) => ({ ...f, [id]: null }));
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
      return;
    }
    load();
  }, [isAuthenticated, load]);

  useAppActive(() => {
    if (isAuthenticated && Date.now() - loadedAt.current > STALE_MS) load();
  });

  const value = useMemo<CatalogValue>(() => {
    const byId = new Map(state.products.map((p) => [p.id, p]));
    const getProduct = (id: string) => (id in full ? full[id] : byId.get(id) || null);
    return { ...state, refresh: load, getProduct, loadProduct };
  }, [state, full, load, loadProduct]);

  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>;
}

export function useCatalog(): CatalogValue {
  const ctx = useContext(CatalogContext);
  if (!ctx) throw new Error('useCatalog must be used inside CatalogProvider');
  return ctx;
}
