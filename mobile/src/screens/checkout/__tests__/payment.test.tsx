import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { BackHandler } from 'react-native';
import { session } from '@/lib/storage.js';
import type { FetchCall } from '@/test/jestFetch';
import { renderScreen } from '@/test/renderScreen';
import { mockRouter, resetRouterMock, setMockParams } from '@/test/routerMock';
import OrderConfirmedScreen from '../OrderConfirmedScreen';
import PaymentScreen from '../PaymentScreen';
import PaymentSuccessScreen from '../PaymentSuccessScreen';

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
  payment: { method: 'card', brand: 'Visa', last4: '4242', transactionId: 'TX-1', paidAt: '2026-11-16T09:21:00.000Z' },
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

  test('Saudi Arabia: only card and cash on delivery; an old draft that chose UPI starts on card', async () => {
    session.write('checkout', { addressId: 'a1', deliveryPhone: '501234821', paymentMethod: 'upi', idempotencyKey: null, lastOrderId: null });
    await renderScreen(<PaymentScreen />, { server: shop(() => ({ status: 201, body: ORDER })) });
    await screen.findByText('Payment method');
    expect(screen.getAllByRole('radio').map((r) => r.props.accessibilityLabel)).toEqual([
      'Credit / debit card, Visa, Mastercard, Mada',
      'Cash on delivery, Pay when your order arrives',
    ]);
    expect(screen.queryByText(/UPI/)).toBeNull();
    expect(screen.getByRole('radio', { name: /Credit \/ debit card/ }).props.accessibilityState).toMatchObject({ checked: true });
    expect(screen.getByLabelText('Card number')).toBeTruthy();
  });
});

describe('14 · Payment — branch pickup (design 2026-11-18 §5.3)', () => {
  const PICKUP_TOTALS = { count: 1, subtotal: 185, discount: 0, delivery: 0, total: 185, vat: 24.13 };
  const PICKUP_ORDER = { ...ORDER, fulfilment: 'pickup', address: null, window: { start: null, end: null }, deliveryFee: 0, total: 185, payment: { method: 'branch', brand: null, last4: null, transactionId: null, paidAt: null } };
  const pickupShop = (onOrder: (c: FetchCall) => { status?: number; body?: unknown } | undefined) => (c: FetchCall) => {
    if (c.path === '/checkout/quote') return { body: { fulfilment: 'pickup', branch: { id: 'b1', name: 'Kuraat · Al Khobar Corniche' }, distanceKm: 2.4, isNearest: true, inStock: null, totals: PICKUP_TOTALS } };
    return shop(onOrder)(c);
  };
  beforeEach(() => {
    session.write('checkout', { fulfilment: 'pickup', addressId: null, deliveryPhone: '501234821', paymentMethod: 'card', idempotencyKey: null, lastOrderId: null });
  });

  test('pickup offers Pay now and Pay at branch — never cash on delivery', async () => {
    await renderScreen(<PaymentScreen />, { server: pickupShop(() => ({ status: 201, body: PICKUP_ORDER })) });
    await screen.findByText('Payment method');
    expect(screen.getAllByRole('radio').map((r) => r.props.accessibilityLabel)).toEqual([
      'Pay now, Credit / debit card · Visa, Mastercard, Mada',
      'Pay at branch, Pay when you collect your order',
    ]);
    expect(screen.queryByRole('radio', { name: /Cash on delivery/ })).toBeNull();
  });

  test('Pay at branch places a pickup order without an address, priced without the delivery fee', async () => {
    const { calls } = await renderScreen(<PaymentScreen />, { server: pickupShop(() => ({ status: 201, body: PICKUP_ORDER })) });
    await screen.findByText('Payment method');
    await fireEvent.press(screen.getByRole('radio', { name: /Pay at branch/ }));
    expect(screen.getByText('Please pay SAR 185.00 at the pickup counter when you collect your order.')).toBeTruthy();
    await fireEvent.press(await screen.findByRole('button', { name: 'Place order · SAR 185.00' }));
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith('/checkout/success/o1'));
    const body = calls.find((c) => c.path === '/orders' && c.method === 'POST')?.body as Record<string, unknown>;
    expect(body).toMatchObject({ fulfilment: 'pickup', payment: { method: 'branch' }, deliveryPhone: '501234821' });
    expect(body).not.toHaveProperty('addressId');
  });

  test('delivery still posts its address and says delivery', async () => {
    session.write('checkout', { fulfilment: 'delivery', addressId: 'a1', deliveryPhone: '501234821', paymentMethod: 'cod', idempotencyKey: null, lastOrderId: null });
    const { calls } = await renderScreen(<PaymentScreen />, { server: pickupShop(() => ({ status: 201, body: ORDER })) });
    await screen.findByText('Payment method');
    await fireEvent.press(await screen.findByRole('button', { name: 'Place order · SAR 200.00' }));
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalled());
    expect(calls.find((c) => c.path === '/orders' && c.method === 'POST')?.body).toMatchObject({ fulfilment: 'delivery', addressId: 'a1', payment: { method: 'cod' } });
  });

  test('the pickup quote failing says so, explains the disabled button and recovers on Try again (review: Important 2)', async () => {
    let up = false;
    await renderScreen(<PaymentScreen />, {
      server: (c) =>
        c.path === '/checkout/quote'
          ? up
            ? { body: { fulfilment: 'pickup', branch: null, distanceKm: null, isNearest: null, inStock: null, totals: PICKUP_TOTALS } }
            : { status: 503, body: { code: 'rof_unavailable', message: "We can't reach the store right now." } }
          : shop(() => ({ status: 201, body: PICKUP_ORDER }))(c),
    });
    expect(await screen.findByText("We can't reach the store right now.")).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Pay' })).toBeDisabled();
    up = true;
    await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('button', { name: 'Pay SAR 185.00' })).toBeEnabled();
  });

  test('while the pickup total is on its way the screen says so', async () => {
    await renderScreen(<PaymentScreen />, {
      server: (c) => (c.path === '/checkout/quote' ? new Promise(() => {}) as never : shop(() => ({ status: 201, body: PICKUP_ORDER }))(c)),
    });
    expect(await screen.findByText('Getting your total…')).toBeTruthy();
  });

  test('a delivery draft that remembered "pay at branch" starts on card', async () => {
    session.write('checkout', { fulfilment: 'delivery', addressId: 'a1', deliveryPhone: '501234821', paymentMethod: 'branch', idempotencyKey: null, lastOrderId: null });
    await renderScreen(<PaymentScreen />, { server: pickupShop(() => ({ status: 201, body: ORDER })) });
    await screen.findByText('Payment method');
    expect(screen.getByRole('radio', { name: /Credit \/ debit card/ }).props.accessibilityState).toMatchObject({ checked: true });
  });
});

describe('15 · Payment successful — pay at branch', () => {
  test('says the order is placed and what to pay at the branch', async () => {
    setMockParams({ orderId: 'o1' });
    const order = { ...ORDER, fulfilment: 'pickup', address: null, total: 185, payment: { method: 'branch', brand: null, last4: null, transactionId: null, paidAt: null } };
    await renderScreen(<PaymentSuccessScreen />, { server: (c) => (c.path === '/orders/o1' ? { body: order } : shop(() => undefined)(c)) });
    expect(await screen.findByText('Order placed')).toBeTruthy();
    expect(screen.getByText('Pay SAR 185.00 at the branch when you collect your order')).toBeTruthy();
    expect(screen.getByText('Pay at branch')).toBeTruthy();
    expect(screen.getByText('Amount due')).toBeTruthy();
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

  test('ROF has not assigned a branch yet: the popup says so and offers Track order (design 2026-11-18 §5.2)', async () => {
    setMockParams({ orderId: 'o1' });
    const pending = { ...ORDER, branch: null, distanceKm: null };
    await renderScreen(<OrderConfirmedScreen />, { server: (c) => (c.path === '/orders/o1' ? { body: pending } : shop(() => undefined)(c)) });
    expect(await screen.findByText('The nearest branch with your items')).toBeTruthy();
    expect(screen.getByText('Chosen for your delivery address. Stock is confirmed by the branch.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'View branch details' })).toBeNull();
    // The screen under the popup has its own Track order button; the popup's is the last one.
    await fireEvent.press(screen.getAllByRole('button', { name: 'Track order' }).at(-1)!);
    expect(mockRouter.push).toHaveBeenCalledWith('/orders/o1');
  });

  test('a branch without a known distance: the note leaves the distance out', async () => {
    setMockParams({ orderId: 'o1' });
    await renderScreen(<OrderConfirmedScreen />, { server: (c) => (c.path === '/orders/o1' ? { body: { ...ORDER, distanceKm: null } } : shop(() => undefined)(c)) });
    expect(await screen.findByText('Chosen for your delivery address. Stock confirmed at this branch.')).toBeTruthy();
  });

  test('a pickup order: "Pickup · Show #… at the pickup counter", "Collect from" and a popup that leads with "Pick up your order from"', async () => {
    setMockParams({ orderId: 'o1' });
    const pickup = { ...ORDER, fulfilment: 'pickup', address: null, window: { start: null, end: null }, deliveryFee: 0 };
    await renderScreen(<OrderConfirmedScreen />, { server: (c) => (c.path === '/orders/o1' ? { body: pickup } : shop(() => undefined)(c)) });
    expect(await screen.findByText('Pick up your order from')).toBeTruthy();
    expect(screen.getByText('Chosen near you. Stock is confirmed by the branch.')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Got it' }));
    expect(screen.getByText('Show #KR-20418 at the pickup counter')).toBeTruthy();
    expect(screen.getByText('Collect from')).toBeTruthy();
    expect(screen.getByText('Al Khobar Corniche')).toBeTruthy();
    expect(screen.queryByText('Estimated delivery')).toBeNull();
    expect(screen.queryByText('Delivering to')).toBeNull();
  });

  test('a pickup order without a branch yet: "Collect from · Branch being confirmed"', async () => {
    setMockParams({ orderId: 'o1' });
    session.write('branch-popup-seen:o1', true);
    const pickup = { ...ORDER, fulfilment: 'pickup', address: null, window: { start: null, end: null }, branch: null, distanceKm: null };
    await renderScreen(<OrderConfirmedScreen />, { server: (c) => (c.path === '/orders/o1' ? { body: pickup } : shop(() => undefined)(c)) });
    expect(await screen.findByText('Collect from')).toBeTruthy();
    expect(screen.getByText('Branch being confirmed')).toBeTruthy();
  });
});
