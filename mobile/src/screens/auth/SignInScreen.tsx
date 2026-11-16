import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { AuthLayout } from '@/components/layout';
import { Button, LeadLink, PasswordField, PhoneField, Segmented, Text, TextDivider, TextLink, WhatsAppIcon } from '@/components/ui';
import { ROUTES } from '@/lib/routes';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { firstName, validateMobile } from '@/domain';

type Tab = 'password' | 'whatsapp';
const TABS: { value: Tab; label: string }[] = [
  { value: 'password', label: 'Password' },
  { value: 'whatsapp', label: 'WhatsApp code' },
];
type Errors = Partial<Record<'phone' | 'password' | 'form', string>>;

/** 06 · Sign in */
export default function SignInScreen() {
  const router = useRouter();
  const toast = useToast();
  const { signInWithPassword, requestOtp, getPendingOtp } = useAuth();
  const [pending] = useState(() => getPendingOtp());
  const [tab, setTab] = useState<Tab>('password');
  const [phone, setPhone] = useState(pending && pending.purpose !== 'signup' ? pending.phone : '');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState<'password' | 'otp' | 'reset' | null>(null);

  const fail = (err: unknown) => {
    const e = err as { field?: string; message: string };
    setErrors({ [e.field || 'form']: e.message });
    setBusy(null);
  };

  const sendCode = async (purpose: 'signin' | 'reset') => {
    const phoneError = validateMobile(phone);
    if (phoneError) {
      setErrors({ phone: purpose === 'reset' && !phone ? 'Enter your mobile number to reset your password' : phoneError });
      return;
    }
    setBusy(purpose === 'reset' ? 'reset' : 'otp');
    setErrors({});
    try {
      await requestOtp(phone, purpose);
      setBusy(null);
      router.push(ROUTES.verify);
    } catch (err) {
      fail(err);
    }
  };

  const submit = async () => {
    if (tab === 'whatsapp') {
      sendCode('signin');
      return;
    }
    const next: Errors = { phone: validateMobile(phone), password: password ? '' : 'Enter your password' };
    setErrors(next);
    if (next.phone || next.password) return;
    setBusy('password');
    try {
      const user = await signInWithPassword(phone, password);
      toast.show(`Welcome back, ${firstName(user.name)}`);
      router.replace(ROUTES.home);
    } catch (err) {
      fail(err);
    }
  };

  return (
    <AuthLayout title={'Hello,\nwelcome back'} backFallback={ROUTES.welcome}>
      <Segmented
        label="Sign-in method"
        options={TABS}
        value={tab}
        onChange={(v) => {
          setTab(v);
          setErrors({});
        }}
      />
      <View style={styles.form}>
        <PhoneField value={phone} onChange={setPhone} error={errors.phone} />
        {tab === 'password' ? (
          <>
            <PasswordField
              label="Password"
              value={password}
              onChangeText={setPassword}
              autoComplete="current-password"
              textContentType="password"
              placeholder="Your password"
              error={errors.password}
              returnKeyType="go"
              onSubmitEditing={submit}
              style={styles.password}
            />
            <View style={styles.forgot}>
              <TextLink weight={600} onPress={() => sendCode('reset')} disabled={Boolean(busy)}>
                {busy === 'reset' ? 'Sending code…' : 'Forgot password?'}
              </TextLink>
            </View>
          </>
        ) : (
          <Text variant="label" weight={400} color="muted" style={styles.hint}>
            We will send a 6-digit code to this number on WhatsApp.
          </Text>
        )}
        {errors.form ? (
          <Text variant="label" color="hotpink" style={styles.hint}>
            {errors.form}
          </Text>
        ) : null}

        <Button
          block
          onPress={submit}
          loading={busy === 'password' || (tab === 'whatsapp' && busy === 'otp')}
          leftIcon={tab === 'whatsapp' ? WhatsAppIcon : undefined}
          style={styles.submit}
        >
          {tab === 'password' ? 'Sign in' : 'Send code on WhatsApp'}
        </Button>
      </View>

      {tab === 'password' ? (
        <>
          <TextDivider style={styles.or}>or</TextDivider>
          <Button
            variant="secondary"
            block
            leftIcon={WhatsAppIcon}
            loading={busy === 'otp'}
            disabled={Boolean(busy) && busy !== 'otp'}
            onPress={() => sendCode('signin')}
            style={styles.otp}
          >
            Get a code on WhatsApp
          </Button>
        </>
      ) : null}
      <LeadLink lead="New to kuraat?" link="Sign up" onPress={() => router.replace(ROUTES.signUp)} style={styles.signup} />
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  form: { marginTop: 20 },
  password: { marginTop: 20 },
  forgot: { marginTop: 12, alignSelf: 'flex-end' },
  hint: { marginTop: 12 },
  submit: { marginTop: 24 },
  or: { marginTop: 28 },
  otp: { marginTop: 24 },
  signup: { marginTop: 24 },
});
