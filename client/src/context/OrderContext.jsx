import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import * as api from '@/services/orderService.js';
import { useAuth } from './AuthContext.jsx';
import { useNow } from '@/hooks';

const OrderContext = createContext(null);

/**
 * Orders from the server. `byId` keeps every order seen (placed, opened, listed) so screens show
 * it at once and refresh it in the background.
 */
export function OrderProvider({ children }) {
  const { user } = useAuth();
  const userId = user?.id;
  const [byId, setById] = useState({});
  const now = useNow(30000);

  useEffect(() => {
    setById({});
  }, [userId]);

  const upsert = useCallback((order) => setById((m) => ({ ...m, [order.id]: order })), []);

  const placeOrder = useCallback(
    async (input) => {
      const order = await api.placeOrder(input);
      upsert(order);
      return order;
    },
    [upsert],
  );

  const value = useMemo(
    () => ({
      // The order list moves to the server in the next step; until then it is empty.
      orders: [],
      loading: false,
      refresh: async () => {},
      placeOrder,
      upsert,
      now,
      getById: (id) => byId[id] || null,
    }),
    [byId, placeOrder, upsert, now],
  );

  return <OrderContext.Provider value={value}>{children}</OrderContext.Provider>;
}

export function useOrders() {
  const ctx = useContext(OrderContext);
  if (!ctx) throw new Error('useOrders must be used inside OrderProvider');
  return ctx;
}

/** One order: the copy already seen first, then fresh from the server (live RSOF status). */
export function useOrder(id) {
  const { getById, upsert } = useOrders();
  const order = getById(id);
  const [state, setState] = useState({ loading: true, error: null });

  const refresh = useCallback(async () => {
    try {
      upsert(await api.getOrder(id));
      setState({ loading: false, error: null });
    } catch (error) {
      setState({ loading: false, error });
    }
  }, [id, upsert]);

  useEffect(() => {
    setState({ loading: true, error: null });
    refresh();
  }, [refresh]);

  return { order, loading: state.loading && !order, error: state.error, refresh };
}
