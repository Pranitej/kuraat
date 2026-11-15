import { useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import AuthLayout from '@/components/layout/AuthLayout.jsx';
import { Button, PasswordField, PasswordRules, StrengthMeter } from '@/components/ui';
import { useAuth } from '@/context/AuthContext.jsx';
import { useCart } from '@/context/CartContext.jsx';
import { useToast } from '@/context/ToastContext.jsx';
import { ROUTES } from '@/config/routes.js';
import { evaluatePassword, firstName } from '@/domain';
import { useDocumentTitle } from '@/hooks';

/** 05 · Set your password — sign-up without OTP ("Set a password instead") or reset after OTP. */
export default function SetPasswordPage() {
  useDocumentTitle('Set your password');
  const navigate = useNavigate();
  const toast = useToast();
  const { getPendingOtp, completeSignupWithPassword, resetPasswordWithOtp, user } = useAuth();
  const { reload: reloadCart } = useCart();
  const [pending] = useState(() => getPendingOtp());
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const evaluation = useMemo(() => evaluatePassword(password), [password]);

  const mode = pending?.purpose === 'signup' ? 'signup' : pending?.purpose === 'reset' && pending.verified ? 'reset' : null;
  if (!mode) return <Navigate to={user ? ROUTES.home : ROUTES.welcome} replace />;

  const submit = async (e) => {
    e.preventDefault();
    const next = {
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
      reloadCart();
      toast.show(mode === 'signup' ? `Welcome to kuraat, ${firstName(signedIn.name)}` : 'Your password has been reset');
      navigate(ROUTES.home, { replace: true });
    } catch (err) {
      setErrors({ form: err.message });
      setSaving(false);
    }
  };

  return (
    <AuthLayout title="Set your password" subtitle="Used when WhatsApp codes do not arrive" backFallback={ROUTES.verify}>
      <form noValidate onSubmit={submit} className="flex flex-col">
        <div>
          <PasswordField
            label="New password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            placeholder="Create a password"
            autoFocus
            error={errors.password}
          />
          {password && <StrengthMeter evaluation={evaluation} />}
        </div>
        <PasswordField
          className="mt-5"
          label="Confirm password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="new-password"
          placeholder="Repeat your password"
          error={errors.confirm}
        />
        <PasswordRules evaluation={evaluation} className="mt-5" />
        {errors.form && <p className="mt-4 text-label text-hotpink">{errors.form}</p>}
        <Button type="submit" block loading={saving} className="mt-8">
          {mode === 'signup' ? 'Create account' : 'Save password'}
        </Button>
        <p className="mt-4 text-center text-body text-muted">Your password lets you sign in without a WhatsApp code.</p>
      </form>
    </AuthLayout>
  );
}
