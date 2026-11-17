import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { session } from '@/lib/storage.js';
import { PRODUCTS, renderScreen } from '@/test/renderScreen';
import { mockRouter, resetRouterMock } from '@/test/routerMock';
import FavoritesScreen from '../FavoritesScreen';
import HomeScreen from '../HomeScreen';

jest.mock('expo-router', () => require('@/test/routerMock').expoRouterMock);

const HOME = {
  id: 'a1',
  label: 'Home',
  type: 'home',
  line: 'Building 12, Prince Turki St',
  district: 'Al Rakah',
  city: 'Al Khobar',
  postcode: '34445',
  landmark: '',
  phone: '501234821',
  contactName: 'Sara',
  location: { lat: 26.2874, lng: 50.2085 },
  isDefault: true,
};
const PARENTS = { ...HOME, id: 'a2', label: 'Parents', district: 'Al Faisaliyah', city: 'Dammam', isDefault: false };
const P2 = { ...PRODUCTS[0], id: 'p2', name: 'Burnt Chocolate Cheesecake' };

beforeEach(() => {
  resetRouterMock();
  session.clearAll();
});

describe('Home · Deliver to', () => {
  test('shows the default address; choosing another delivers there and makes it the default', async () => {
    let list = [HOME, PARENTS];
    const { calls } = await renderScreen(<HomeScreen />, {
      server: (c) => {
        if (c.path === '/addresses' && c.method === 'GET') return { body: list };
        if (c.path === '/addresses/a2/default') {
          list = [{ ...PARENTS, isDefault: true }, { ...HOME, isDefault: false }];
          return { body: list };
        }
        return undefined;
      },
    });
    await fireEvent.press(await screen.findByRole('button', { name: 'Deliver to Home · Al Rakah, Al Khobar' }));
    await fireEvent.press(await screen.findByRole('radio', { name: /^Parents\./ }));
    expect(await screen.findByRole('button', { name: 'Deliver to Parents · Al Faisaliyah, Dammam' })).toBeTruthy();
    await waitFor(() => expect(calls.some((c) => c.path === '/addresses/a2/default' && c.method === 'POST')).toBe(true));
    expect(session.read('checkout')).toMatchObject({ addressId: 'a2' });
  });

  test('without saved addresses it offers Add address and comes back to Home', async () => {
    await renderScreen(<HomeScreen />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Deliver to Add a delivery address' }));
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/addresses/new', params: { returnTo: '/home' } });
  });
});

describe('Favourites', () => {
  const withFavorites = (ids: string[]) => (c: { path: string; method: string }) =>
    c.path === '/favorites' && c.method === 'GET'
      ? { body: { productIds: ids } }
      : c.path === '/products'
        ? { body: [PRODUCTS[0], P2] }
        : c.path === '/favorites' && c.method === 'PUT'
          ? { body: { productIds: [] } }
          : undefined;

  test('lists hearted sweets newest first, with a count', async () => {
    await renderScreen(<FavoritesScreen />, { server: withFavorites(['p1', 'p2']) });
    expect(await screen.findByText('2 saved')).toBeTruthy();
    const names = screen.getAllByText(/Truffle Box · Classic|Burnt Chocolate Cheesecake/).map((n) => n.props.children);
    expect(names).toEqual(['Burnt Chocolate Cheesecake', 'Truffle Box · Classic']);
  });

  test('un-hearting removes the sweet, saves, and Undo brings it back', async () => {
    const { calls } = await renderScreen(<FavoritesScreen />, { server: withFavorites(['p1']) });
    await fireEvent.press(await screen.findByRole('button', { name: 'Remove Truffle Box · Classic from favourites' }));
    expect(await screen.findByText('No favourites yet')).toBeTruthy();
    await waitFor(() => expect(calls.find((c) => c.path === '/favorites' && c.method === 'PUT')?.body).toEqual({ productIds: [] }));
    await fireEvent.press(screen.getByRole('button', { name: 'Undo' }));
    expect(await screen.findByText('Truffle Box · Classic')).toBeTruthy();
  });

  test('sweets no longer sold are reported and can be removed in one go', async () => {
    const { calls } = await renderScreen(<FavoritesScreen />, { server: withFavorites(['gone', 'p1']) });
    expect(await screen.findByText('1 saved sweet is no longer on the menu.')).toBeTruthy();
    await fireEvent.press(screen.getByText('Remove it'));
    await waitFor(() => expect(calls.find((c) => c.path === '/favorites' && c.method === 'PUT')?.body).toEqual({ productIds: ['p1'] }));
    expect(screen.queryByText('1 saved sweet is no longer on the menu.')).toBeNull();
  });

  test('empty state sends the customer back to the shop', async () => {
    await renderScreen(<FavoritesScreen />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Browse sweets' }));
    expect(mockRouter.navigate).toHaveBeenCalledWith('/home');
  });
});
