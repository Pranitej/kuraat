import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { orderStatusView } from '@/domain';
import { isAppActive, useAppActive } from '@/hooks/appState';
import { useNow } from '@/hooks';
import * as api from '@/services/orderService.js';
import type { Order } from '@/types/api';
import { useAuth } from './AuthContext';

const POLL_MS = 30_000;
const isOngoing = (o: Order) => orderStatusView(o).ongoing as boolean;
/** Only while the app is in front (web: while the tab is visible). */
const whenActive = (fn: () => void) => () => {
  if (isAppActive()) fn();
};

export type PlaceOrderInput = {
  addressId: string;
  deliveryPhone: string;
  /** Built by the shared toPaymentBody (orderService.js). */
  payment: { method: string } & Record<string, unknown>;
  idempotencyKey: string;
};

export type OrderValue = {
  orders: Order[];
  loading: boolean;
  loaded: boolean;
  error: unknown;
  refresh: () => Promise<void>;
  placeOrder: (input: PlaceOrderInput) => Promise<Order>;
  upsert: (order: Order) => void;
  now: Date;
  getById: (id: string) => Order | null;
};

const OrderContext = createContext<OrderValue | null>(null);

/**
 * The customer's orders from the server (status read live from RSOF). Every order seen is kept by
 * id so screens show it at once and refresh it in the background. The list is re-read every 30 s
 * while any order is still on its way, and when the app comes back to the front.
 */
export function OrderProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id;
  const [byId, setById] = useState<Record<string, Order>>({});
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const now = useNow(POLL_MS);

  const upsert = useCallback((order: Order) => setById((m) => ({ ...m, [order.id]: order })), []);

  const refresh = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const list: Order[] = await api.listOrders();
      setById((m) => ({ ...m, ...Object.fromEntries(list.map((o) => [o.id, o])) }));
      setError(null);
    } catch (e) {
      setError(e);
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

  const orders = useMemo(() => Object.values(byId).sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)), [byId]);
  const anyOngoing = orders.some(isOngoing);

  useEffect(() => {
    if (!anyOngoing) return undefined;
    const t = setInterval(whenActive(refresh), POLL_MS);
    return () => clearInterval(t);
  }, [anyOngoing, refresh]);

  useAppActive(() => {
    if (anyOngoing) refresh();
  });

  const placeOrder = useCallback(
    async (input: PlaceOrderInput) => {
      const order: Order = await api.placeOrder(input);
      upsert(order);
      return order;
    },
    [upsert],
  );

  const value = useMemo<OrderValue>(
    () => ({ orders, loading, loaded, error, refresh, placeOrder, upsert, now, getById: (id: string) => byId[id] || null }),
    [orders, loading, loaded, error, refresh, placeOrder, upsert, now, byId],
  );

  return <OrderContext.Provider value={value}>{children}</OrderContext.Provider>;
}

export function useOrders(): OrderValue {
  const ctx = useContext(OrderContext);
  if (!ctx) throw new Error('useOrders must be used inside OrderProvider');
  return ctx;
}

/**
 * One order: the copy already seen first, then fresh from the server; re-read every 30 s while it
 * is on its way (the tracking screen). Also cancel and delivery-code resend.
 */
export function useOrder(id: string) {
  const { getById, upsert } = useOrders();
  const order = getById(id);
  const [state, setState] = useState<{ loading: boolean; error: unknown }>({ loading: true, error: null });

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

  const ongoing = order ? isOngoing(order) : false;
  useEffect(() => {
    if (!ongoing) return undefined;
    const t = setInterval(whenActive(refresh), POLL_MS);
    return () => clearInterval(t);
  }, [ongoing, refresh]);

  useAppActive(() => {
    if (ongoing) refresh();
  });

  const cancel = useCallback(async () => upsert(await api.cancelOrder(id)), [id, upsert]);
  const resendCode = useCallback((): Promise<{ sent: boolean; resendAt: string }> => api.resendCode(id), [id]);

  return { order, loading: state.loading && !order, error: state.error, refresh, cancel, resendCode };
}
