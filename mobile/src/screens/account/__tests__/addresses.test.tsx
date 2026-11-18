import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import * as Location from 'expo-location';
import { session } from '@/lib/storage.js';
import { renderScreen } from '@/test/renderScreen';
import { mockRouter, resetRouterMock, setMockParams } from '@/test/routerMock';
import AddressesScreen from '../AddressesScreen';
import EditAddressScreen from '../EditAddressScreen';

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
  contactName: 'Sara',
  location: { lat: 26.2874, lng: 50.2085 },
  isDefault: true,
};
const OFFICE = { ...HOME, id: 'a2', label: 'Office', type: 'office', line: 'Tower B, King Saud St', isDefault: false };

beforeEach(() => {
  resetRouterMock();
  session.clearAll();
});

describe('23 · Saved addresses', () => {
  test('deleting the default address says which one becomes the default', async () => {
    await renderScreen(<AddressesScreen />, { server: (c) => (c.path === '/addresses' ? { body: [HOME, OFFICE] } : undefined) });
    await fireEvent.press((await screen.findAllByRole('button', { name: /^Delete/ }))[0]);
    expect(screen.getByText('Delete Home address?')).toBeTruthy();
    expect(screen.getByText('This is your default address. Office will become your default.')).toBeTruthy();
  });

  test('Edit opens that address', async () => {
    await renderScreen(<AddressesScreen />, { server: (c) => (c.path === '/addresses' ? { body: [HOME, OFFICE] } : undefined) });
    await fireEvent.press((await screen.findAllByRole('button', { name: /^Edit/ }))[1]);
    expect(mockRouter.push).toHaveBeenCalledWith('/addresses/a2/edit');
  });
});

describe('24 · Add / edit address', () => {
  beforeEach(() => {
    jest.mocked(Location.requestForegroundPermissionsAsync).mockClear();
    jest.mocked(Location.getCurrentPositionAsync).mockClear();
  });

  test('a new address from Delivery is saved, selected for the checkout, and returns there', async () => {
    setMockParams({ returnTo: '/checkout/delivery' });
    let list = [HOME];
    // The City choices come from the server's delivery branches (no fixed city list).
    const branch = (id: string, name: string, city: string) => ({ id, name, city, phone: '', location: { lat: 26.4, lng: 50.1 }, hours: { open: 10, close: 24 }, openNow: true });
    const { calls } = await renderScreen(<EditAddressScreen />, {
      server: (c) => {
        if (c.path === '/branches') return { body: [branch('b2', 'Jeddah North', 'Jeddah'), branch('b1', 'Dammam Central', 'Dammam')] };
        if (c.path === '/addresses' && c.method === 'GET') return { body: list };
        if (c.path === '/addresses' && c.method === 'POST') {
          const created = { ...OFFICE, id: 'a3', ...(c.body as object) };
          list = [HOME, created];
          return { status: 201, body: created };
        }
        return undefined;
      },
    });
    await fireEvent.press(await screen.findByRole('button', { name: 'Office' }));
    await waitFor(() => expect(calls.some((c) => c.path === '/branches')).toBe(true));
    await fireEvent.changeText(screen.getByLabelText('Address'), 'Tower B, King Saud St');
    await fireEvent.changeText(screen.getByLabelText('District'), 'Al Faisaliyah');
    await fireEvent.press(screen.getByRole('button', { name: 'Save address' }));
    await waitFor(() => expect(mockRouter.back).toHaveBeenCalled());
    const body = calls.find((c) => c.path === '/addresses' && c.method === 'POST')?.body as Record<string, unknown>;
    expect(body).toMatchObject({
      type: 'office',
      line: 'Tower B, King Saud St',
      district: 'Al Faisaliyah',
      city: 'Dammam', // the first city we deliver to (alphabetical)
    });
    expect(body).not.toHaveProperty('phone'); // an address has no mobile number
    expect(body.postcode).toBeUndefined(); // no made-up postcode
    // The device location was asked for once when the form opened, and kept (typing the street does not drop it).
    expect(Location.requestForegroundPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(body.location).toEqual({ lat: 26.2874, lng: 50.2085 });
    expect(session.read('checkout')).toMatchObject({ addressId: 'a3' });
  });

  test('the location is optional: when the customer refuses, the address is still saved, without coordinates', async () => {
    jest.mocked(Location.requestForegroundPermissionsAsync).mockResolvedValueOnce({ status: 'denied', granted: false, canAskAgain: false } as never);
    setMockParams({ returnTo: '/addresses' });
    const branch = { id: 'b1', name: 'Dammam Central', city: 'Dammam', phone: '', location: { lat: 26.4, lng: 50.1 }, hours: { open: 10, close: 24 }, openNow: true };
    const { calls } = await renderScreen(<EditAddressScreen />, {
      server: (c) => {
        if (c.path === '/branches') return { body: [branch] };
        if (c.path === '/addresses' && c.method === 'GET') return { body: [HOME] };
        if (c.path === '/addresses' && c.method === 'POST') return { status: 201, body: { ...OFFICE, id: 'a3', ...(c.body as object) } };
        return undefined;
      },
    });
    await fireEvent.changeText(await screen.findByLabelText('Address'), 'Tower B, King Saud St');
    await fireEvent.changeText(screen.getByLabelText('District'), 'Al Faisaliyah');
    await fireEvent.press(screen.getByRole('button', { name: 'Save address' }));
    await waitFor(() => expect(mockRouter.back).toHaveBeenCalled());
    expect(Location.requestForegroundPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(Location.getCurrentPositionAsync).not.toHaveBeenCalled();
    const body = calls.find((c) => c.path === '/addresses' && c.method === 'POST')?.body as Record<string, unknown>;
    expect(body).toMatchObject({ line: 'Tower B, King Saud St', district: 'Al Faisaliyah' });
    expect(body).not.toHaveProperty('location');
  });

  test('missing street and district are flagged without calling the server', async () => {
    const { calls } = await renderScreen(<EditAddressScreen />, {
      server: (c) => (c.path === '/addresses' ? { body: [HOME] } : undefined),
    });
    await fireEvent.press(await screen.findByRole('button', { name: 'Save address' }));
    expect(screen.getByText('Enter the building and street')).toBeTruthy();
    expect(screen.getByText('Enter the district')).toBeTruthy();
    expect(calls.some((c) => c.method === 'POST')).toBe(false);
  });
});
