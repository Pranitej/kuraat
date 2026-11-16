import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { BottomBar, Screen, ScreenHeader } from '@/components/layout';
import { Info } from '@/components/icons';
import { Button, InfoBanner, PasswordField, StrengthMeter, Text, TextLink, type PasswordEvaluation } from '@/components/ui';
import { ROUTES } from '@/lib/routes';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { evaluatePassword } from '@/domain';
import type { User } from '@/types/api';

type Errors = Partial<Record<'currentPassword' | 'newPassword' | 'confirm' | 'form', string>>;

/** 19 · Password — set the first password or change it. */
export default function PasswordScreen() {
  const router = useRouter();
  const toast = useToast();
  const { user, changePassword, requestOtp } = useAuth();
  const u = user as User;
  const hasPassword = u.hasPassword;
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const evaluation = useMemo(() => evaluatePassword(next) as PasswordEvaluation & { acceptable: boolean }, [next]);

  const submit = async () => {
    const errs: Errors = {
      currentPassword: hasPassword && !current ? 'Enter your current password' : '',
      newPassword: !next
        ? 'Create a new password'
        : evaluation.acceptable
          ? ''
          : 'Use at least 8 characters with upper and lower case letters and a number',
      confirm: !confirm ? 'Confirm your new password' : confirm !== next ? 'Passwords do not match' : '',
    };
    setErrors(errs);
    if (Object.values(errs).some(Boolean)) return;
    setSaving(true);
    try {
      await changePassword({ currentPassword: current, newPassword: next });
      toast.show(hasPassword ? 'Your password has been updated' : 'Your password has been set');
      setCurrent('');
      setNext('');
      setConfirm('');
      if (router.canGoBack()) router.back();
      else router.replace(ROUTES.profile);
    } catch (err) {
      const e = err as { field?: string; message: string };
      setErrors({ [e.field || 'form']: e.message });
    } finally {
      setSaving(false);
    }
  };

  const forgot = async () => {
    setSending(true);
    try {
      await requestOtp(u.phone, 'reset');
      router.push(ROUTES.verify);
    } catch (err) {
      setErrors({ form: (err as Error).message });
    } finally {
      setSending(false);
    }
  };

  return (
    <Screen
      header={<ScreenHeader title="Password" backFallback={ROUTES.profile} />}
      keyboard
      bottomBar={
        <BottomBar>
          <Button block loading={saving} onPress={submit}>
            {hasPassword ? 'Update password' : 'Set password'}
          </Button>
        </BottomBar>
      }
    >
      <InfoBanner icon={Info}>
        <Text color="copy" style={styles.banner}>
          Signed up with a WhatsApp code? <Text weight={700}>Set a password</Text> to sign in without one. No current password is needed the
          first time.
        </Text>
      </InfoBanner>

      <View style={styles.fields}>
        {hasPassword ? (
          <PasswordField
            label="Current password"
            value={current}
            onChangeText={(t) => {
              setCurrent(t);
              setErrors((x) => ({ ...x, currentPassword: '' }));
            }}
            autoComplete="current-password"
            textContentType="password"
            placeholder="Your current password"
            error={errors.currentPassword}
          />
        ) : null}
        <View>
          <PasswordField
            label="New password"
            value={next}
            onChangeText={(t) => {
              setNext(t);
              setErrors((x) => ({ ...x, newPassword: '' }));
            }}
            autoComplete="new-password"
            textContentType="newPassword"
            placeholder="Create a new password"
            error={errors.newPassword}
          />
          {next ? <StrengthMeter evaluation={evaluation} /> : null}
        </View>
        <PasswordField
          label="Confirm new password"
          value={confirm}
          onChangeText={(t) => {
            setConfirm(t);
            setErrors((x) => ({ ...x, confirm: '' }));
          }}
          autoComplete="new-password"
          textContentType="newPassword"
          placeholder="Repeat your new password"
          error={errors.confirm}
          returnKeyType="done"
          onSubmitEditing={submit}
        />
      </View>

      {errors.form ? (
        <Text variant="label" color="hotpink" style={styles.formError} accessibilityRole="alert">
          {errors.form}
        </Text>
      ) : null}

      {hasPassword ? (
        <View style={styles.forgot}>
          <TextLink weight={600} onPress={forgot} disabled={sending} style={styles.forgotText}>
            {sending ? 'Sending code…' : 'Forgot your current password? Get a WhatsApp code'}
          </TextLink>
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  banner: { fontSize: 15, lineHeight: 22 },
  fields: { marginTop: 20, gap: 20 },
  formError: { marginTop: 16 },
  forgot: { marginTop: 24, alignItems: 'center' },
  forgotText: { textAlign: 'center' },
});
