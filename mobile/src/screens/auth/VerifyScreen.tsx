import { Redirect, useRouter, type Href } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { AuthLayout } from '@/components/layout';
import { KeyRound } from '@/components/icons';
import { Button, OtpInput, Text, TextDivider, TextLink, WhatsAppIcon } from '@/components/ui';
import { ROUTES } from '@/config/routes.js';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { firstName, formatPhone } from '@/domain';
import { useCountdown } from '@/hooks';
import { OTP_RESEND_SECONDS } from '@/services/authService.js';
import { colors } from '@/theme/theme';
import type { OtpPurpose } from '@/types/api';

/** Where "Edit number" and back go for each purpose. */
const ORIGIN: Record<OtpPurpose, Href> = {
  signup: ROUTES.signUp,
  signin: ROUTES.signIn,
  reset: ROUTES.signIn,
  'change-phone': ROUTES.account,
  'delete-account': ROUTES.account,
};

/** 04 · WhatsApp OTP — "Verify your number" (sign-up, sign-in, reset, phone change, delete account). */
export default function VerifyScreen() {
  const router = useRouter();
  const toast = useToast();
  const { getPendingOtp, verifyOtp, resendOtp, updateProfile, deleteAccount, user } = useAuth();
  const [pending, setPending] = useState(() => getPendingOtp());
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const secondsLeft = useCountdown(pending ? pending.sentAt + OTP_RESEND_SECONDS * 1000 : 0);

  const verify = useCallback(
    async (value: string) => {
      if (verifying || !pending) return;
      if (value.length !== 6) {
        setError('Enter the 6-digit code.');
        return;
      }
      setVerifying(true);
      setError('');
      try {
        const result = await verifyOtp(value);
        if (result.next === 'home') {
          const name = firstName(result.user?.name || '');
          toast.show(pending.purpose === 'signup' ? `Welcome to kuraat, ${name}` : `Welcome back, ${name}`);
          router.replace(ROUTES.home);
        } else if (result.next === 'set-password') {
          router.replace(ROUTES.setPassword);
        } else if (result.next === 'account') {
          await updateProfile({ phone: pending.phone });
          toast.show('Your mobile number has been updated');
          if (router.canGoBack()) router.back();
          else router.replace(ROUTES.account);
        } else if (result.next === 'delete-account') {
          await deleteAccount();
          toast.show('Your account has been deleted');
          router.replace(ROUTES.welcome);
        }
      } catch (err) {
        setError((err as Error).message);
        setCode('');
        setVerifying(false);
      }
    },
    [verifying, pending, verifyOtp, toast, router, updateProfile, deleteAccount],
  );

  if (!pending) return <Redirect href={user ? ROUTES.home : ROUTES.welcome} />;

  const resend = async () => {
    setResending(true);
    try {
      const next = await resendOtp();
      setPending(next);
      setCode('');
      setError('');
      toast.show(`A new code was sent to ${formatPhone(pending.phone)}`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setResending(false);
    }
  };

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
  const ss = String(secondsLeft % 60).padStart(2, '0');
  const origin = ORIGIN[pending.purpose];

  return (
    <AuthLayout title="Verify your number" backFallback={origin}>
      <View style={styles.sentTo}>
        <View style={styles.badge}>
          <WhatsAppIcon size={26} />
        </View>
        <View style={styles.flex}>
          <Text color="muted">Code sent on WhatsApp to</Text>
          <Text weight={700} style={styles.phone}>
            {formatPhone(pending.phone)}
          </Text>
          <TextLink size={13} onPress={() => router.replace(origin)}>
            Edit number
          </TextLink>
        </View>
      </View>

      <View style={styles.code}>
        <OtpInput
          value={code}
          onChange={(v) => {
            setCode(v);
            if (error) setError('');
          }}
          onComplete={verify}
          error={error || null}
          disabled={verifying}
        />
        {error ? (
          <Text variant="label" color="hotpink" align="center" style={styles.error} accessibilityRole="alert">
            {error}
          </Text>
        ) : null}
        <View style={styles.resend} accessibilityLiveRegion="polite">
          {secondsLeft > 0 ? (
            <Text color="muted" align="center">
              Resend code in{' '}
              <Text weight={700} style={styles.tabular}>
                {`${mm}:${ss}`}
              </Text>
            </Text>
          ) : (
            <Button variant="ghost" size="sm" loading={resending} onPress={resend} style={styles.center}>
              Resend code
            </Button>
          )}
        </View>
        <Button block loading={verifying} disabled={code.length !== 6 && !verifying} onPress={() => verify(code)} style={styles.verify}>
          Verify &amp; continue
        </Button>
      </View>

      {pending.purpose === 'signup' ? (
        <>
          <TextDivider style={styles.divider}>Did not get the code on WhatsApp?</TextDivider>
          <Button variant="secondary" block leftIcon={KeyRound} onPress={() => router.push(ROUTES.setPassword)} style={styles.instead}>
            Set a password instead
          </Button>
          <Text color="muted" align="center" style={styles.later}>
            You can still sign in with a WhatsApp code later.
          </Text>
        </>
      ) : null}
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  sentTo: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  badge: { width: 60, height: 60, borderRadius: 30, backgroundColor: colors.sand, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1, minWidth: 0 },
  phone: { fontSize: 17, lineHeight: 24 },
  code: { marginTop: 32 },
  error: { marginTop: 12 },
  resend: { marginTop: 20, minHeight: 44, justifyContent: 'center' },
  tabular: { fontVariant: ['tabular-nums'] },
  center: { alignSelf: 'center' },
  verify: { marginTop: 24 },
  divider: { marginTop: 32 },
  instead: { marginTop: 20 },
  later: { marginTop: 16 },
});
