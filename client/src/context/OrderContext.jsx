import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { orderStatusView } from '@/domain';
import * as api from '@/services/orderService.js';
import { useAuth } from './AuthContext.jsx';
import { useNow } from '@/hooks';

const OrderContext = createContext(null);
const POLL_MS = 30_000;
const isOngoing = (o) => orderStatusView(o).ongoing;
const whenVisible = (fn) => () => {
  if (document.visibilityState === 'visible') fn();
};

/**
 * The customer's orders from the server (status read live from RSOF). Every order seen — listed,
 * placed or opened — is kept by id so screens show it at once and refresh it in the background.
 * The list is re-read every 30 s while any order is still on its way.
 */
export function OrderProvider({ children }) {
  const { user } = useAuth();
  const userId = user?.id;
  const [byId, setById] = useState({});
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(null);
  const now = useNow(POLL_MS);

  const upsert = useCallback((order) => setById((m) => ({ ...m, [order.id]: order })), []);

  /** force: the refresh button — fresh from RSOF, and a failure is thrown for the button's toast. */
  const refresh = useCallback(async ({ force = false } = {}) => {
    if (!userId) return;
    setLoading(true);
    try {
      const list = await api.listOrders({ refresh: force });
      setById((m) => ({ ...m, ...Object.fromEntries(list.map((o) => [o.id, o])) }));
      setError(null);
    } catch (e) {
      setError(e);
      if (force) throw e;
    } finally {
      setLoading(false);
      setLoaded(true);
    }
  }, [userId]);

  useEffect(() => {
    setById({});
    setLoaded(false);
    setError(null);
    refresh();
  }, [refresh]);

  const orders = useMemo(() => Object.values(byId).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)), [byId]);
  const anyOngoing = orders.some(isOngoing);

  useEffect(() => {
    if (!anyOngoing) return undefined;
    const t = setInterval(whenVisible(refresh), POLL_MS);
    return () => clearInterval(t);
  }, [anyOngoing, refresh]);

  const placeOrder = useCallback(
    async (input) => {
      const order = await api.placeOrder(input);
      upsert(order);
      return order;
    },
    [upsert],
  );

  const value = useMemo(
    () => ({ orders, loading, loaded, error, refresh, placeOrder, upsert, now, getById: (id) => byId[id] || null }),
    [orders, loading, loaded, error, refresh, placeOrder, upsert, now, byId],
  );

  return <OrderContext.Provider value={value}>{children}</OrderContext.Provider>;
}

export function useOrders() {
  const ctx = useContext(OrderContext);
  if (!ctx) throw new Error('useOrders must be used inside OrderProvider');
  return ctx;
}

/**
 * One order: the copy already seen first, then fresh from the server; re-read every 30 s while it
 * is on its way (the tracking screen). Also cancel and delivery-code resend.
 */
export function useOrder(id) {
  const { getById, upsert } = useOrders();
  const order = getById(id);
  const [state, setState] = useState({ loading: true, error: null });

  const refresh = useCallback(
    async ({ force = false } = {}) => {
      try {
        upsert(await api.getOrder(id, { refresh: force }));
        setState({ loading: false, error: null });
      } catch (error) {
        setState({ loading: false, error });
        if (force) throw error;
      }
    },
    [id, upsert],
  );

  useEffect(() => {
    setState({ loading: true, error: null });
    refresh();
  }, [refresh]);

  const ongoing = order ? isOngoing(order) : false;
  useEffect(() => {
    if (!ongoing) return undefined;
    const t = setInterval(whenVisible(refresh), POLL_MS);
    return () => clearInterval(t);
  }, [ongoing, refresh]);

  const cancel = useCallback(async () => upsert(await api.cancelOrder(id)), [id, upsert]);
  const resendCode = useCallback(() => api.resendCode(id), [id]);

  return { order, loading: state.loading && !order, error: state.error, refresh, cancel, resendCode };
}
