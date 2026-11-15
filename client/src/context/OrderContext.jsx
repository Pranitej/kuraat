import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import * as api from '@/services/orderService.js';
import { getDb } from '@/services/db.js';
import { useAuth } from './AuthContext.jsx';
import { useNow } from '@/hooks';

const OrderContext = createContext(null);

const sortOrders = (list) => [...list].sort((a, b) => new Date(b.schedule.createdAt) - new Date(a.schedule.createdAt));

export function OrderProvider({ children }) {
  const { user } = useAuth();
  const userId = user?.id;
  const [orders, setOrders] = useState(() => (userId ? sortOrders(getDb().orders?.[userId] || []) : []));
  const [loading, setLoading] = useState(false);
  const now = useNow(20000); // live status updates

  const refresh = useCallback(async () => {
    if (!userId) return setOrders([]);
    setLoading(true);
    try {
      setOrders(await api.listOrders(userId));
    } finally {
      setLoading(false);
    }
    return undefined;
  }, [userId]);

  useEffect(() => {
    setOrders(userId ? sortOrders(getDb().orders?.[userId] || []) : []);
    refresh();
  }, [userId, refresh]);

  const placeOrder = useCallback(
    async (input) => {
      const order = await api.placeOrder({ ...input, userId });
      setOrders((prev) => sortOrders([order, ...prev.filter((o) => o.id !== order.id)]));
      return order;
    },
    [userId],
  );

  const value = useMemo(
    () => ({ orders, loading, refresh, placeOrder, now, getById: (id) => orders.find((o) => o.id === id) || null }),
    [orders, loading, refresh, placeOrder, now],
  );

  return <OrderContext.Provider value={value}>{children}</OrderContext.Provider>;
}

export function useOrders() {
  const ctx = useContext(OrderContext);
  if (!ctx) throw new Error('useOrders must be used inside OrderProvider');
  return ctx;
}
