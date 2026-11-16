import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { session } from '@/lib/storage.js';
import { USER, renderScreen } from '@/test/renderScreen';
import { mockRouter, resetRouterMock } from '@/test/routerMock';
import SignInScreen from '../SignInScreen';
import VerifyScreen from '../VerifyScreen';

jest.mock('expo-router', () => require('@/test/routerMock').expoRouterMock);

const TOKENS = { accessToken: 'a2', refreshToken: 'r2', expiresIn: 900 };
const pendingOtp = (purpose: string, sentAgoMs = 0) => ({
  challengeId: `c-${purpose}`,
  phone: '501234821',
  purpose,
  length: 6,
  resendAt: new Date(Date.now() - sentAgoMs + 60_000).toISOString(),
  expiresAt: new Date(Date.now() + 600_000).toISOString(),
  sentAt: Date.now() - sentAgoMs,
});

beforeEach(() => {
  resetRouterMock();
  session.clearAll();
});

describe('06 · Sign in', () => {
  test('password sign-in goes Home and welcomes the customer back', async () => {
    const { calls } = await renderScreen(<SignInScreen />, {
      signedIn: false,
      server: (c) => (c.path === '/auth/signin' ? { body: { user: USER, tokens: TOKENS } } : undefined),
    });
    await fireEvent.changeText(screen.getByPlaceholderText('50 123 4821'), '501234821');
    await fireEvent.changeText(screen.getByPlaceholderText('Your password'), 'Kuraat@2026');
    await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith('/home'));
    expect(calls.find((c) => c.path === '/auth/signin')?.body).toEqual({ phone: '501234821', password: 'Kuraat@2026' });
    expect(screen.getByText('Welcome back, Sara')).toBeTruthy();
  });

  test('a wrong password shows the server message under the password field', async () => {
    await renderScreen(<SignInScreen />, {
      signedIn: false,
      server: (c) =>
        c.path === '/auth/signin'
          ? {
              status: 400,
              body: { code: 'wrong_password', field: 'password', message: 'Incorrect password. Try again or use a WhatsApp code.' },
            }
          : undefined,
    });
    await fireEvent.changeText(screen.getByPlaceholderText('50 123 4821'), '501234821');
    await fireEvent.changeText(screen.getByPlaceholderText('Your password'), 'nope');
    await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText('Incorrect password. Try again or use a WhatsApp code.')).toBeTruthy();
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });

  test('missing fields are flagged without calling the server', async () => {
    const { calls } = await renderScreen(<SignInScreen />, { signedIn: false });
    await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
    expect(screen.getByText('Enter your password')).toBeTruthy();
    expect(calls.some((c) => c.path === '/auth/signin')).toBe(false);
  });
});

describe('04 · Verify your number', () => {
  test('verifies only with all 6 digits (sent automatically on the 6th)', async () => {
    session.write('otp', pendingOtp('signin'));
    const { calls } = await renderScreen(<VerifyScreen />, {
      signedIn: false,
      server: (c) => (c.path === '/auth/otp/verify' ? { body: { next: 'home', user: USER, tokens: TOKENS } } : undefined),
    });
    expect(screen.getByRole('button', { name: 'Verify & continue' })).toBeDisabled();
    await fireEvent.changeText(screen.getByLabelText('Verification code'), '12345');
    expect(screen.getByRole('button', { name: 'Verify & continue' })).toBeDisabled();
    await fireEvent.changeText(screen.getByLabelText('Verification code'), '123456');
    await waitFor(() =>
      expect(calls.find((c) => c.path === '/auth/otp/verify')?.body).toEqual({ challengeId: 'c-signin', code: '123456' }),
    );
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith('/home'));
  });

  test('"Resend code" waits for the 60 s countdown', async () => {
    session.write('otp', pendingOtp('signin'));
    await renderScreen(<VerifyScreen />, { signedIn: false });
    expect(screen.getByText(/Resend code in/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Resend code' })).toBeNull();
  });

  test('after the countdown the code can be sent again', async () => {
    session.write('otp', pendingOtp('signin', 61_000));
    const { calls } = await renderScreen(<VerifyScreen />, {
      signedIn: false,
      server: (c) => (c.path === '/auth/otp/resend' ? { body: pendingOtp('signin') } : undefined),
    });
    await act(async () => {
      await fireEvent.press(await screen.findByRole('button', { name: 'Resend code' }));
    });
    expect(calls.find((c) => c.path === '/auth/otp/resend')?.body).toEqual({ challengeId: 'c-signin' });
  });

  test('delete account: the verified code deletes the account and returns to Welcome', async () => {
    session.write('otp', pendingOtp('delete-account'));
    const { calls } = await renderScreen(<VerifyScreen />, {
      server: (c) => {
        if (c.path === '/auth/otp/verify') return { body: { next: 'delete-account', verificationToken: 'c-delete-account' } };
        if (c.path === '/me' && c.method === 'DELETE') return { status: 204 };
        return undefined;
      },
    });
    await fireEvent.changeText(screen.getByLabelText('Verification code'), '123456');
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith('/welcome'));
    expect(calls.find((c) => c.method === 'DELETE')).toMatchObject({ path: '/me', body: { verificationToken: 'c-delete-account' } });
    expect(screen.getByText('Your account has been deleted')).toBeTruthy();
  });
});
