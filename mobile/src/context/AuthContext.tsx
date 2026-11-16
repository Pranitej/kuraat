import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { onSignedOut } from '@/services/api.js';
import * as authJs from '@/services/authService.js';
import type { OtpPurpose, PendingOtp, User } from '@/types/api';

/** The shared JS service, typed (its JSDoc defaults are narrower than the real values). */
const auth = authJs as unknown as {
  restoreSession: () => Promise<User | null>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  requestOtp: AuthValue['requestOtp'];
  resendOtp: AuthValue['resendOtp'];
  getPendingOtp: AuthValue['getPendingOtp'];
  clearPendingOtp: AuthValue['clearPendingOtp'];
  verifyOtp: AuthValue['verifyOtp'];
  signInWithPassword: AuthValue['signInWithPassword'];
  completeSignupWithPassword: AuthValue['completeSignupWithPassword'];
  resetPasswordWithOtp: AuthValue['resetPasswordWithOtp'];
  changePassword: AuthValue['changePassword'];
  updateProfile: AuthValue['updateProfile'];
};

type VerifyResult = { next: 'home' | 'set-password' | 'account' | 'delete-account'; user?: User };

export type AuthValue = {
  user: User | null;
  status: 'restoring' | 'ready';
  isAuthenticated: boolean;
  requestOtp: (phone: string, purpose: OtpPurpose, form?: unknown) => Promise<PendingOtp>;
  resendOtp: () => Promise<PendingOtp>;
  getPendingOtp: () => PendingOtp | null;
  clearPendingOtp: () => void;
  verifyOtp: (code: string) => Promise<VerifyResult>;
  signInWithPassword: (phone: string, password: string) => Promise<User>;
  completeSignupWithPassword: (password: string) => Promise<User>;
  resetPasswordWithOtp: (newPassword: string) => Promise<User>;
  changePassword: (input: { currentPassword?: string; newPassword: string }) => Promise<User>;
  updateProfile: (changes: Partial<Pick<User, 'name' | 'email' | 'gender' | 'avatar' | 'phone'>>) => Promise<User>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
};

const AuthContext = createContext<AuthValue | null>(null);

/**
 * The signed-in customer (same as the web's AuthContext). On start the stored session is restored
 * from the server (`status` 'restoring' until then); every call that signs in updates `user`.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<'restoring' | 'ready'>('restoring');

  useEffect(() => {
    let alive = true;
    auth
      .restoreSession()
      .catch(() => null) // server unreachable: start signed out; signing in shows the error
      .then((restored: User | null) => {
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
    <A extends unknown[], R>(fn: (...args: A) => Promise<R>) =>
      async (...args: A): Promise<R> => {
        const result = await fn(...args);
        const maybe = result as { user?: User } & Partial<User>;
        const nextUser = maybe && maybe.user !== undefined ? maybe.user : (result as unknown as User);
        if (nextUser && (nextUser as User).id) setUser(nextUser as User);
        return result;
      },
    [],
  );

  const value = useMemo<AuthValue>(
    () => ({
      user,
      status,
      isAuthenticated: Boolean(user),
      requestOtp: auth.requestOtp,
      resendOtp: auth.resendOtp,
      getPendingOtp: auth.getPendingOtp,
      clearPendingOtp: auth.clearPendingOtp,
      verifyOtp: withUser(auth.verifyOtp),
      signInWithPassword: withUser(auth.signInWithPassword),
      completeSignupWithPassword: withUser(auth.completeSignupWithPassword),
      resetPasswordWithOtp: withUser(auth.resetPasswordWithOtp),
      changePassword: withUser(auth.changePassword),
      updateProfile: withUser(auth.updateProfile),
      signOut: async () => {
        await auth.signOut();
        setUser(null);
      },
      deleteAccount: async () => {
        await auth.deleteAccount();
        setUser(null);
      },
    }),
    [user, status, withUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
