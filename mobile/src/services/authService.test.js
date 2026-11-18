import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { local, session, tokenStore } from '@/lib/storage.js';
import { API_BASE_URL as ENV_BASE_URL } from '@/lib/env.js';
import { stubFetch } from '@/test/stubFetch.js';
import { API_BASE_URL, getTokens, setTokens } from './api.js';
import {
  completeSignupWithPassword,
  deleteAccount,
  getPendingOtp,
  requestOtp,
  resetPasswordWithOtp,
  restoreSession,
  signInWithPassword,
  signOut,
  updateProfile,
  verifyOtp,
} from './authService.js';

const USER = { id: 'u1', name: 'Noura Al-Qahtani', phone: '501112233', email: null, gender: 'female', avatar: null, hasPassword: false };
const TOKENS = { accessToken: 'a1', refreshToken: 'r1', expiresIn: 900 };
const challenge = (purpose, phone = '501112233') => ({
  challengeId: `c-${purpose}`,
  phone,
  purpose,
  length: 6,
  resendAt: '2026-11-15T09:22:00.000Z',
  expiresAt: '2026-11-15T09:31:00.000Z',
});

beforeEach(() => {
  local.clearAll();
  session.clearAll();
});
afterEach(() => vi.unstubAllGlobals());

const signupForm = {
  name: 'Noura Al-Qahtani',
  gender: 'female',
  address: { line: 'Building 3, Prince Turki St', district: 'Al Yarmouk', city: 'Al Khobar' },
  addressText: 'Building 3, Prince Turki St, Al Yarmouk',
};

describe('sign-up with a WhatsApp code', () => {
  test('sends the form with coordinates (no made-up postcode), but not the typed address text', async () => {
    const calls = stubFetch(() => ({ body: challenge('signup') }));
    await requestOtp('50 111 2233', 'signup', signupForm);
    expect(calls[0]).toMatchObject({ path: '/auth/otp/request', method: 'POST' });
    const { body } = calls[0];
    expect(body).toMatchObject({ phone: '501112233', purpose: 'signup' });
    expect(body.payload).toEqual({
      name: 'Noura Al-Qahtani',
      gender: 'female',
      address: {
        line: 'Building 3, Prince Turki St',
        district: 'Al Yarmouk',
        city: 'Al Khobar',
        location: { lat: expect.any(Number), lng: expect.any(Number) },
      },
    });
  });

  test('keeps coordinates the form already has', async () => {
    const calls = stubFetch(() => ({ body: challenge('signup') }));
    await requestOtp('501112233', 'signup', { ...signupForm, address: { ...signupForm.address, location: { lat: 26.3, lng: 50.2 } } });
    expect(calls[0].body.payload.address.location).toEqual({ lat: 26.3, lng: 50.2 });
  });

  test('remembers the challenge, the whole form and a sentAt the 60 s countdown can use', async () => {
    stubFetch(() => ({ body: challenge('signup') }));
    await requestOtp('501112233', 'signup', signupForm);
    expect(getPendingOtp()).toMatchObject({
      challengeId: 'c-signup',
      phone: '501112233',
      purpose: 'signup',
      payload: signupForm,
      sentAt: Date.parse('2026-11-15T09:21:00.000Z'),
    });
  });

  test('the right code signs in: tokens stored, pending cleared, user returned', async () => {
    const calls = stubFetch((call) => (call.path === '/auth/otp/request' ? { body: challenge('signup') } : { body: { next: 'home', user: USER, tokens: TOKENS } }));
    await requestOtp('501112233', 'signup', signupForm);
    expect(await verifyOtp('123456')).toEqual({ next: 'home', user: USER });
    expect(calls[1]).toMatchObject({ path: '/auth/otp/verify', body: { challengeId: 'c-signup', code: '123456' } });
    expect(getTokens()).toEqual({ accessToken: 'a1', refreshToken: 'r1' });
    expect(getPendingOtp()).toBeNull();
  });

  test('a wrong code keeps the pending verification and passes the error on', async () => {
    stubFetch((call) =>
      call.path === '/auth/otp/request'
        ? { body: challenge('signup') }
        : { status: 400, body: { message: 'That code is not correct.', code: 'wrong_code', field: 'code' } },
    );
    await requestOtp('501112233', 'signup', signupForm);
    await expect(verifyOtp('000000')).rejects.toMatchObject({ code: 'wrong_code', field: 'code' });
    expect(getPendingOtp()).not.toBeNull();
  });

  test('"Set a password instead" creates the account from the pending challenge', async () => {
    const calls = stubFetch((call) => (call.path === '/auth/otp/request' ? { body: challenge('signup') } : { body: { user: USER, tokens: TOKENS } }));
    await requestOtp('501112233', 'signup', signupForm);
    expect(await completeSignupWithPassword('Kuraat@2026')).toEqual(USER);
    expect(calls[1]).toMatchObject({ path: '/auth/signup/password', body: { challengeId: 'c-signup', password: 'Kuraat@2026' } });
    expect(getPendingOtp()).toBeNull();
  });
});

describe('password reset and phone change', () => {
  test('reset: the verification token is kept and sent with the new password', async () => {
    const calls = stubFetch((call) => {
      if (call.path === '/auth/otp/request') return { body: challenge('reset', '501234821') };
      if (call.path === '/auth/otp/verify') return { body: { next: 'set-password', verificationToken: 'v-reset' } };
      return { body: { user: USER, tokens: TOKENS } };
    });
    await requestOtp('501234821', 'reset');
    expect(await verifyOtp('123456')).toEqual({ next: 'set-password' });
    expect(getPendingOtp()).toMatchObject({ purpose: 'reset', verified: true });
    await resetPasswordWithOtp('NewPass123');
    expect(calls[2]).toMatchObject({ path: '/auth/password/reset', body: { verificationToken: 'v-reset', newPassword: 'NewPass123' } });
    expect(getTokens()).toEqual({ accessToken: 'a1', refreshToken: 'r1' });
    expect(getPendingOtp()).toBeNull();
  });

  test('phone change: the verification token goes with the new number, then is cleared', async () => {
    setTokens({ accessToken: 'a0', refreshToken: 'r0' });
    const calls = stubFetch((call) => {
      if (call.path === '/auth/otp/request') return { body: challenge('change-phone', '559998877') };
      if (call.path === '/auth/otp/verify') return { body: { next: 'account', verificationToken: 'v-phone' } };
      return { body: { ...USER, phone: '559998877' } };
    });
    await requestOtp('55 999 8877', 'change-phone');
    await verifyOtp('123456');
    expect((await updateProfile({ phone: '559998877' })).phone).toBe('559998877');
    expect(calls[2]).toMatchObject({ path: '/me', method: 'PATCH', auth: 'Bearer a0', body: { phone: '559998877', verificationToken: 'v-phone' } });
    expect(getPendingOtp()).toBeNull();
  });

  test('a profile change without a new phone sends no verification token', async () => {
    setTokens({ accessToken: 'a0', refreshToken: 'r0' });
    const calls = stubFetch(() => ({ body: USER }));
    await updateProfile({ name: 'Noura', email: '', gender: 'female', avatar: null });
    expect(calls[0].body).toEqual({ name: 'Noura', email: '', gender: 'female', avatar: null });
  });
});

describe('session', () => {
  test('password sign-in stores the tokens and returns the user', async () => {
    const calls = stubFetch(() => ({ body: { user: USER, tokens: TOKENS } }));
    expect(await signInWithPassword('50 123 4821', 'Kuraat@2026')).toEqual(USER);
    expect(calls[0]).toMatchObject({ path: '/auth/signin', body: { phone: '501234821', password: 'Kuraat@2026' } });
    expect(getTokens()).toEqual({ accessToken: 'a1', refreshToken: 'r1' });
  });

  test('restoreSession: null without tokens, the user with them', async () => {
    const calls = stubFetch(() => ({ body: USER }));
    expect(await restoreSession()).toBeNull();
    expect(calls).toHaveLength(0);
    setTokens({ accessToken: 'a1', refreshToken: 'r1' });
    expect(await restoreSession()).toEqual(USER);
    expect(calls[0]).toMatchObject({ path: '/me', auth: 'Bearer a1' });
  });

  test('restoreSession: an ended session gives null', async () => {
    setTokens({ accessToken: 'a1', refreshToken: 'r1' });
    stubFetch(() => ({ status: 401, body: { message: 'Please sign in again.', code: 'unauthorized', field: null } }));
    expect(await restoreSession()).toBeNull();
  });

  test('signOut revokes the refresh token and clears the session even if the server is unreachable', async () => {
    setTokens({ accessToken: 'a1', refreshToken: 'r1' });
    session.write('checkout', { addressId: 'x' });
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    }));
    await signOut();
    expect(fetch).toHaveBeenCalledWith(expect.stringMatching(/\/auth\/signout$/), expect.objectContaining({ method: 'POST', body: JSON.stringify({ refreshToken: 'r1' }) }));
    expect(getTokens()).toBeNull();
    expect(session.read('checkout')).toBeNull();
  });
});

describe('delete account (store requirement)', () => {
  test('code for the own number → verify → DELETE /me with the token; session and drafts cleared', async () => {
    setTokens(TOKENS);
    session.write('checkout', { addressId: 'a1' });
    const calls = stubFetch(({ path }) => {
      if (path === '/auth/otp/request') return { body: challenge('delete-account') };
      if (path === '/auth/otp/verify') return { body: { next: 'delete-account', verificationToken: 'c-delete-account' } };
      if (path === '/me') return { status: 204 };
      return { status: 404, body: { code: 'not_found', message: 'x' } };
    });
    await requestOtp('50 111 2233', 'delete-account');
    expect(calls[0].body).toEqual({ phone: '501112233', purpose: 'delete-account' });
    expect(await verifyOtp('123456')).toEqual({ next: 'delete-account' });

    await deleteAccount();
    expect(calls[2]).toMatchObject({ path: '/me', method: 'DELETE', body: { verificationToken: 'c-delete-account' } });
    expect(getTokens()).toBeNull();
    expect(getPendingOtp()).toBeNull();
    expect(session.read('checkout')).toBeNull();
  });

  test('without a verified delete-account code nothing is sent', async () => {
    const calls = stubFetch(() => ({ status: 204 }));
    await expect(deleteAccount()).rejects.toMatchObject({ code: 'expired' });
    expect(calls).toHaveLength(0);
  });
});

describe('platform seams shared with the mobile app', () => {
  test('the session tokens are read and written through tokenStore', () => {
    setTokens(TOKENS);
    expect(tokenStore.read()).toEqual({ accessToken: 'a1', refreshToken: 'r1' });
    tokenStore.remove();
    expect(getTokens()).toBeNull();
  });

  test('the API address comes from lib/env.js', () => {
    expect(API_BASE_URL).toBe(ENV_BASE_URL);
  });
});
