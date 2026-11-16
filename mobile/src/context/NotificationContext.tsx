import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { isAppActive, useAppActive } from '@/hooks/appState';
import * as api from '@/services/notificationService.js';
import type { AppNotification } from '@/types/api';
import { useAuth } from './AuthContext';
import { useOrders } from './OrderContext';

const POLL_MS = 30_000;

export type NotificationValue = {
  items: AppNotification[];
  loading: boolean;
  refresh: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  unreadCount: number;
};

const NotificationContext = createContext<NotificationValue | null>(null);

/**
 * The customer's notifications (newest first). Refreshed on sign-in, every 30 s while the app is in
 * front, when it comes back to the front, and whenever an order's status changes.
 */
export function NotificationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id;
  const { orders } = useOrders();
  const [items, setItems] = useState<AppNotification[]>([]);
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
      // keep the last list; the next poll retries
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    setItems([]);
    refresh();
    if (!userId) return undefined;
    const t = setInterval(() => {
      if (isAppActive()) refresh();
    }, POLL_MS);
    return () => clearInterval(t);
  }, [userId, refresh]);

  useEffect(() => {
    if (statusKey) refresh();
  }, [statusKey, refresh]);

  useAppActive(() => {
    if (userId) refresh();
  });

  const markRead = useCallback(async (id: string) => {
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    await api.markNotificationRead(id).catch(() => {});
  }, []);

  const markAllRead = useCallback(async () => {
    await api.markAllNotificationsRead();
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const value = useMemo<NotificationValue>(
    () => ({ items, loading, refresh, markRead, markAllRead, unreadCount: items.filter((n) => !n.read).length }),
    [items, loading, refresh, markRead, markAllRead],
  );

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export function useNotifications(): NotificationValue {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be used inside NotificationProvider');
  return ctx;
}
