import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { USER, renderScreen } from '@/test/renderScreen';
import { mockRouter, resetRouterMock } from '@/test/routerMock';
import AccountScreen from '../AccountScreen';
import PasswordScreen from '../PasswordScreen';
import ProfileScreen from '../ProfileScreen';

jest.mock('expo-router', () => require('@/test/routerMock').expoRouterMock);

beforeEach(() => resetRouterMock());

describe('17 · Profile', () => {
  test('shows the customer and logs out after confirming', async () => {
    const { calls } = await renderScreen(<ProfileScreen />);
    expect(await screen.findByText('Sara Al-Mutairi')).toBeTruthy();
    expect(screen.getByText('+966 50 123 4821')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Log out' }));
    await fireEvent.press(screen.getAllByRole('button', { name: 'Log out' }).at(-1)!);
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith('/welcome'));
    expect(calls.some((c) => c.path === '/auth/signout')).toBe(true);
  });
});

describe('18 · Account', () => {
  test('Save sends the profile changes', async () => {
    const { calls } = await renderScreen(<AccountScreen />, {
      server: (c) => (c.path === '/me' && c.method === 'PATCH' ? { body: { ...USER, ...(c.body as object) } } : undefined),
    });
    await fireEvent.changeText(await screen.findByLabelText('Full name'), 'Sara M');
    await fireEvent.press(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() =>
      expect(calls.find((c) => c.path === '/me' && c.method === 'PATCH')?.body).toEqual({
        name: 'Sara M',
        email: 'sara.m@example.com',
        gender: 'female',
        avatar: null,
      }),
    );
    expect(await screen.findByText('Your changes have been saved')).toBeTruthy();
  });

  test('Delete account asks first, then sends a WhatsApp code for the own number and opens Verify', async () => {
    const { calls } = await renderScreen(<AccountScreen />, {
      server: (c) =>
        c.path === '/auth/otp/request'
          ? {
              body: {
                challengeId: 'c1',
                phone: '501234821',
                purpose: 'delete-account',
                length: 6,
                resendAt: new Date(Date.now() + 60_000).toISOString(),
                expiresAt: new Date(Date.now() + 600_000).toISOString(),
              },
            }
          : undefined,
    });
    await fireEvent.press(await screen.findByRole('button', { name: 'Delete account' }));
    expect(screen.getByText('Delete your account?')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Send code' }));
    await waitFor(() => expect(mockRouter.push).toHaveBeenCalledWith('/verify'));
    expect(calls.find((c) => c.path === '/auth/otp/request')?.body).toEqual({ phone: '501234821', purpose: 'delete-account' });
  });

  test('an order on its way: the server reason is shown and no code is sent', async () => {
    await renderScreen(<AccountScreen />, {
      server: (c) =>
        c.path === '/auth/otp/request'
          ? {
              status: 409,
              body: {
                code: 'order_in_progress',
                message: 'You have an order on its way. You can delete your account once it is delivered or cancelled.',
              },
            }
          : undefined,
    });
    await fireEvent.press(await screen.findByRole('button', { name: 'Delete account' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Send code' }));
    expect(
      await screen.findByText('You have an order on its way. You can delete your account once it is delivered or cancelled.'),
    ).toBeTruthy();
    expect(mockRouter.push).not.toHaveBeenCalled();
  });
});

describe('19 · Password', () => {
  test('first password: no "Current password" field and the button says Set password', async () => {
    await renderScreen(<PasswordScreen />, { server: (c) => (c.path === '/me' ? { body: { ...USER, hasPassword: false } } : undefined) });
    expect(await screen.findByRole('button', { name: 'Set password' })).toBeTruthy();
    expect(screen.queryByLabelText('Current password')).toBeNull();
  });

  test('change password: current one required', async () => {
    const { calls } = await renderScreen(<PasswordScreen />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Update password' }));
    expect(screen.getByText('Enter your current password')).toBeTruthy();
    expect(calls.some((c) => c.path === '/me/password')).toBe(false);
  });
});
