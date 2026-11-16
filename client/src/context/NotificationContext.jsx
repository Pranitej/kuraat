import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import * as api from '@/services/notificationService.js';
import { useAuth } from './AuthContext.jsx';
import { useOrders } from './OrderContext.jsx';

const NotificationContext = createContext(null);
const POLL_MS = 30_000;

/**
 * The customer's notifications (newest first). Refreshed on sign-in, every 30 s while the tab is
 * visible, and whenever an order's status changes (the server notifies about those).
 */
export function NotificationProvider({ children }) {
  const { user } = useAuth();
  const userId = user?.id;
  const { orders } = useOrders();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const statusKey = orders.map((o) => `${o.id}:${o.status.id}`).join('|');

  const refresh = useCallback(async () => {
    if (!userId) {
      setItems([]);
      return;
    }
    setLoading(true);
    try {
      setItems(await api.listNotifications());
    } catch {
      // keep the last list; the bell retries on the next poll
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    setItems([]);
    refresh();
    if (!userId) return undefined;
    const t = setInterval(() => {
      if (document.visibilityState === 'visible') refresh();
    }, POLL_MS);
    return () => clearInterval(t);
  }, [userId, refresh]);

  useEffect(() => {
    if (statusKey) refresh();
  }, [statusKey, refresh]);

  const markRead = useCallback(async (id) => {
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    await api.markNotificationRead(id).catch(() => {});
  }, []);

  const markAllRead = useCallback(async () => {
    await api.markAllNotificationsRead();
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

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
