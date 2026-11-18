/**
 * Accounts on the kuraat server (server/README.md → Login, Profile): WhatsApp code request and
 * verification, password sign-in, sign-up, password set/reset, profile, session restore.
 *
 * The pending WhatsApp verification is kept in session storage so "Edit number", the OTP screen and
 * the set-password screen survive a refresh; the server holds the code itself.
 */
import { onlyDigits, toWirePhone } from '@/domain';
import { session } from '../lib/storage.js';
import { ApiError, apiRequest, clearTokens, getTokens, setTokens } from './api.js';

const OTP_KEY = 'otp';
export const OTP_LENGTH = 6;
export const OTP_RESEND_SECONDS = 60;

const expired = () => new ApiError('Your verification session expired. Please start again.', { code: 'expired' });

function signedIn({ user, tokens }) {
  setTokens(tokens);
  return user;
}

/* ---------------- Session ---------------- */

/** The signed-in user from the stored tokens, or null (no tokens, or the session ended). */
export async function restoreSession() {
  if (!getTokens()) return null;
  try {
    return await apiRequest('/me');
  } catch (error) {
    if (error.code === 'unauthorized') return null;
    throw error;
  }
}

function endLocalSession() {
  clearTokens();
  session.remove(OTP_KEY);
  session.remove('checkout');
}

export async function signOut() {
  const tokens = getTokens();
  if (tokens) await apiRequest('/auth/signout', { method: 'POST', body: { refreshToken: tokens.refreshToken } }).catch(() => null);
  endLocalSession();
}

/**
 * Deletes the account (App Store / Google Play requirement) after a verified `delete-account`
 * WhatsApp code; the server keeps placed orders without personal details. Ends the session here.
 */
export async function deleteAccount() {
  const pending = getPendingOtp();
  if (pending?.purpose !== 'delete-account' || !pending.verificationToken) {
    throw new ApiError('Confirm with the WhatsApp code we sent you first.', { code: 'expired' });
  }
  await apiRequest('/me', { method: 'DELETE', body: { verificationToken: pending.verificationToken } });
  endLocalSession();
}

/* ---------------- WhatsApp code ---------------- */

/** Sign-up address as the server wants it: coordinates only if the customer shared their location; a postcode only if given. */
function signupAddress(address = {}) {
  const line = (address.line || '').trim();
  const district = (address.district || '').trim();
  const city = address.city || 'Al Khobar';
  return {
    line,
    district,
    city,
    ...(address.postcode ? { postcode: address.postcode } : {}),
    ...(address.location ? { location: address.location } : {}), // only a position the customer really shared
  };
}

function remember(view, extra) {
  const pending = { ...view, ...extra, sentAt: Date.parse(view.resendAt) - OTP_RESEND_SECONDS * 1000 };
  session.write(OTP_KEY, pending);
  return pending;
}

/**
 * @param {'signup'|'signin'|'reset'|'delete-account'} purpose
 * @param {object} [form] the sign-up form (kept locally whole, sent without UI-only fields)
 */
export async function requestOtp(phone, purpose, form = null) {
  const body = { phone: toWirePhone(phone), purpose };
  if (purpose === 'signup') body.payload = { name: form.name, gender: form.gender, address: signupAddress(form.address) };
  const view = await apiRequest('/auth/otp/request', { method: 'POST', body });
  return remember(view, { payload: form });
}

export function getPendingOtp() {
  return session.read(OTP_KEY);
}

export function clearPendingOtp() {
  session.remove(OTP_KEY);
}

export async function resendOtp() {
  const pending = getPendingOtp();
  if (!pending) throw expired();
  const view = await apiRequest('/auth/otp/resend', { method: 'POST', body: { challengeId: pending.challengeId } });
  return remember(view, { payload: pending.payload });
}

/**
 * Checks the code. Sign-up / sign-in → signed in: { next: 'home', user }. Reset → { next:
 * 'set-password' }, phone change → { next: 'account' }, delete account → { next: 'delete-account' }
 * (the verification is kept for the next step).
 */
export async function verifyOtp(code) {
  const pending = getPendingOtp();
  if (!pending) throw expired();
  const result = await apiRequest('/auth/otp/verify', { method: 'POST', body: { challengeId: pending.challengeId, code: onlyDigits(code) } });
  if (result.next === 'home') {
    clearPendingOtp();
    return { next: 'home', user: signedIn(result) };
  }
  session.write(OTP_KEY, { ...pending, verified: true, verificationToken: result.verificationToken });
  return { next: result.next };
}

/* ---------------- Passwords ---------------- */

export async function signInWithPassword(phone, password) {
  return signedIn(await apiRequest('/auth/signin', { method: 'POST', body: { phone: toWirePhone(phone), password } }));
}

/** "Set a password instead" during sign-up (PDF screen 05): creates the account with a password. */
export async function completeSignupWithPassword(password) {
  const pending = getPendingOtp();
  if (pending?.purpose !== 'signup') throw new ApiError('Your sign-up session expired. Please start again.', { code: 'expired' });
  const user = signedIn(await apiRequest('/auth/signup/password', { method: 'POST', body: { challengeId: pending.challengeId, password } }));
  clearPendingOtp();
  return user;
}

/** "Forgot password?" after a verified WhatsApp code — signs in with the new password. */
export async function resetPasswordWithOtp(newPassword) {
  const pending = getPendingOtp();
  if (pending?.purpose !== 'reset' || !pending.verificationToken) {
    throw new ApiError('Verify your number with a WhatsApp code first.', { code: 'expired' });
  }
  const user = signedIn(
    await apiRequest('/auth/password/reset', { method: 'POST', body: { verificationToken: pending.verificationToken, newPassword } }),
  );
  clearPendingOtp();
  return user;
}

/** Password screen (PDF screen 19): set the first password, or change it with the current one. */
export async function changePassword({ currentPassword, newPassword }) {
  return apiRequest('/me/password', { method: 'PUT', body: { currentPassword: currentPassword || undefined, newPassword } });
}

/* ---------------- Profile ---------------- */

export async function updateProfile(changes) {
  // The mobile number is fixed once the account exists, so it is never sent.
  const { phone: _fixed, ...body } = changes;
  return apiRequest('/me', { method: 'PATCH', body });
}
