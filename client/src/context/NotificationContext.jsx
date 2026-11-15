import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import * as api from '@/services/notificationService.js';
import { getDb } from '@/services/db.js';
import { useAuth } from './AuthContext.jsx';
import { useOrders } from './OrderContext.jsx';

const NotificationContext = createContext(null);

const sortList = (list) => [...list].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

export function NotificationProvider({ children }) {
  const { user } = useAuth();
  const userId = user?.id;
  const { orders, now } = useOrders();
  const [items, setItems] = useState(() => (userId ? sortList(getDb().notifications?.[userId] || []) : []));
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!userId) return setItems([]);
    setLoading(true);
    try {
      setItems(await api.listNotifications(userId));
    } finally {
      setLoading(false);
    }
    return undefined;
  }, [userId]);

  // Refresh when the user changes, when orders change, and as the clock moves (status pushes)
  useEffect(() => {
    if (!userId) {
      setItems([]);
      return;
    }
    if (api.syncOrderNotifications(userId)) refresh();
    else setItems(sortList(getDb().notifications?.[userId] || []));
  }, [userId, orders, now, refresh]);

  const markRead = useCallback(
    async (id) => {
      setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
      await api.markNotificationRead(userId, id);
    },
    [userId],
  );

  const markAllRead = useCallback(async () => {
    await api.markAllNotificationsRead(userId);
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
  }, [userId]);

  const value = useMemo(
    () => ({ items, loading, refresh, markRead, markAllRead, unreadCount: items.filter((n) => !n.read).length }),
    [items, loading, refresh, markRead, markAllRead],
  );

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be used inside NotificationProvider');
  return ctx;
}
