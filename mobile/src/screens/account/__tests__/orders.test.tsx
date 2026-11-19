import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { renderScreen } from '@/test/renderScreen';
import { clearProductImages } from '@/services/productImage.js';
import { resetRouterMock, setMockParams } from '@/test/routerMock';
import OrderDetailScreen from '../OrderDetailScreen';
import OrdersScreen from '../OrdersScreen';

jest.mock('expo-router', () => require('@/test/routerMock').expoRouterMock);

const base = {
  steps: [
    { id: 'confirmed', title: 'Order confirmed', state: 'done', time: '2026-11-16T09:21:00.000Z', estimated: false },
    { id: 'preparing', title: 'Preparing at the branch', state: 'current', time: '2026-11-16T09:25:00.000Z', estimated: false },
    { id: 'out_for_delivery', title: 'Out for delivery', state: 'todo', time: '2026-11-16T13:30:00.000Z', estimated: true },
    {
      id: 'delivered',
      title: 'Delivered',
      state: 'todo',
      time: '2026-11-16T14:00:00.000Z',
      timeEnd: '2026-11-16T16:00:00.000Z',
      estimated: true,
    },
  ],
  items: [{ productId: 'p1', name: 'Truffle Box · Classic', qty: 1, price: 185, image: null }],
  subtotal: 185,
  total: 185,
  payment: { method: 'card', brand: 'Visa', last4: '4242', transactionId: 'TX-1', paidAt: '2026-11-16T09:21:00.000Z' },
  branch: { id: 'b1', name: 'Al Khobar Corniche', address: 'Corniche Rd', phone: '+966 13 555 0101', location: { lat: 26.29, lng: 50.22 } },
  distanceKm: 2.4,
  address: { line: 'Building 12', district: 'Al Rakah', city: 'Al Khobar', postcode: '34227' },
  deliveryPhone: '501234821',
  window: { start: '2026-11-16T14:00:00.000Z', end: '2026-11-16T16:00:00.000Z' },
  cancelledAt: null,
};
const ONGOING = {
  ...base,
  id: 'o1',
  number: 'KR-20418',
  status: { id: 'preparing', label: 'Preparing', step: 1, cancelled: false },
  canCancel: true,
  canResendCode: false,
  createdAt: '2026-11-16T09:21:00.000Z',
};
const DELIVERED = {
  ...base,
  id: 'o2',
  number: 'KR-20377',
  status: { id: 'delivered', label: 'Delivered', step: 3, cancelled: false },
  canCancel: false,
  canResendCode: false,
  createdAt: '2026-11-10T09:21:00.000Z',
};


// Branch pickup (design 2026-11-18 §5.3): no address, no window, pickup step titles.
const PICKUP_STEPS = [
  { id: 'confirmed', title: 'Order confirmed', state: 'done', time: '2026-11-16T09:21:00.000Z', estimated: false },
  { id: 'preparing', title: 'Preparing at the branch', state: 'current', time: '2026-11-16T09:25:00.000Z', estimated: false },
  { id: 'ready_for_pickup', title: 'Ready for pickup', state: 'todo', time: null, estimated: false },
  { id: 'picked_up', title: 'Picked up', state: 'todo', time: null, estimated: false },
];
const PICKUP = {
  ...ONGOING,
  id: 'o3',
  number: 'KR-20420',
  fulfilment: 'pickup',
  address: null,
  window: { start: null, end: null },
  total: 185,
  payment: { method: 'branch', brand: null, last4: null, transactionId: null, paidAt: null },
  steps: PICKUP_STEPS,
  canCancel: true,
};

beforeEach(() => resetRouterMock());

describe('20/21 · My orders', () => {
  test('the status dropdown filters orders', async () => {
    await renderScreen(<OrdersScreen />, { server: (c) => (c.path === '/orders' ? { body: [ONGOING, DELIVERED] } : undefined) });
    expect(await screen.findByText('#KR-20418')).toBeTruthy();
    expect(screen.getByText('#KR-20377')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Show: All orders' }));
    await fireEvent.press(screen.getByRole('radio', { name: 'Completed' }));
    expect(screen.getByText('#KR-20377')).toBeTruthy();
    expect(screen.queryByText('#KR-20418')).toBeNull();
    expect(screen.getByRole('button', { name: 'Show: Completed' })).toBeTruthy();
  });

  test('a status group with no orders says so and offers all orders', async () => {
    await renderScreen(<OrdersScreen />, { server: (c) => (c.path === '/orders' ? { body: [DELIVERED] } : undefined) });
    await screen.findByText('#KR-20377');
    await fireEvent.press(screen.getByRole('button', { name: 'Show: All orders' }));
    await fireEvent.press(screen.getByRole('radio', { name: 'Cancelled' }));
    expect(screen.getByText('No orders here')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Show all orders' }));
    expect(screen.getByText('#KR-20377')).toBeTruthy();
  });

  test('refresh asks the server for fresh status', async () => {
    const { calls } = await renderScreen(<OrdersScreen />, {
      server: (c) => (c.path.startsWith('/orders') ? { body: [ONGOING, DELIVERED] } : undefined),
    });
    await screen.findByText('#KR-20418');
    await fireEvent.press(screen.getByRole('button', { name: 'Refresh orders' }));
    await waitFor(() => expect(calls.some((c) => c.path === '/orders?refresh=true')).toBe(true));
  });

  test('a failed refresh keeps the list and shows a toast', async () => {
    await renderScreen(<OrdersScreen />, {
      server: (c) => {
        if (c.path === '/orders?refresh=true') return { status: 503, body: { code: 'rof_unavailable', message: "We can't reach the store right now." } };
        if (c.path === '/orders') return { body: [ONGOING] };
        return undefined;
      },
    });
    await screen.findByText('#KR-20418');
    await fireEvent.press(screen.getByRole('button', { name: 'Refresh orders' }));
    expect(await screen.findByText("We can't reach the store right now.")).toBeTruthy();
    expect(screen.getByText('#KR-20418')).toBeTruthy();
  });

  test('a failed first load says so and offers Try again — not "No orders yet"', async () => {
    let up = false;
    await renderScreen(<OrdersScreen />, {
      server: (c) => {
        if (!c.path.startsWith('/orders')) return undefined;
        return up ? { body: [ONGOING] } : { status: 503, body: { code: 'rof_unavailable', message: "We can't reach the store right now." } };
      },
    });
    expect(await screen.findByText("We can't load your orders")).toBeTruthy();
    expect(screen.queryByText('No orders yet')).toBeNull();
    up = true;
    await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('#KR-20418')).toBeTruthy();
  });

  test('an order without a branch yet shows "Branch being confirmed" on its card', async () => {
    await renderScreen(<OrdersScreen />, { server: (c) => (c.path === '/orders' ? { body: [{ ...ONGOING, branch: null }] } : undefined) });
    expect(await screen.findByText('Branch being confirmed')).toBeTruthy();
  });

  test('no orders yet: the empty state', async () => {
    await renderScreen(<OrdersScreen />);
    expect(await screen.findByText('No orders yet')).toBeTruthy();
  });
});

describe('20/21 · My orders — pickup', () => {
  test('a pickup order says "Pick up from" its branch', async () => {
    await renderScreen(<OrdersScreen />, { server: (c) => (c.path === '/orders' ? { body: [PICKUP] } : undefined) });
    expect(await screen.findByText('Pick up from')).toBeTruthy();
    expect(screen.getByText('Al Khobar Corniche')).toBeTruthy();
  });

  test('before RSOF assigns a branch it reads "Pick up from · Branch being confirmed"', async () => {
    await renderScreen(<OrdersScreen />, { server: (c) => (c.path === '/orders' ? { body: [{ ...PICKUP, branch: null }] } : undefined) });
    expect(await screen.findByText('Pick up from')).toBeTruthy();
    expect(screen.getByText('Branch being confirmed')).toBeTruthy();
  });

  test('a delivery order is unchanged', async () => {
    await renderScreen(<OrdersScreen />, { server: (c) => (c.path === '/orders' ? { body: [ONGOING] } : undefined) });
    expect(await screen.findByText('Will be delivered from')).toBeTruthy();
    expect(screen.queryByText('Pick up from')).toBeNull();
  });
});

describe('22 · Order tracking — pickup', () => {
  test('shows the number to show at the counter, the pickup steps and where to collect; no address or delivery fee', async () => {
    setMockParams({ orderId: 'o3' });
    await renderScreen(<OrderDetailScreen />, { server: (c) => (c.path.startsWith('/orders/o3') ? { body: PICKUP } : undefined) });
    expect(await screen.findByText('Show this at the pickup counter')).toBeTruthy();
    expect(screen.getByText('#KR-20420')).toBeTruthy();
    expect(screen.getByText('Staff can find it by the number 20420 or your phone number.')).toBeTruthy();
    expect(screen.getByText('Ready for pickup')).toBeTruthy();
    expect(screen.getByText('Picked up')).toBeTruthy();
    expect(screen.getByText('Pick up from')).toBeTruthy();
    expect(screen.getByText('Collect from')).toBeTruthy();
    expect(screen.getByText('Pay at branch')).toBeTruthy();
    expect(screen.queryByText('Deliver to')).toBeNull();
    expect(screen.queryByText('Delivery')).toBeNull();
    expect(screen.queryByText('Resend code')).toBeNull();
  });

  test('a pickup order with no branch yet says so in the card and the info row', async () => {
    setMockParams({ orderId: 'o3' });
    await renderScreen(<OrderDetailScreen />, { server: (c) => (c.path.startsWith('/orders/o3') ? { body: { ...PICKUP, branch: null } } : undefined) });
    expect((await screen.findAllByText('Branch being confirmed')).length).toBeGreaterThanOrEqual(2);
  });

  test('once picked up the counter card is gone', async () => {
    setMockParams({ orderId: 'o3' });
    const done = {
      ...PICKUP,
      canCancel: false,
      status: { id: 'picked_up', code: 'PickUpByCustomer', label: 'Picked up', group: 'completed', step: 3, cancelled: false },
      steps: PICKUP_STEPS.map((x) => ({ ...x, state: 'done', time: '2026-11-16T10:00:00.000Z' })),
    };
    await renderScreen(<OrderDetailScreen />, { server: (c) => (c.path.startsWith('/orders/o3') ? { body: done } : undefined) });
    expect((await screen.findAllByText('Picked up')).length).toBeGreaterThan(0);
    expect(screen.queryByText('Show this at the pickup counter')).toBeNull();
    expect(screen.getByText('Picked up from')).toBeTruthy();
  });
});

describe('22 · Pay now on the order details (RSOF says the payment is open)', () => {
  const UNPAID = {
    ...ONGOING,
    status: { id: 'confirmed', label: 'Location received', step: 0, cancelled: false },
    steps: base.steps.map((s, i) => (i === 0 ? { ...s, title: 'Order placed', state: 'current' } : { ...s, state: 'todo' })),
    payment: { method: 'card', status: 'online', brand: null, last4: null, transactionId: null, paidAt: null, link: null },
    paymentStatus: { code: 'LinkSent', label: 'Payment pending' },
    canPay: true,
  };

  test('shows "Complete your payment" with Pay; one tap opens the payment page; the first step says Order placed', async () => {
    setMockParams({ orderId: 'o1' });
    const opened: string[] = [];
    jest.doMock('expo-web-browser', () => ({ openBrowserAsync: async (url: string) => opened.push(url) }));
    const { calls } = await renderScreen(<OrderDetailScreen />, {
      server: (c) =>
        c.path === '/orders/o1/pay'
          ? { body: { link: 'https://rofuat.rsof.com.sa/en/pay/T9', expiresAt: null } }
          : c.path === '/orders/o1'
            ? { body: UNPAID }
            : undefined,
    });
    expect(await screen.findAllByText('Complete your payment')).toBeTruthy();
    expect(screen.getByText('Order placed')).toBeTruthy();
    expect(screen.queryByText('Order confirmed')).toBeNull();
    expect(screen.getByText('After paying, your payment status updates on this page. Tap refresh if it does not change.')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Pay SAR 185.00' }));
    await waitFor(() => expect(calls.filter((c) => c.path === '/orders/o1/pay')).toHaveLength(1));
  });

  test('when RSOF says paid (canPay false) there is no Pay button and no payment card', async () => {
    setMockParams({ orderId: 'o1' });
    await renderScreen(<OrderDetailScreen />, {
      server: (c) => (c.path === '/orders/o1' ? { body: { ...UNPAID, canPay: false, paymentStatus: { code: 'Paid', label: 'Paid' } } } : undefined),
    });
    expect(await screen.findByText('Payment status')).toBeTruthy();
    expect(screen.queryByText('Complete your payment')).toBeNull();
    expect(screen.queryByRole('button', { name: /^Pay SAR/ })).toBeNull();
  });
});

describe('22 · Order tracking', () => {
  test('ROF has not assigned a branch yet: the branch card says so, with no Call or Directions', async () => {
    setMockParams({ orderId: 'o1' });
    await renderScreen(<OrderDetailScreen />, { server: (c) => (c.path.startsWith('/orders/o1') ? { body: { ...ONGOING, branch: null } } : undefined) });
    expect(await screen.findByText('Branch being confirmed')).toBeTruthy();
    expect(screen.getByText(/nearest branch with everything in stock/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Call branch' })).toBeNull();
  });

  test('the full history opens inside the tracking card from a button, with no extra request', async () => {
    setMockParams({ orderId: 'o1' });
    const history = [
      { id: 'Created', label: 'Order placed', group: 'placed', cancelled: false, time: '2026-11-16T09:21:00.000Z', note: null },
      { id: 'Canceled', label: 'Cancelled', group: 'cancelled', cancelled: true, time: '2026-11-16T09:23:00.000Z', note: 'Order cancelled' },
      { id: 'Preparing', label: 'Preparing', group: 'preparing', cancelled: false, time: '2026-11-16T09:25:00.000Z', note: null },
    ];
    const { calls } = await renderScreen(<OrderDetailScreen />, {
      server: (c) => (c.path.startsWith('/orders/o1') ? { body: { ...ONGOING, history } } : undefined),
    });
    const open = await screen.findByRole('button', { name: 'View full history' });
    expect(screen.queryByLabelText('Order history')).toBeNull(); // the tracker is the default view
    const before = calls.length;
    await fireEvent.press(open);
    expect(await screen.findByLabelText('Order history')).toBeTruthy();
    expect(screen.getByText('Cancelled')).toBeTruthy();
    expect(screen.getByText('Order cancelled')).toBeTruthy(); // RSOF's note
    expect(calls.length).toBe(before); // nothing was requested: the history came with the order
    await fireEvent.press(screen.getByRole('button', { name: 'Hide full history' }));
    expect(screen.queryByLabelText('Order history')).toBeNull();
  });

  test('an order with a single event has no history button', async () => {
    setMockParams({ orderId: 'o1' });
    await renderScreen(<OrderDetailScreen />, {
      server: (c) => (c.path.startsWith('/orders/o1') ? { body: { ...ONGOING, history: [{ id: 'Created', label: 'Order placed', group: 'placed', cancelled: false, time: '2026-11-16T09:21:00.000Z', note: null }] } } : undefined),
    });
    await screen.findByText('Order confirmed');
    expect(screen.queryByRole('button', { name: 'View full history' })).toBeNull();
  });

  test('the refresh button asks the server for fresh status', async () => {
    setMockParams({ orderId: 'o1' });
    const { calls } = await renderScreen(<OrderDetailScreen />, {
      server: (c) => (c.path.startsWith('/orders/o1') ? { body: ONGOING } : undefined),
    });
    await fireEvent.press(await screen.findByRole('button', { name: 'Refresh status' }));
    await waitFor(() => expect(calls.some((c) => c.path === '/orders/o1?refresh=true')).toBe(true));
  });

  test('cancel after confirming: the status becomes Cancelled', async () => {
    setMockParams({ orderId: 'o1' });
    await renderScreen(<OrderDetailScreen />, {
      server: (c) => {
        if (c.path === '/orders/o1') return { body: ONGOING };
        if (c.path === '/orders/o1/cancel')
          return {
            body: {
              ...ONGOING,
              status: { id: 'cancelled', label: 'Cancelled', step: 1, cancelled: true },
              canCancel: false,
              cancelledAt: '2026-11-16T09:30:00.000Z',
            },
          };
        return undefined;
      },
    });
    await fireEvent.press(await screen.findByRole('button', { name: 'Cancel order' }));
    expect(screen.getByText('Cancel this order?')).toBeTruthy();
    await fireEvent.press(screen.getAllByRole('button', { name: 'Cancel order' }).at(-1)!);
    // The toast and the timeline's last row both say it.
    expect(await screen.findAllByText('Order cancelled')).toHaveLength(2);
    await waitFor(() => expect(screen.getAllByText('Cancelled').length).toBeGreaterThan(0));
  });

  test('delivery code: Resend waits for its countdown after sending', async () => {
    setMockParams({ orderId: 'o1' });
    const OUT = {
      ...ONGOING,
      status: { id: 'out_for_delivery', label: 'Out for delivery', step: 2, cancelled: false },
      canCancel: false,
      canResendCode: true,
    };
    const { calls } = await renderScreen(<OrderDetailScreen />, {
      server: (c) => {
        if (c.path === '/orders/o1') return { body: OUT };
        if (c.path === '/orders/o1/resend-code') return { body: { sent: true, resendAt: new Date(Date.now() + 60_000).toISOString() } };
        return undefined;
      },
    });
    await fireEvent.press(await screen.findByRole('button', { name: 'Resend code' }));
    await waitFor(() => expect(calls.some((c) => c.path === '/orders/o1/resend-code')).toBe(true));
    expect(await screen.findByRole('button', { name: /Resend in 0:/ })).toBeDisabled();
  });

  test('cancelling a pay-at-branch order does not promise a refund (nothing was charged)', async () => {
    setMockParams({ orderId: 'o3' });
    await renderScreen(<OrderDetailScreen />, { server: (c) => (c.path.startsWith('/orders/o3') ? { body: PICKUP } : undefined) });
    await fireEvent.press(await screen.findByRole('button', { name: 'Cancel order' }));
    expect(screen.getByText(/Nothing has been charged\./)).toBeTruthy();
    expect(screen.queryByText(/will refund/)).toBeNull();
  });
});

describe('photos of the ordered products (product-by-id API)', () => {
  beforeEach(() => clearProductImages());
  const orders = (product: (id: string) => object) => (c: { path: string }) => {
    if (c.path === '/orders') return { body: [ONGOING] };
    if (c.path.startsWith('/products/')) return product(c.path.slice('/products/'.length)) as never;
    return undefined;
  };
  // expo-image's host element receives `source` as a one-item list
  const sources = () => screen.queryAllByTestId('order-photo').map((i) => (i.props as { source: { uri: string }[] }).source[0].uri);

  test('the order card shows the current photo of the product, not the one saved with the order', async () => {
    await renderScreen(<OrdersScreen />, { server: orders(() => ({ body: { id: 'p1', images: ['https://example.test/current.jpg'] } })) });
    await screen.findByText('#KR-20418');
    await waitFor(() => expect(sources()).toEqual(['https://example.test/current.jpg']));
  });

  test('a product RSOF no longer has leaves the sand placeholder: no image at all', async () => {
    await renderScreen(<OrdersScreen />, { server: orders(() => ({ status: 404, body: { code: 'not_found', message: 'We could not find that.' } })) });
    await screen.findByText('#KR-20418');
    await waitFor(() => expect(sources()).toEqual([]));
  });

  test('a photo that fails to load falls back to the placeholder too', async () => {
    await renderScreen(<OrdersScreen />, { server: orders(() => ({ body: { id: 'p1', images: ['https://example.test/broken.jpg'] } })) });
    await screen.findByText('#KR-20418');
    await waitFor(() => expect(sources()).toEqual(['https://example.test/broken.jpg']));
    await act(async () => {
      (screen.getAllByTestId('order-photo')[0].props as { onError: (e: object) => void }).onError({ nativeEvent: { error: 'x' } });
    });
    await waitFor(() => expect(sources()).toEqual([]));
  });
});
