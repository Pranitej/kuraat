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
// The in-app browser sheet: resolves when the customer closes it.
const mockOpenBrowser = jest.fn();
jest.mock('expo-web-browser', () => ({ openBrowserAsync: (...args: unknown[]) => mockOpenBrowser(...args) }));

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
  totals: { count: 1, subtotal: 185, total: 185 },
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
  total: 185,
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

const PAGE = 'https://rofuat.rsof.com.sa/en/pay/T1';
let cardOn = true;

function shop(onOrder: (c: FetchCall) => { status?: number; body?: unknown } | undefined) {
  return (c: FetchCall) => {
    if (c.path === '/checkout/payment-options') return { body: { card: cardOn } };
    if (c.path === '/cart' && c.method === 'GET') return { body: CART };
    if (c.path === '/addresses') return { body: [ADDRESS] };
    if (c.path === '/orders' && c.method === 'POST') return onOrder(c);
    if (c.path === '/orders/o1') return { body: ORDER };
    return undefined;
  };
}

// A card is paid on RSOF's secure payment page after the order is placed: no card fields in the app.
const CONTINUE = 'Continue to payment · SAR 185.00';

beforeEach(() => {
  mockOpenBrowser.mockReset();
  mockOpenBrowser.mockResolvedValue({ type: 'dismiss' });
  cardOn = true;
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
    const pay = await screen.findByRole('button', { name: CONTINUE });
    await waitFor(() => expect(pay).toBeEnabled());
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
    await waitFor(() => expect(screen.getByRole('button', { name: CONTINUE })).toBeEnabled());
    await fireEvent.press(screen.getByRole('button', { name: CONTINUE }));
    expect(await screen.findAllByText("We can't reach the store right now. Please try again in a moment.")).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: CONTINUE }));
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith('/checkout/success/o1'));
    const keys = calls
      .filter((c) => c.path === '/orders' && c.method === 'POST')
      .map((c) => (c.body as { idempotencyKey: string }).idempotencyKey);
    expect(keys).toHaveLength(2);
    expect(keys[0]).toBe(keys[1]);
  });

  test('card sends only the method: the card is entered on the secure payment page', async () => {
    const { calls } = await renderScreen(<PaymentScreen />, { server: shop(() => ({ status: 201, body: ORDER })) });
    await screen.findByText('Payment method');
    expect(screen.queryByLabelText('Card number')).toBeNull();
    await waitFor(() => expect(screen.getByRole('button', { name: CONTINUE })).toBeEnabled());
    await fireEvent.press(screen.getByRole('button', { name: CONTINUE }));
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith('/checkout/success/o1'));
    expect(calls.find((c) => c.path === '/orders' && c.method === 'POST')?.body).toMatchObject({ payment: { method: 'card' } });
  });

  test('card payment not working: card is greyed out and cash on delivery is chosen', async () => {
    cardOn = false;
    await renderScreen(<PaymentScreen />, { server: shop(() => ({ status: 201, body: ORDER })) });
    await screen.findByText('Payment method');
    const card = await screen.findByRole('radio', { name: 'Credit / debit card, Card payment is not available right now' });
    expect(card.props.accessibilityState).toMatchObject({ disabled: true });
    await waitFor(() => expect(screen.getByRole('radio', { name: /Cash on delivery/ }).props.accessibilityState).toMatchObject({ checked: true }));
  });

  test('card stops working while paying: the message shows and cash on delivery is offered instead', async () => {
    await renderScreen(<PaymentScreen />, {
      server: shop(() => ({ status: 503, body: { code: 'payment_unavailable', message: "Card payment isn't available right now. Choose cash on delivery or pay at the branch." } })),
    });
    await screen.findByText('Payment method');
    await waitFor(() => expect(screen.getByRole('button', { name: CONTINUE })).toBeEnabled());
    await fireEvent.press(screen.getByRole('button', { name: CONTINUE }));
    expect((await screen.findAllByText("Card payment isn't available right now. Choose cash on delivery or pay at the branch.")).length).toBeGreaterThan(0);
    expect(screen.getByRole('radio', { name: /Cash on delivery/ }).props.accessibilityState).toMatchObject({ checked: true });
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });

  test('cash on delivery places the order without card details', async () => {
    const { calls } = await renderScreen(<PaymentScreen />, { server: shop(() => ({ status: 201, body: ORDER })) });
    await screen.findByText('Payment method');
    await fireEvent.press(screen.getByRole('radio', { name: /Cash on delivery/ }));
    await fireEvent.press(screen.getByRole('button', { name: 'Place order · SAR 185.00' }));
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith('/checkout/success/o1'));
    expect(calls.find((c) => c.path === '/orders' && c.method === 'POST')?.body).toMatchObject({ payment: { method: 'cod' } });
  });

  test('Saudi Arabia: only card and cash on delivery; an old draft that chose UPI starts on card', async () => {
    session.write('checkout', { addressId: 'a1', paymentMethod: 'upi', idempotencyKey: null, lastOrderId: null });
    await renderScreen(<PaymentScreen />, { server: shop(() => ({ status: 201, body: ORDER })) });
    await screen.findByText('Payment method');
    expect(screen.getAllByRole('radio').map((r) => r.props.accessibilityLabel)).toEqual([
      'Credit / debit card, Mada, Visa, Mastercard · on a secure payment page',
      'Cash on delivery, Pay when your order arrives',
    ]);
    expect(screen.queryByText(/UPI/)).toBeNull();
    expect(screen.getByRole('radio', { name: /Credit \/ debit card/ }).props.accessibilityState).toMatchObject({ checked: true });
  });
});

describe('14 · Payment — branch pickup (design 2026-11-18 §5.3)', () => {
  const PICKUP_TOTALS = { count: 1, subtotal: 185, total: 185 };
  const PICKUP_ORDER = { ...ORDER, fulfilment: 'pickup', address: null, window: { start: null, end: null }, total: 185, payment: { method: 'branch', brand: null, last4: null, transactionId: null, paidAt: null } };
  const pickupShop = (onOrder: (c: FetchCall) => { status?: number; body?: unknown } | undefined) => (c: FetchCall) => {
    if (c.path === '/checkout/quote') return { body: { fulfilment: 'pickup', branch: { id: 'b1', name: 'Kuraat · Al Khobar Corniche' }, distanceKm: 2.4, isNearest: true, inStock: null, totals: PICKUP_TOTALS } };
    return shop(onOrder)(c);
  };
  beforeEach(() => {
    session.write('checkout', { fulfilment: 'pickup', addressId: null, paymentMethod: 'card', idempotencyKey: null, lastOrderId: null });
  });

  test('pickup offers Pay now and Pay at branch — never cash on delivery', async () => {
    await renderScreen(<PaymentScreen />, { server: pickupShop(() => ({ status: 201, body: PICKUP_ORDER })) });
    await screen.findByText('Payment method');
    expect(screen.getAllByRole('radio').map((r) => r.props.accessibilityLabel)).toEqual([
      'Pay now, Card · Mada, Visa, Mastercard on a secure payment page',
      'Pay at branch, Pay when you collect your order',
    ]);
    expect(screen.queryByRole('radio', { name: /Cash on delivery/ })).toBeNull();
  });

  test('Pay at branch places a pickup order without an address, priced from the RSOF product prices', async () => {
    const { calls } = await renderScreen(<PaymentScreen />, { server: pickupShop(() => ({ status: 201, body: PICKUP_ORDER })) });
    await screen.findByText('Payment method');
    await fireEvent.press(screen.getByRole('radio', { name: /Pay at branch/ }));
    expect(screen.getByText('Please pay SAR 185.00 at the pickup counter when you collect your order.')).toBeTruthy();
    await fireEvent.press(await screen.findByRole('button', { name: 'Place order · SAR 185.00' }));
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith('/checkout/success/o1'));
    const body = calls.find((c) => c.path === '/orders' && c.method === 'POST')?.body as Record<string, unknown>;
    expect(body).toMatchObject({ fulfilment: 'pickup', payment: { method: 'branch' } });
    expect(body).not.toHaveProperty('addressId');
    expect(body).not.toHaveProperty('deliveryPhone'); // the order carries the account number, set by the kuraat server
  });

  test('delivery still posts its address and says delivery', async () => {
    session.write('checkout', { fulfilment: 'delivery', addressId: 'a1', paymentMethod: 'cod', idempotencyKey: null, lastOrderId: null });
    const { calls } = await renderScreen(<PaymentScreen />, { server: pickupShop(() => ({ status: 201, body: ORDER })) });
    await screen.findByText('Payment method');
    await fireEvent.press(await screen.findByRole('button', { name: 'Place order · SAR 185.00' }));
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
    expect(await screen.findByRole('button', { name: CONTINUE })).toBeEnabled();
  });

  test('while the pickup total is on its way the screen says so', async () => {
    await renderScreen(<PaymentScreen />, {
      server: (c) => (c.path === '/checkout/quote' ? new Promise(() => {}) as never : shop(() => ({ status: 201, body: PICKUP_ORDER }))(c)),
    });
    expect(await screen.findByText('Getting your total…')).toBeTruthy();
  });

  test('a delivery draft that remembered "pay at branch" starts on card', async () => {
    session.write('checkout', { fulfilment: 'delivery', addressId: 'a1', paymentMethod: 'branch', idempotencyKey: null, lastOrderId: null });
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

describe('15 · Complete your payment (card paid on the secure payment page)', () => {
  const WAITING = { ...ORDER, payment: { method: 'card', status: 'pending', brand: null, last4: null, transactionId: null, paidAt: null } };
  const PAID = { ...ORDER, payment: { method: 'card', status: 'paid', brand: null, last4: null, transactionId: null, paidAt: '2026-11-16T09:25:00.000Z' } };

  test('a card order not paid yet: Pay opens the payment page in the in-app sheet; closing it unpaid says "Payment not completed"', async () => {
    setMockParams({ orderId: 'o1' });
    const { calls } = await renderScreen(<PaymentSuccessScreen />, {
      server: (c) =>
        c.path === '/orders/o1'
          ? { body: WAITING }
          : c.path === '/orders/o1/pay'
            ? { body: { status: 'pending', link: PAGE, expiresAt: '2099-01-01T00:00:00.000Z', amount: 185, currency: 'SAR' } }
            : shop(() => undefined)(c),
    });
    expect(await screen.findAllByText('Complete your payment')).toBeTruthy();
    expect(screen.getByText('Your order is placed. Pay SAR 185.00 on the secure payment page to confirm it.')).toBeTruthy();
    const pay = await screen.findByRole('button', { name: 'Pay SAR 185.00' });
    await waitFor(() => expect(pay).toBeEnabled());
    await fireEvent.press(pay);
    await waitFor(() => expect(mockOpenBrowser).toHaveBeenCalledWith(PAGE, expect.any(Object)));
    // The sheet was closed without paying: RSOF is asked again and the screen says so, with Try again / View my orders.
    expect(await screen.findByText(/Payment not completed/)).toBeTruthy();
    expect(calls.filter((c) => c.path === '/orders/o1/pay').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByRole('button', { name: 'View my orders' })).toBeTruthy();
  });

  test('without the in-app browser module (an older dev build) the phone browser is used instead', async () => {
    setMockParams({ orderId: 'o1' });
    mockOpenBrowser.mockRejectedValue(new Error('Cannot find native module'));
    await renderScreen(<PaymentSuccessScreen />, {
      server: (c) =>
        c.path === '/orders/o1'
          ? { body: WAITING }
          : c.path === '/orders/o1/pay'
            ? { body: { status: 'pending', link: PAGE, expiresAt: '2099-01-01T00:00:00.000Z', amount: 185, currency: 'SAR' } }
            : shop(() => undefined)(c),
    });
    const pay = await screen.findByRole('button', { name: 'Pay SAR 185.00' });
    await waitFor(() => expect(pay).toBeEnabled());
    await fireEvent.press(pay);
    // The sheet itself failed: the message offers another try instead of a blank screen.
    expect(await screen.findAllByText("We couldn't open the payment page. Please try again.")).toBeTruthy();
  });

  test('"View my orders" goes to the Orders page and re-reads the orders', async () => {
    setMockParams({ orderId: 'o1' });
    const { calls } = await renderScreen(<PaymentSuccessScreen />, {
      server: (c) =>
        c.path === '/orders/o1'
          ? { body: WAITING }
          : c.path === '/orders/o1/pay'
            ? { body: { status: 'pending', link: PAGE, expiresAt: '2099-01-01T00:00:00.000Z', amount: 185, currency: 'SAR' } }
            : shop(() => undefined)(c),
    });
    await fireEvent.press(await screen.findByRole('button', { name: 'View my orders' }));
    expect(mockRouter.replace).toHaveBeenCalledWith('/orders');
    await waitFor(() => expect(calls.some((c) => c.path.startsWith('/orders?refresh=true'))).toBe(true));
  });

  test('once the kuraat server says paid, the screen becomes "Payment successful"', async () => {
    setMockParams({ orderId: 'o1' });
    let paid = false;
    await renderScreen(<PaymentSuccessScreen />, {
      server: (c) => {
        if (c.path === '/orders/o1') return { body: paid ? PAID : WAITING };
        if (c.path === '/orders/o1/pay') {
          paid = true;
          return { body: { status: 'paid' } };
        }
        return shop(() => undefined)(c);
      },
    });
    expect(await screen.findByText('Payment successful')).toBeTruthy();
    expect(screen.getByText('SAR 185.00 paid by card')).toBeTruthy();
    expect(screen.getByText('Card · Paid')).toBeTruthy();
    // A paid card order ends on the Orders page, where it can be tracked.
    expect(screen.getByRole('button', { name: 'View my orders' })).toBeTruthy();
  });

  test('the payment page cannot be made yet: the message shows with Try again', async () => {
    setMockParams({ orderId: 'o1' });
    await renderScreen(<PaymentSuccessScreen />, {
      server: (c) =>
        c.path === '/orders/o1'
          ? { body: WAITING }
          : c.path === '/orders/o1/pay'
            ? { status: 503, body: { code: 'payment_not_ready', message: "Online payment isn't ready for this order yet. Please try again in a few minutes." } }
            : shop(() => undefined)(c),
    });
    expect(await screen.findByText("Online payment isn't ready for this order yet. Please try again in a few minutes.")).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeEnabled();
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
    const pickup = { ...ORDER, fulfilment: 'pickup', address: null, window: { start: null, end: null } };
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
