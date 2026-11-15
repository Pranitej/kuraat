/**
 * Authentication service (demo implementation). Same surface the real API client will expose:
 * WhatsApp OTP request/verify, password sign-in, registration, password set/reset, profile update.
 * Passwords are never stored — only a one-way hash — and sessions hold just the user id.
 */

import { hashPassword, onlyDigits, welcomeNotification, uid, locateAddress, postcodeFor } from '@/domain';
import { getDb, updateDb, userBucket } from './db.js';
import { request, ApiError } from './request.js';
import { local, session } from '../lib/storage.js';

const SESSION_KEY = 'session';
const OTP_KEY = 'otp';
export const OTP_LENGTH = 6;
export const OTP_RESEND_SECONDS = 60;

const publicUser = (u) => {
  if (!u) return null;
  const { passwordHash, ...rest } = u;
  return rest;
};

const findByPhone = (db, phone) => db.users.find((u) => u.phone === onlyDigits(phone));

/* ---------------- Session ---------------- */

export function getSessionUser() {
  const s = local.read(SESSION_KEY);
  if (!s) return null;
  const user = getDb().users.find((u) => u.id === s.userId);
  return publicUser(user);
}

function startSession(user) {
  local.write(SESSION_KEY, { userId: user.id, since: new Date().toISOString() });
  return publicUser(user);
}

export async function signOut() {
  return request(() => {
    local.remove(SESSION_KEY);
    session.remove(OTP_KEY);
    session.remove('checkout');
    return true;
  }, { min: 300, max: 500 });
}

/* ---------------- WhatsApp OTP ---------------- */

/**
 * @param {'signup'|'signin'|'reset'|'change-phone'} purpose
 * @param {object} payload extra data carried through verification (e.g. sign-up form)
 */
export async function requestOtp(phone, purpose, payload = null) {
  return request(() => {
    const digits = onlyDigits(phone);
    const db = getDb();
    const existing = findByPhone(db, digits);
    if ((purpose === 'signup' || purpose === 'change-phone') && existing) {
      throw new ApiError('This number already has a kuraat account.', { code: 'phone_taken', field: 'phone' });
    }
    if ((purpose === 'signin' || purpose === 'reset') && !existing) {
      throw new ApiError('We could not find an account with this number.', { code: 'not_found', field: 'phone' });
    }
    const pending = { phone: digits, purpose, payload, sentAt: Date.now() };
    session.write(OTP_KEY, pending);
    return pending;
  });
}

export function getPendingOtp() {
  return session.read(OTP_KEY);
}

export async function resendOtp() {
  return request(() => {
    const pending = session.read(OTP_KEY);
    if (!pending) throw new ApiError('Your verification session expired. Please start again.', { code: 'expired' });
    const next = { ...pending, sentAt: Date.now() };
    session.write(OTP_KEY, next);
    return next;
  });
}

/**
 * Verifies the WhatsApp code and completes the pending action.
 * Returns { user?, next } where `next` tells the UI where to go.
 */
export async function verifyOtp(code) {
  return request(() => {
    const pending = session.read(OTP_KEY);
    if (!pending) throw new ApiError('Your verification session expired. Please start again.', { code: 'expired' });
    const digits = onlyDigits(code);
    if (digits.length !== OTP_LENGTH) throw new ApiError('Enter the 6-digit code.', { code: 'invalid', field: 'code' });
    if (digits === '000000') {
      throw new ApiError('That code is not correct. Check WhatsApp and try again.', { code: 'wrong_code', field: 'code' });
    }
    if (Date.now() - pending.sentAt > 10 * 60 * 1000) {
      throw new ApiError('This code has expired. Request a new one.', { code: 'expired_code', field: 'code' });
    }

    if (pending.purpose === 'signup') {
      const user = createUser(pending.payload, pending.phone);
      session.remove(OTP_KEY);
      return { user: startSession(user), next: 'home' };
    }
    if (pending.purpose === 'signin') {
      const user = findByPhone(getDb(), pending.phone);
      session.remove(OTP_KEY);
      return { user: startSession(user), next: 'home' };
    }
    if (pending.purpose === 'reset') {
      session.write(OTP_KEY, { ...pending, verified: true });
      return { next: 'set-password' };
    }
    if (pending.purpose === 'change-phone') {
      session.write(OTP_KEY, { ...pending, verified: true });
      return { next: 'account' };
    }
    throw new ApiError('Something went wrong. Please try again.');
  }, { min: 700, max: 1100 });
}

export function clearPendingOtp() {
  session.remove(OTP_KEY);
}

function createUser(form, phone) {
  return updateDb((db) => {
    const now = new Date();
    const user = {
      id: uid('u'),
      name: form.name.trim(),
      phone,
      gender: form.gender,
      email: '',
      avatar: null,
      passwordHash: null,
      hasPassword: false,
      createdAt: now.toISOString(),
    };
    db.users.push(user);
    const addressLine = (form.address?.line || '').trim();
    const district = form.address?.district || '';
    const city = form.address?.city || 'Al Khobar';
    userBucket(db, 'addresses', user.id).push({
      id: uid('addr'),
      label: 'Home',
      type: 'home',
      line: addressLine,
      district,
      city,
      postcode: form.address?.postcode || postcodeFor(district, city),
      landmark: '',
      contactName: user.name,
      phone,
      isDefault: true,
      location: form.address?.location || locateAddress({ line: addressLine, district, city }),
    });
    userBucket(db, 'orders', user.id);
    userBucket(db, 'notifications', user.id).push(welcomeNotification(now));
    userBucket(db, 'favorites', user.id);
    if (!db.carts) db.carts = {};
    db.carts[user.id] = { items: [], promoCode: null };
    return user;
  });
}

/* ---------------- Password ---------------- */

export async function signInWithPassword(phone, password) {
  return request(() => {
    const user = findByPhone(getDb(), phone);
    if (!user) throw new ApiError('We could not find an account with this number.', { code: 'not_found', field: 'phone' });
    if (!user.hasPassword) {
      throw new ApiError('No password is set for this account yet. Sign in with a WhatsApp code.', {
        code: 'no_password',
        field: 'password',
      });
    }
    if (user.passwordHash !== hashPassword(user.id, password)) {
      throw new ApiError('Incorrect password. Try again or use a WhatsApp code.', { code: 'wrong_password', field: 'password' });
    }
    return startSession(user);
  }, { min: 650, max: 1000 });
}

function applyPassword(db, user, newPassword) {
  const hadPassword = user.hasPassword;
  user.passwordHash = hashPassword(user.id, newPassword);
  user.hasPassword = true;
  userBucket(db, 'notifications', user.id).unshift({
    id: uid('n'),
    type: 'security',
    title: hadPassword ? 'Password updated' : 'Password set',
    body: hadPassword ? 'Your password was changed successfully.' : 'You can now sign in without a WhatsApp code.',
    createdAt: new Date().toISOString(),
    read: false,
    link: { kind: 'password' },
  });
}

/**
 * "Set a password instead" during sign-up (PDF screen 05): creates the account from the pending
 * sign-up form with a password, then signs in.
 */
export async function completeSignupWithPassword(newPassword) {
  return request(() => {
    const pending = session.read(OTP_KEY);
    if (!pending || pending.purpose !== 'signup') {
      throw new ApiError('Your sign-up session expired. Please start again.', { code: 'expired' });
    }
    if (findByPhone(getDb(), pending.phone)) {
      throw new ApiError('This number already has a kuraat account.', { code: 'phone_taken' });
    }
    const user = createUser(pending.payload, pending.phone);
    updateDb((db) => applyPassword(db, db.users.find((u) => u.id === user.id), newPassword));
    session.remove(OTP_KEY);
    return startSession(getDb().users.find((u) => u.id === user.id));
  }, { min: 800, max: 1200 });
}

/** Reset after a verified WhatsApp code ("Forgot password?") — signs the user in afterwards. */
export async function resetPasswordWithOtp(newPassword) {
  return request(() => {
    const pending = session.read(OTP_KEY);
    if (!pending || pending.purpose !== 'reset' || !pending.verified) {
      throw new ApiError('Verify your number with a WhatsApp code first.', { code: 'expired' });
    }
    const user = updateDb((db) => {
      const u = findByPhone(db, pending.phone);
      if (!u) throw new ApiError('We could not find an account with this number.', { code: 'not_found' });
      applyPassword(db, u, newPassword);
      return u;
    });
    session.remove(OTP_KEY);
    return startSession(user);
  }, { min: 700, max: 1100 });
}

/** Password screen (PDF screen 19): set the first password, or change it with the current one. */
export async function changePassword(userId, { currentPassword, newPassword }) {
  return request(
    () =>
      updateDb((db) => {
        const user = db.users.find((u) => u.id === userId);
        if (!user) throw new ApiError('Your session expired. Please sign in again.', { code: 'expired' });
        if (user.hasPassword) {
          if (!currentPassword || user.passwordHash !== hashPassword(user.id, currentPassword)) {
            throw new ApiError('Your current password is incorrect.', { code: 'wrong_password', field: 'currentPassword' });
          }
          if (user.passwordHash === hashPassword(user.id, newPassword)) {
            throw new ApiError('Choose a password you have not used before.', { code: 'same_password', field: 'newPassword' });
          }
        }
        applyPassword(db, user, newPassword);
        return publicUser(user);
      }),
    { min: 700, max: 1100 },
  );
}

/* ---------------- Profile ---------------- */

export async function updateProfile(userId, changes) {
  return request(() =>
    updateDb((db) => {
      const user = db.users.find((u) => u.id === userId);
      if (!user) throw new ApiError('Your session expired. Please sign in again.', { code: 'expired' });
      const pending = session.read(OTP_KEY);
      if (changes.phone && onlyDigits(changes.phone) !== user.phone) {
        const digits = onlyDigits(changes.phone);
        if (!(pending?.purpose === 'change-phone' && pending.verified && pending.phone === digits)) {
          throw new ApiError('Verify your new number with a WhatsApp code first.', { code: 'unverified_phone', field: 'phone' });
        }
        if (db.users.some((u) => u.phone === digits && u.id !== userId)) {
          throw new ApiError('This number already has a kuraat account.', { code: 'phone_taken', field: 'phone' });
        }
        // Keep password usable after the number changes
        user.phone = digits;
        session.remove(OTP_KEY);
      }
      if (changes.name != null) user.name = changes.name.trim();
      if (changes.email != null) user.email = changes.email.trim();
      if (changes.gender != null) user.gender = changes.gender;
      if (changes.avatar !== undefined) user.avatar = changes.avatar;
      return publicUser(user);
    }),
  );
}

export function phoneIsRegistered(phone) {
  return Boolean(findByPhone(getDb(), phone));
}
