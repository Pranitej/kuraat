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

describe('07 · Home — the nearest branch strip needs a location', () => {
  const branch = (id: string, name: string, lat: number, lng: number) => ({
    id, name, displayName: name, address: '', city: 'Al Khobar', phone: '', type: 'hub', isHub: true, location: { lat, lng }, hours: { open: 10, close: 24 }, openNow: true,
  });
  const BRANCHES = [branch('b1', 'Kuraat · Dammam Central', 26.42, 50.1), branch('b2', 'Kuraat · Al Khobar Corniche', 26.29, 50.22)];
  const address = (location: { lat: number; lng: number } | null) => ({
    id: 'a1', label: 'Home', type: 'home', line: 'Building 7', district: 'Al Rakah', city: 'Al Khobar', postcode: '', landmark: '', contactName: 'Sara', location, isDefault: true,
  });
  const serverWith = (location: { lat: number; lng: number } | null) => (c: { path: string }) => {
    if (c.path === '/branches') return { body: BRANCHES };
    if (c.path === '/addresses') return { body: [address(location)] };
    return undefined;
  };

  test('with an address that has a location: the nearest branch and its distance are shown', async () => {
    await renderScreen(<HomeScreen />, { server: serverWith({ lat: 26.2874, lng: 50.2085 }) });
    expect(await screen.findByText(/Nearest branch to/)).toBeTruthy();
    expect(screen.getByText('Kuraat · Al Khobar Corniche')).toBeTruthy(); // the closer of the two, not the first in the list
    // The strip's own label carries the distance (the branch cards below show distances too).
    expect(screen.getByRole('button', { name: /^Nearest branch to .*Al Khobar Corniche, \d+\.\d km$/ })).toBeTruthy();
  });

  test('with an address that has no location (the customer did not share one): no branch is called nearest, no empty distance chip; the card opens the branch list', async () => {
    await renderScreen(<HomeScreen />, { server: serverWith(null) });
    expect(await screen.findByText('Truffle Box · Classic')).toBeTruthy();
    expect(screen.queryByText(/Nearest branch to/)).toBeNull();
    await fireEvent.press(await screen.findByRole('button', { name: 'View all branches' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/branches');
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
