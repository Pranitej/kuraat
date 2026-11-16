/**
 * Renders a screen the way the app does (safe areas, toast, all data providers) against a fake
 * kuraat server. Pair with `jest.mock('expo-router', …routerMock)` in the test file.
 */
import { render, waitFor } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppProviders } from '@/context/AppProviders';
import { useAuth } from '@/context/AuthContext';
import { ToastProvider } from '@/context/ToastContext';
import { tokenStore } from '@/lib/storage.js';
import { jestFetch, type FetchCall } from './jestFetch';

export const USER = {
  id: 'u1',
  name: 'Sara Al-Mutairi',
  phone: '501234821',
  email: 'sara.m@example.com',
  gender: 'female',
  avatar: null,
  hasPassword: true,
  createdAt: '2026-11-15T09:00:00.000Z',
};

export const PRODUCTS = [
  {
    id: 'p1',
    name: 'Truffle Box · Classic',
    description: ['Twelve hand-rolled truffles.'],
    price: 185,
    categoryId: 'c1',
    categoryName: 'Truffles',
    images: ['https://example.test/p1.jpg'],
    inStock: true,
    maxQuantity: 20,
    meta: '30 pcs · 480 g',
    subtitle: 'Signature gift box',
    badge: null,
    featured: true,
    highlights: [],
    ingredients: '',
    allergens: [],
    details: [],
  },
];

type Reply = { status?: number; body?: unknown } | undefined;
type Items = { productId: string; qty: number }[];

export const pricedCart = (items: Items, promoCode: string | null = null) => ({
  items: items.map((i) => ({
    ...i,
    product: { id: i.productId, name: PRODUCTS[0].name, price: 185, images: [] },
    lineTotal: 185 * i.qty,
    available: true,
    maxQuantity: 20,
    warning: null,
  })),
  promo: promoCode
    ? {
        code: promoCode,
        label: null,
        valid: promoCode === 'KURAAT10',
        error: promoCode === 'KURAAT10' ? undefined : "This code isn't valid.",
      }
    : null,
  totals: { count: items.reduce((s, i) => s + i.qty, 0), subtotal: 0, discount: 0, delivery: 15, total: 0, vat: 0 },
});

/** The demo customer's server; `extra` answers first (return undefined to fall through). */
export function fakeServer(extra: (c: FetchCall) => Reply = () => undefined) {
  return jestFetch((c) => {
    const hit = extra(c);
    if (hit) return hit;
    if (c.path === '/me') return { body: USER };
    if (c.path === '/cart' && c.method === 'GET') return { body: pricedCart([]) };
    if (c.path === '/cart' && c.method === 'PUT') {
      const b = c.body as { items: Items; promoCode: string | null };
      return { body: pricedCart(b.items, b.promoCode) };
    }
    if (c.path === '/favorites') return { body: { productIds: [] } };
    if (c.path === '/categories') return { body: [{ id: 'c1', name: 'Truffles' }] };
    if (c.path === '/products') return { body: PRODUCTS };
    if (c.path.startsWith('/products/')) return { body: PRODUCTS[0] };
    if (c.path === '/branches') return { body: [] };
    if (c.path === '/addresses') return { body: [] };
    if (c.path === '/orders' && c.method === 'GET') return { body: [] };
    if (c.path === '/notifications') return { body: [] };
    if (c.path === '/auth/signout') return { status: 204 };
    return { status: 404, body: { code: 'not_found', message: 'We could not find that.' } };
  });
}

/** Like the app's guarded routes: a screen mounts only once the stored session has been checked. */
function SessionChecked({ children }: { children: ReactElement }) {
  return useAuth().status === 'ready' ? children : null;
}

const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };

/**
 * Renders `ui` signed in (default) or out, with `server` answering; waits for the session check.
 * The session store (pending OTP, checkout draft) is left as the test set it — clear it in beforeEach.
 */
export async function renderScreen(ui: ReactElement, { signedIn = true, server = (() => undefined) as (c: FetchCall) => Reply } = {}) {
  if (signedIn) tokenStore.write({ accessToken: 'a1', refreshToken: 'r1' });
  else tokenStore.remove();
  const calls = fakeServer(server);
  const utils = await render(
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider initialMetrics={metrics}>
        <ToastProvider>
          <AppProviders>
            <SessionChecked>{ui}</SessionChecked>
          </AppProviders>
        </ToastProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>,
  );
  await waitFor(() => expect(calls.some((c) => c.path === '/me') || !signedIn).toBe(true));
  return { ...utils, calls };
}
