import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import * as Location from 'expo-location';
import { session } from '@/lib/storage.js';
import type { FetchCall } from '@/test/jestFetch';
import { renderScreen } from '@/test/renderScreen';
import { mockRouter, resetRouterMock } from '@/test/routerMock';
import SignUpScreen from '../SignUpScreen';

jest.mock('expo-router', () => require('@/test/routerMock').expoRouterMock);

const challenge = { challengeId: 'c1', phone: '501112233', purpose: 'signup', length: 6, resendAt: new Date(Date.now() + 60_000).toISOString(), expiresAt: new Date(Date.now() + 600_000).toISOString() };
const otpRequests = (calls: FetchCall[]) => calls.filter((c) => c.path === '/auth/otp/request');

beforeEach(() => {
  resetRouterMock();
  session.clearAll();
  jest.mocked(Location.requestForegroundPermissionsAsync).mockClear();
  jest.mocked(Location.getCurrentPositionAsync).mockClear();
});

async function fillAndContinue() {
  await fireEvent.changeText(await screen.findByLabelText('Full name'), 'Noura Al-Qahtani');
  await fireEvent.changeText(screen.getByLabelText('Mobile number'), '501112233');
  await fireEvent.press(screen.getByRole('radio', { name: 'Female' }));
  await fireEvent.changeText(screen.getByLabelText('Delivery address'), 'Building 3, Prince Turki St, Al Yarmouk, Al Khobar');
  await fireEvent.press(screen.getByRole('button', { name: 'Continue with WhatsApp' }));
}

describe('03 · Create your account — location', () => {
  test('the device location is asked once when the form opens, and a Saudi one is sent with the sign-up', async () => {
    const { calls } = await renderScreen(<SignUpScreen />, { signedIn: false, server: (c) => (c.path === '/auth/otp/request' ? { body: challenge } : undefined) });
    await waitFor(() => expect(Location.requestForegroundPermissionsAsync).toHaveBeenCalledTimes(1));
    expect((await screen.findAllByText(/Location saved/)).length).toBeGreaterThan(0);
    await fillAndContinue();
    await waitFor(() => expect(mockRouter.push).toHaveBeenCalledWith('/verify'));
    const body = otpRequests(calls)[0].body as { payload: { address: Record<string, unknown> } };
    expect(body.payload.address.location).toEqual({ lat: 26.2874, lng: 50.2085 });
  });

  test('a location outside Saudi Arabia (e.g. India) is not attached, and sign-up still works', async () => {
    jest.mocked(Location.getCurrentPositionAsync).mockResolvedValueOnce({ coords: { latitude: 17.385, longitude: 78.4867 }, timestamp: 0 } as never);
    const { calls } = await renderScreen(<SignUpScreen />, { signedIn: false, server: (c) => (c.path === '/auth/otp/request' ? { body: challenge } : undefined) });
    await waitFor(() => expect(Location.getCurrentPositionAsync).toHaveBeenCalledTimes(1));
    await fillAndContinue();
    await waitFor(() => expect(mockRouter.push).toHaveBeenCalledWith('/verify'));
    const body = otpRequests(calls)[0].body as { payload: { address: Record<string, unknown> } };
    expect(body.payload.address).not.toHaveProperty('location');
    expect(screen.queryByText(/Location saved/)).toBeNull();
  });

  test('a refused permission also signs up without a location', async () => {
    jest.mocked(Location.requestForegroundPermissionsAsync).mockResolvedValueOnce({ status: 'denied', granted: false, canAskAgain: false } as never);
    const { calls } = await renderScreen(<SignUpScreen />, { signedIn: false, server: (c) => (c.path === '/auth/otp/request' ? { body: challenge } : undefined) });
    await waitFor(() => expect(Location.requestForegroundPermissionsAsync).toHaveBeenCalledTimes(1));
    await fillAndContinue();
    await waitFor(() => expect(mockRouter.push).toHaveBeenCalledWith('/verify'));
    expect((otpRequests(calls)[0].body as { payload: { address: object } }).payload.address).not.toHaveProperty('location');
  });
});

describe('03 · Create your account — a server refusal is always shown', () => {
  test('an error on a field the form does not display (address.location) appears under the address, instead of nothing happening', async () => {
    await renderScreen(<SignUpScreen />, {
      signedIn: false,
      server: (c) => (c.path === '/auth/otp/request' ? { status: 400, body: { code: 'out_of_area', field: 'address.location', message: 'We deliver only within Saudi Arabia. Move the pin to your address.' } } : undefined),
    });
    await fillAndContinue();
    expect(await screen.findByText('We deliver only within Saudi Arabia. Move the pin to your address.')).toBeTruthy();
    expect(mockRouter.push).not.toHaveBeenCalled();
  });

  test('an error with an unknown field falls back to the form message', async () => {
    await renderScreen(<SignUpScreen />, {
      signedIn: false,
      server: (c) => (c.path === '/auth/otp/request' ? { status: 503, body: { code: 'otp_unavailable', message: "We can't send WhatsApp codes right now." } } : undefined),
    });
    await fillAndContinue();
    expect(await screen.findByText("We can't send WhatsApp codes right now.")).toBeTruthy();
  });
});
