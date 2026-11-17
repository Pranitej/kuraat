import { act, renderHook, waitFor } from '@testing-library/react-native';
import { AppState } from 'react-native';
import { tokenStore } from '@/lib/storage.js';
import { apiRequest } from '@/services/api.js';
import { jestFetch, type FetchCall } from '@/test/jestFetch';
import { AppProviders } from '@/context/AppProviders';
import { useAuth } from '@/context/AuthContext';
import { useCart } from '@/context/CartContext';
import { useCheckout } from '@/context/CheckoutContext';
import { useOrders } from '@/context/OrderContext';

const USER = {
  id: 'u1',
  name: 'Sara Al-Mutairi',
  phone: '501234821',
  email: null,
  gender: 'female',
  avatar: null,
  hasPassword: true,
  createdAt: '2026-11-15T09:00:00.000Z',
};
const TOKENS = { accessToken: 'a1', refreshToken: 'r1' };
const PRODUCT = {
  id: 'p1',
  name: 'Truffle Box · Classic',
  price: 185,
  images: [],
  inStock: true,
  maxQuantity: 20,
  categoryId: 'c1',
  categoryName: 'Truffles',
};
const ONGOING = {
  id: 'o1',
  number: 'KR-20418',
  status: { id: 'preparing', label: 'Preparing', step: 1, cancelled: false },
  createdAt: '2026-11-16T09:21:00.000Z',
};

type Items = { productId: string; qty: number }[];
const priced = (items: Items, promoCode: string | null = null) => ({
  items: items.map((i) => ({
    ...i,
    product: { id: i.productId, name: PRODUCT.name, price: 185, images: [] },
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

/** A signed-in customer's server; `extra` answers first. */
function server(extra: (c: FetchCall) => { status?: number; body?: unknown } | undefined = () => undefined) {
  return jestFetch((c) => {
    const hit = extra(c);
    if (hit) return hit;
    if (c.path === '/me') return { body: USER };
    if (c.path === '/cart' && c.method === 'GET') return { body: priced([]) };
    if (c.path === '/cart' && c.method === 'PUT') {
      const b = c.body as { items: Items; promoCode: string | null };
      return { body: priced(b.items, b.promoCode) };
    }
    if (c.path === '/categories') return { body: [{ id: 'c1', name: 'Truffles' }] };
    if (c.path === '/products') return { body: [PRODUCT] };
    if (c.path === '/branches') return { body: [] };
    if (c.path === '/addresses') return { body: [] };
    if (c.path === '/orders') return { body: [] };
    return { status: 404, body: { code: 'not_found', message: 'nope' } };
  });
}

const useAll = () => ({ auth: useAuth(), cart: useCart(), orders: useOrders(), checkout: useCheckout() });

beforeEach(() => {
  tokenStore.remove();
  Object.defineProperty(AppState, 'currentState', { value: 'active', configurable: true });
});
afterEach(() => jest.useRealTimers());

describe('AuthProvider', () => {
  test('restores the session from the keychain tokens', async () => {
    tokenStore.write(TOKENS);
    server();
    const { result } = await renderHook(useAll, { wrapper: AppProviders });
    await waitFor(() => expect(result.current.auth.status).toBe('ready'));
    expect(result.current.auth.user?.id).toBe('u1');
  });

  test('server unreachable at start: ready and signed out (no endless splash)', async () => {
    tokenStore.write(TOKENS);
    global.fetch = jest.fn(async () => {
      throw new TypeError('Network request failed');
    }) as unknown as typeof fetch;
    const { result } = await renderHook(useAll, { wrapper: AppProviders });
    await waitFor(() => expect(result.current.auth.status).toBe('ready'));
    expect(result.current.auth.user).toBeNull();
  });

  test('two requests refused at once: one refresh, then signed out once', async () => {
    tokenStore.write(TOKENS);
    let signedIn = true;
    const calls = server((c) => {
      if (c.path === '/auth/refresh') return { status: 401, body: { code: 'unauthorized', message: 'Please sign in again.' } };
      if (!signedIn && c.path !== '/auth/signout') return { status: 401, body: { code: 'unauthorized', message: 'Please sign in again.' } };
      return undefined;
    });
    const { result } = await renderHook(useAll, { wrapper: AppProviders });
    await waitFor(() => expect(result.current.auth.user?.id).toBe('u1'));
    signedIn = false;
    await act(async () => {
      await Promise.allSettled([apiRequest('/orders'), apiRequest('/addresses')]);
    });
    expect(calls.filter((c) => c.path === '/auth/refresh')).toHaveLength(1);
    await waitFor(() => expect(result.current.auth.user).toBeNull());
    expect(tokenStore.read()).toBeNull();
  });
});

describe('CartProvider', () => {
  test('taps update at once; three quick adds are saved with one PUT', async () => {
    tokenStore.write(TOKENS);
    const calls = server();
    const { result } = await renderHook(useAll, { wrapper: AppProviders });
    await waitFor(() => expect(result.current.cart.status).toBe('ready'));
    await act(async () => {
      result.current.cart.add('p1');
      result.current.cart.add('p1');
      result.current.cart.add('p1');
    });
    expect(result.current.cart.count).toBe(3);
    await waitFor(() => expect(calls.filter((c) => c.path === '/cart' && c.method === 'PUT')).toHaveLength(1));
    const put = calls.find((c) => c.method === 'PUT');
    expect(put?.body).toEqual({ items: [{ productId: 'p1', qty: 3 }], promoCode: null });
  });

  test('a promo code saved before codes were removed is cleared on load', async () => {
    tokenStore.write(TOKENS);
    const calls = server((c) =>
      c.path === '/cart' && c.method === 'GET' ? { body: priced([{ productId: 'p1', qty: 1 }], 'KURAAT10') } : undefined,
    );
    const { result } = await renderHook(useAll, { wrapper: AppProviders });
    await waitFor(() => expect(result.current.cart.status).toBe('ready'));
    await waitFor(() => expect(calls.find((c) => c.path === '/cart' && c.method === 'PUT')?.body).toEqual({ items: [{ productId: 'p1', qty: 1 }], promoCode: null }));
  });
});

describe('OrderProvider', () => {
  test('re-reads orders every 30 s while one is on its way — only while the app is in front', async () => {
    jest.useFakeTimers();
    tokenStore.write(TOKENS);
    const calls = server((c) => (c.path === '/orders' ? { body: [ONGOING] } : undefined));
    const { result } = await renderHook(useAll, { wrapper: AppProviders });
    await waitFor(() => expect(result.current.orders.orders).toHaveLength(1));
    const reads = () => calls.filter((c) => c.path === '/orders').length;

    const before = reads();
    await act(async () => {
      await jest.advanceTimersByTimeAsync(30_000);
    });
    expect(reads()).toBe(before + 1);

    Object.defineProperty(AppState, 'currentState', { value: 'background', configurable: true });
    await act(async () => {
      await jest.advanceTimersByTimeAsync(30_000);
    });
    expect(reads()).toBe(before + 1);
  });
});

describe('CheckoutProvider', () => {
  test('one idempotency key per checkout, renewed on demand, dropped on sign-out', async () => {
    tokenStore.write(TOKENS);
    server((c) => (c.path === '/auth/signout' ? { status: 204 } : undefined));
    const { result } = await renderHook(useAll, { wrapper: AppProviders });
    await waitFor(() => expect(result.current.auth.user?.id).toBe('u1'));

    let first = '';
    let again = '';
    await act(async () => {
      first = result.current.checkout.ensureIdempotencyKey();
      again = result.current.checkout.ensureIdempotencyKey();
    });
    expect(first).toMatch(/^[0-9a-f-]{36}$/);
    expect(again).toBe(first);

    let renewed = '';
    await act(async () => {
      renewed = result.current.checkout.renewIdempotencyKey();
    });
    expect(renewed).not.toBe(first);

    await act(async () => {
      await result.current.auth.signOut();
    });
    await waitFor(() => expect(result.current.checkout.idempotencyKey).toBeNull());
  });
});
