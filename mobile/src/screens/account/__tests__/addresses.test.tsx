import { fireEvent, screen, waitFor } from '@testing-library/react-native';
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
  phone: '501234821',
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
  test('a new address from Delivery is saved, selected for the checkout, and returns there', async () => {
    setMockParams({ returnTo: '/checkout/delivery' });
    let list = [HOME];
    const { calls } = await renderScreen(<EditAddressScreen />, {
      server: (c) => {
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
    await fireEvent.changeText(screen.getByLabelText('Address'), 'Tower B, King Saud St');
    await fireEvent.changeText(screen.getByLabelText('District'), 'Al Yarmouk');
    await fireEvent.press(screen.getByRole('button', { name: 'Save address' }));
    await waitFor(() => expect(mockRouter.back).toHaveBeenCalled());
    const body = calls.find((c) => c.path === '/addresses' && c.method === 'POST')?.body as Record<string, unknown>;
    expect(body).toMatchObject({
      type: 'office',
      line: 'Tower B, King Saud St',
      district: 'Al Yarmouk',
      city: 'Al Khobar',
      postcode: '31952',
      phone: '501234821',
    });
    expect(body.location).toEqual({ lat: expect.any(Number), lng: expect.any(Number) });
    expect(session.read('checkout')).toMatchObject({ addressId: 'a3' });
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
