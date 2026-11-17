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
  test('the Ongoing chip shows only orders on their way', async () => {
    await renderScreen(<OrdersScreen />, { server: (c) => (c.path === '/orders' ? { body: [ONGOING, DELIVERED] } : undefined) });
    expect(await screen.findByText('#KR-20418')).toBeTruthy();
    expect(screen.getByText('#KR-20377')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Ongoing' }));
    expect(screen.getByText('#KR-20418')).toBeTruthy();
    expect(screen.queryByText('#KR-20377')).toBeNull();
  });

  test('no orders yet: the empty state', async () => {
    await renderScreen(<OrdersScreen />);
    expect(await screen.findByText('No orders yet')).toBeTruthy();
  });
});

describe('22 · Order tracking', () => {
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
