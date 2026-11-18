import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import * as Location from 'expo-location';
import { session } from '@/lib/storage.js';
import { PRODUCTS, renderScreen } from '@/test/renderScreen';
import { mockRouter, resetRouterMock } from '@/test/routerMock';
import HomeScreen from '../HomeScreen';

jest.mock('expo-router', () => require('@/test/routerMock').expoRouterMock);

beforeEach(() => {
  resetRouterMock();
  session.clearAll();
  jest.clearAllMocks();
});

describe('07 · Home', () => {
  test('no category pills (and no Category in the filter sheet) when a product has no category', async () => {
    const products = [PRODUCTS[0], { ...PRODUCTS[0], id: 'p-no-cat', name: 'Praline Box', categoryName: null }];
    await renderScreen(<HomeScreen />, { server: (c) => (c.path === '/products' ? { body: products } : undefined) });
    expect(await screen.findByText('Praline Box')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'All' })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Sort and filter' }));
    expect(screen.queryByText('Category')).toBeNull();
  });

  test('category pills when every product has one', async () => {
    await renderScreen(<HomeScreen />);
    expect(await screen.findByRole('button', { name: 'All' })).toBeTruthy();
  });

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

describe('07/08 · Home footer', () => {
  test('nothing below the maroon Contact us footer (no extra bottom padding)', async () => {
    const { StyleSheet } = require('react-native');
    await renderScreen(<HomeScreen />);
    await screen.findByText('Contact us');
    const scroll = screen.getByTestId('screen-scroll');
    expect(StyleSheet.flatten(scroll.props.contentContainerStyle).paddingBottom).toBe(0);
  });
});

describe('07 · Home — no location prompt at login', () => {
  test('Home does not ask for the device location or send one: it is asked when adding an address or signing up', async () => {
    const { calls } = await renderScreen(<HomeScreen />);
    expect(await screen.findByText('Truffle Box · Classic')).toBeTruthy();
    expect(Location.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
    expect(Location.getCurrentPositionAsync).not.toHaveBeenCalled();
    expect(calls.filter((c) => c.path === '/me/location')).toHaveLength(0);
  });
});
