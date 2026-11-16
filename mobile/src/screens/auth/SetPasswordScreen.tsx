import { Redirect, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { AuthLayout } from '@/components/layout';
import { Button, PasswordField, PasswordRules, StrengthMeter, Text, type PasswordEvaluation } from '@/components/ui';
import { ROUTES } from '@/lib/routes';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { evaluatePassword, firstName } from '@/domain';

type Errors = Partial<Record<'password' | 'confirm' | 'form', string>>;

/** 05 · Set your password — sign-up without OTP ("Set a password instead") or reset after OTP. */
export default function SetPasswordScreen() {
  const router = useRouter();
  const toast = useToast();
  const { getPendingOtp, completeSignupWithPassword, resetPasswordWithOtp, user } = useAuth();
  const [pending] = useState(() => getPendingOtp());
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);
  const evaluation = useMemo(() => evaluatePassword(password) as PasswordEvaluation & { acceptable: boolean }, [password]);

  const mode = pending?.purpose === 'signup' ? 'signup' : pending?.purpose === 'reset' && pending.verified ? 'reset' : null;
  if (!mode) return <Redirect href={user ? ROUTES.home : ROUTES.welcome} />;

  const submit = async () => {
    const next: Errors = {
      password: !password
        ? 'Create a password'
        : evaluation.acceptable
          ? ''
          : 'Use at least 8 characters with upper and lower case letters and a number',
      confirm: !confirm ? 'Confirm your password' : confirm !== password ? 'Passwords do not match' : '',
    };
    setErrors(next);
    if (next.password || next.confirm) return;
    setSaving(true);
    try {
      const signedIn = mode === 'signup' ? await completeSignupWithPassword(password) : await resetPasswordWithOtp(password);
      toast.show(mode === 'signup' ? `Welcome to kuraat, ${firstName(signedIn.name)}` : 'Your password has been reset');
      router.replace(ROUTES.home);
    } catch (err) {
      setErrors({ form: (err as Error).message });
      setSaving(false);
    }
  };

  return (
    <AuthLayout title="Set your password" backFallback={ROUTES.verify}>
      <View>
        <PasswordField
          label="New password"
          value={password}
          onChangeText={setPassword}
          autoComplete="new-password"
          textContentType="newPassword"
          placeholder="Create a password"
          autoFocus
          error={errors.password}
        />
        {password ? <StrengthMeter evaluation={evaluation} /> : null}
      </View>
      <PasswordField
        label="Confirm password"
        value={confirm}
        onChangeText={setConfirm}
        autoComplete="new-password"
        textContentType="newPassword"
        placeholder="Repeat your password"
        error={errors.confirm}
        returnKeyType="done"
        onSubmitEditing={submit}
        style={styles.confirm}
      />
      <PasswordRules evaluation={evaluation} style={styles.rules} />
      {errors.form ? (
        <Text variant="label" color="hotpink" style={styles.formError}>
          {errors.form}
        </Text>
      ) : null}
      <Button block loading={saving} onPress={submit} style={styles.submit}>
        {mode === 'signup' ? 'Create account' : 'Save password'}
      </Button>
      <Text color="muted" align="center" style={styles.note}>
        Your password lets you sign in without a WhatsApp code.
      </Text>
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  confirm: { marginTop: 20 },
  rules: { marginTop: 20 },
  formError: { marginTop: 16 },
  submit: { marginTop: 32 },
  note: { marginTop: 16 },
});
