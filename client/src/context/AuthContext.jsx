import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import * as auth from '@/services/authService.js';
import { onSignedOut } from '@/services/api.js';

const AuthContext = createContext(null);

/**
 * The signed-in customer. On start the stored session is restored from the server (`status`
 * 'restoring' until then); every call that signs in updates `user`.
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState('restoring');

  useEffect(() => {
    let alive = true;
    auth
      .restoreSession()
      .catch(() => null) // server unreachable: start signed out; signing in shows the error
      .then((restored) => {
        if (!alive) return;
        setUser(restored);
        setStatus('ready');
      });
    const off = onSignedOut(() => setUser(null));
    return () => {
      alive = false;
      off();
    };
  }, []);

  const withUser = useCallback(
    (fn) =>
      async (...args) => {
        const result = await fn(...args);
        const nextUser = result && result.user !== undefined ? result.user : result;
        if (nextUser && nextUser.id) setUser(nextUser);
        return result;
      },
    [],
  );

  const value = useMemo(
    () => ({
      user,
      status,
      isAuthenticated: Boolean(user),
      // WhatsApp code
      requestOtp: auth.requestOtp,
      resendOtp: auth.resendOtp,
      getPendingOtp: auth.getPendingOtp,
      clearPendingOtp: auth.clearPendingOtp,
      verifyOtp: withUser(auth.verifyOtp),
      // Passwords
      signInWithPassword: withUser(auth.signInWithPassword),
      completeSignupWithPassword: withUser(auth.completeSignupWithPassword),
      resetPasswordWithOtp: withUser(auth.resetPasswordWithOtp),
      changePassword: withUser(auth.changePassword),
      // Profile
      updateProfile: withUser(auth.updateProfile),
      signOut: async () => {
        await auth.signOut();
        setUser(null);
      },
      /** After a verified `delete-account` code (store requirement): the account is gone, signed out. */
      deleteAccount: async () => {
        await auth.deleteAccount();
        setUser(null);
      },
    }),
    [user, status, withUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
