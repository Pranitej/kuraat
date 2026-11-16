import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { renderScreen } from '@/test/renderScreen';
import { mockRouter, resetRouterMock } from '@/test/routerMock';
import HomeScreen from '../HomeScreen';
import NotificationsScreen from '../NotificationsScreen';

jest.mock('expo-router', () => require('@/test/routerMock').expoRouterMock);

beforeEach(() => resetRouterMock());

describe('07 · Home', () => {
  test('shows the catalogue; search narrows it and an unknown name shows the empty state', async () => {
    await renderScreen(<HomeScreen />);
    expect(await screen.findByText('Truffle Box · Classic')).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Search products'), 'zzz');
    expect(await screen.findByText('No sweets found')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Show all sweets' }));
    expect(await screen.findByText('Truffle Box · Classic')).toBeTruthy();
  });

  test('"+" adds one to the cart with a toast, and the cart is saved', async () => {
    const { calls } = await renderScreen(<HomeScreen />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Add Truffle Box · Classic to cart' }));
    expect(screen.getByText('Truffle Box · Classic added to your cart')).toBeTruthy();
    await waitFor(() =>
      expect(calls.find((c) => c.path === '/cart' && c.method === 'PUT')?.body).toEqual({
        items: [{ productId: 'p1', qty: 1 }],
        promoCode: null,
      }),
    );
    expect(screen.getByLabelText('Cart, 1 items')).toBeTruthy();
  });

  test('a product card opens its detail', async () => {
    await renderScreen(<HomeScreen />);
    await fireEvent.press(await screen.findByLabelText('Truffle Box · Classic, SAR 185'));
    expect(mockRouter.push).toHaveBeenCalledWith('/products/p1');
  });
});

describe('26 · Notifications', () => {
  const notification = {
    id: 'n1',
    type: 'order',
    title: 'Order confirmed',
    body: 'Order #KR-20418 is confirmed.',
    link: { kind: 'order', id: 'o1' },
    read: false,
    createdAt: new Date().toISOString(),
  };

  test('tapping a notification marks it read and opens its screen', async () => {
    const { calls } = await renderScreen(<NotificationsScreen />, {
      server: (c) => {
        if (c.path === '/notifications') return { body: [notification] };
        if (c.path === '/notifications/n1/read') return { status: 204 };
        return undefined;
      },
    });
    await fireEvent.press(await screen.findByText('Order confirmed'));
    expect(mockRouter.push).toHaveBeenCalledWith('/orders/o1');
    await waitFor(() => expect(calls.some((c) => c.path === '/notifications/n1/read' && c.method === 'POST')).toBe(true));
  });

  test('nothing yet: the caught-up empty state', async () => {
    await renderScreen(<NotificationsScreen />);
    expect(await screen.findByText('You are all caught up')).toBeTruthy();
  });
});

describe('07/08 · Home footer', () => {
  test('nothing below the maroon Contact us footer (no extra bottom padding)', async () => {
    const { StyleSheet } = require('react-native');
    await renderScreen(<HomeScreen />);
    await screen.findByText('Contact us');
    const scroll = screen.getByTestId('screen-scroll');
    expect(StyleSheet.flatten(scroll.props.contentContainerStyle).paddingBottom).toBe(0);
  });
});
