import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { BackHandler } from 'react-native';
import { session } from '@/lib/storage.js';
import type { FetchCall } from '@/test/jestFetch';
import { renderScreen } from '@/test/renderScreen';
import { mockRouter, resetRouterMock, setMockParams } from '@/test/routerMock';
import OrderConfirmedScreen from '../OrderConfirmedScreen';
import PaymentScreen from '../PaymentScreen';

jest.mock('expo-router', () => require('@/test/routerMock').expoRouterMock);

const CART = {
  items: [
    {
      productId: 'p1',
      qty: 1,
      product: { id: 'p1', name: 'Truffle Box · Classic', price: 185, images: [] },
      lineTotal: 185,
      available: true,
      maxQuantity: 20,
      warning: null,
    },
  ],
  promo: null,
  totals: { count: 1, subtotal: 185, discount: 0, delivery: 15, total: 200, vat: 26.09 },
};
const ADDRESS = {
  id: 'a1',
  label: 'Home',
  type: 'home',
  line: 'Building 12, Prince Turki St',
  district: 'Al Rakah',
  city: 'Al Khobar',
  postcode: '34227',
  landmark: '',
  phone: '501234821',
  contactName: 'Sara',
  location: { lat: 26.2874, lng: 50.2085 },
  isDefault: true,
};
const ORDER = {
  id: 'o1',
  number: 'KR-20418',
  status: { id: 'confirmed', label: 'Confirmed', step: 0, cancelled: false },
  steps: [],
  items: [{ productId: 'p1', name: 'Truffle Box · Classic', qty: 1, price: 185, image: null }],
  subtotal: 185,
  discount: 0,
  deliveryFee: 15,
  vat: 26.09,
  total: 200,
  promoCode: null,
  payment: { method: 'card', brand: 'Visa', last4: '4242', upiId: null, transactionId: 'TX-1', paidAt: '2026-11-16T09:21:00.000Z' },
  branch: { id: 'b1', name: 'Al Khobar Corniche', address: 'Corniche Rd' },
  distanceKm: 2.4,
  address: ADDRESS,
  deliveryPhone: '501234821',
  window: { start: '2026-11-16T14:00:00.000Z', end: '2026-11-16T16:00:00.000Z' },
  canCancel: true,
  canResendCode: false,
  createdAt: '2026-11-16T09:21:00.000Z',
  cancelledAt: null,
};

function shop(onOrder: (c: FetchCall) => { status?: number; body?: unknown } | undefined) {
  return (c: FetchCall) => {
    if (c.path === '/cart' && c.method === 'GET') return { body: CART };
    if (c.path === '/addresses') return { body: [ADDRESS] };
    if (c.path === '/orders' && c.method === 'POST') return onOrder(c);
    if (c.path === '/orders/o1') return { body: ORDER };
    return undefined;
  };
}

async function fillCard() {
  await fireEvent.changeText(screen.getByLabelText('Card number'), '4242424242424242');
  await fireEvent.changeText(screen.getByLabelText('Expiry'), '12/29');
  await fireEvent.changeText(screen.getByLabelText('CVV'), '123');
}

beforeEach(() => {
  resetRouterMock();
  session.clearAll();
  session.write('checkout', {
    addressId: 'a1',
    deliveryPhone: '501234821',
    paymentMethod: 'card',
    idempotencyKey: null,
    lastOrderId: null,
  });
});

describe('14 · Payment', () => {
  test('two quick taps on Pay place one order (review focus 2)', async () => {
    let resolve: (v: { status: number; body: unknown }) => void = () => {};
    const { calls } = await renderScreen(<PaymentScreen />, {
      server: shop(() => undefined),
    });
    // Hold the order request open so the second tap lands while the first is in flight.
    const real = global.fetch;
    global.fetch = jest.fn(async (url: string, init: RequestInit = {}) => {
      if (String(url).endsWith('/orders') && init.method === 'POST') {
        calls.push({ path: '/orders', method: 'POST', auth: null, body: JSON.parse(String(init.body)) });
        const r = await new Promise<{ status: number; body: unknown }>((res) => (resolve = res));
        return { ok: true, status: r.status, json: async () => r.body } as Response;
      }
      return real(url, init);
    }) as unknown as typeof fetch;

    await screen.findByText('Payment method');
    await fillCard();
    const pay = screen.getByRole('button', { name: 'Pay SAR 200.00' });
    await act(async () => {
      fireEvent.press(pay);
      fireEvent.press(pay);
    });
    await waitFor(() => expect(calls.filter((c) => c.path === '/orders' && c.method === 'POST')).toHaveLength(1));
    await act(async () => resolve({ status: 201, body: ORDER }));
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith('/checkout/success/o1'));
    expect(calls.filter((c) => c.path === '/orders' && c.method === 'POST')).toHaveLength(1);
  });

  test('a retry after a network failure sends the same idempotency key', async () => {
    let attempt = 0;
    const { calls } = await renderScreen(<PaymentScreen />, {
      server: shop(() => {
        attempt += 1;
        return attempt === 1
          ? { status: 503, body: { code: 'rof_unavailable', message: "We can't reach the store right now. Please try again in a moment." } }
          : { status: 201, body: ORDER };
      }),
    });
    await screen.findByText('Payment method');
    await fillCard();
    await fireEvent.press(screen.getByRole('button', { name: 'Pay SAR 200.00' }));
    expect(await screen.findAllByText("We can't reach the store right now. Please try again in a moment.")).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Pay SAR 200.00' }));
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith('/checkout/success/o1'));
    const keys = calls
      .filter((c) => c.path === '/orders' && c.method === 'POST')
      .map((c) => (c.body as { idempotencyKey: string }).idempotencyKey);
    expect(keys).toHaveLength(2);
    expect(keys[0]).toBe(keys[1]);
  });

  test('a declined card shows the server message', async () => {
    await renderScreen(<PaymentScreen />, {
      server: shop(() => ({
        status: 402,
        body: { code: 'card_declined', field: 'card.number', message: 'Your card was declined. Try another card.' },
      })),
    });
    await screen.findByText('Payment method');
    await fillCard();
    await fireEvent.press(screen.getByRole('button', { name: 'Pay SAR 200.00' }));
    expect((await screen.findAllByText('Your card was declined. Try another card.')).length).toBeGreaterThan(0);
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });

  test('cash on delivery places the order without card details', async () => {
    const { calls } = await renderScreen(<PaymentScreen />, { server: shop(() => ({ status: 201, body: ORDER })) });
    await screen.findByText('Payment method');
    await fireEvent.press(screen.getByRole('radio', { name: /Cash on delivery/ }));
    await fireEvent.press(screen.getByRole('button', { name: 'Place order · SAR 200.00' }));
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith('/checkout/success/o1'));
    expect(calls.find((c) => c.path === '/orders' && c.method === 'POST')?.body).toMatchObject({ payment: { method: 'cod' } });
  });
});

describe('16 · Order confirmed', () => {
  test('Android back goes Home, never back into Payment (review focus 5)', async () => {
    const handlers: (() => boolean)[] = [];
    const spy = jest.spyOn(BackHandler, 'addEventListener').mockImplementation((_e, fn) => {
      handlers.push(fn as () => boolean);
      return { remove: () => {} };
    });
    setMockParams({ orderId: 'o1' });
    session.write('branch-popup-seen:o1', true);
    await renderScreen(<OrderConfirmedScreen />, { server: shop(() => undefined) });
    expect(await screen.findByText('Order confirmed!')).toBeTruthy();
    expect(handlers.at(-1)?.()).toBe(true);
    expect(mockRouter.dismissTo).toHaveBeenCalledWith('/home');
    spy.mockRestore();
  });

  test('the branch popup shows once with the delivering branch', async () => {
    setMockParams({ orderId: 'o1' });
    await renderScreen(<OrderConfirmedScreen />, { server: shop(() => undefined) });
    expect(await screen.findByText('Your order will be delivered from')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Got it' }));
    expect(session.read('branch-popup-seen:o1')).toBe(true);
  });
});
