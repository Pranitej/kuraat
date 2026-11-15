import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import * as auth from '@/services/authService.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => auth.getSessionUser());

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
      isAuthenticated: Boolean(user),
      // WhatsApp OTP
      requestOtp: auth.requestOtp,
      resendOtp: auth.resendOtp,
      getPendingOtp: auth.getPendingOtp,
      clearPendingOtp: auth.clearPendingOtp,
      verifyOtp: withUser(auth.verifyOtp),
      // Passwords
      signInWithPassword: withUser(auth.signInWithPassword),
      completeSignupWithPassword: withUser(auth.completeSignupWithPassword),
      resetPasswordWithOtp: withUser(auth.resetPasswordWithOtp),
      changePassword: withUser((data) => auth.changePassword(user?.id, data)),
      // Profile
      updateProfile: withUser((changes) => auth.updateProfile(user?.id, changes)),
      signOut: async () => {
        await auth.signOut();
        setUser(null);
      },
    }),
    [user, withUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
