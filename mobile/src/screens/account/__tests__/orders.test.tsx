import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { renderScreen } from '@/test/renderScreen';
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
  discount: 0,
  deliveryFee: 15,
  vat: 26.09,
  total: 200,
  promoCode: null,
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

describe('22 · Order tracking', () => {
  test('ROF has not assigned a branch yet: the branch card says so, with no Call or Directions', async () => {
    setMockParams({ orderId: 'o1' });
    await renderScreen(<OrderDetailScreen />, { server: (c) => (c.path.startsWith('/orders/o1') ? { body: { ...ONGOING, branch: null } } : undefined) });
    expect(await screen.findByText('Branch being confirmed')).toBeTruthy();
    expect(screen.getByText(/nearest branch with everything in stock/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Call branch' })).toBeNull();
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
});
