import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Info } from 'lucide-react';
import ScreenHeader from '@/components/layout/ScreenHeader.jsx';
import BottomBar from '@/components/layout/BottomBar.jsx';
import { Button, InfoBanner, PasswordField, StrengthMeter } from '@/components/ui';
import { useAuth } from '@/context/AuthContext.jsx';
import { useToast } from '@/context/ToastContext.jsx';
import { evaluatePassword } from '@/domain';
import { ROUTES } from '@/config/routes.js';
import { useDocumentTitle } from '@/hooks';

/** 19 · Password — set the first password or change it. */
export default function PasswordPage() {
  useDocumentTitle('Password');
  const navigate = useNavigate();
  const toast = useToast();
  const { user, changePassword, requestOtp } = useAuth();
  const hasPassword = user.hasPassword;
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const evaluation = useMemo(() => evaluatePassword(next), [next]);

  const submit = async (e) => {
    e?.preventDefault();
    const errs = {
      currentPassword: hasPassword && !current ? 'Enter your current password' : '',
      newPassword: !next ? 'Create a new password' : evaluation.acceptable ? '' : 'Use at least 8 characters with upper and lower case letters and a number',
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
      navigate(ROUTES.profile);
    } catch (err) {
      setErrors({ [err.field || 'form']: err.message });
    } finally {
      setSaving(false);
    }
  };

  const forgot = async () => {
    setSending(true);
    try {
      await requestOtp(user.phone, 'reset');
      navigate(ROUTES.verify);
    } catch (err) {
      setErrors({ form: err.message });
      setSending(false);
    }
  };

  return (
    <div className="pb-6">
      <div className="mx-auto max-w-column lg:max-w-[640px]">
        <ScreenHeader title="Password" backFallback={ROUTES.profile} />
        <form noValidate onSubmit={submit} className="px-5 lg:px-0">
          <InfoBanner icon={Info}>
            Signed up with a WhatsApp code? <strong className="font-bold text-ink">Set a password</strong> to sign in without one. No current password is needed
            the first time.
          </InfoBanner>

          <div className="mt-5 flex flex-col gap-5">
            {hasPassword && (
              <PasswordField
                label="Current password"
                value={current}
                onChange={(e) => {
                  setCurrent(e.target.value);
                  setErrors((x) => ({ ...x, currentPassword: '' }));
                }}
                autoComplete="current-password"
                placeholder="Your current password"
                error={errors.currentPassword}
              />
            )}
            <div>
              <PasswordField
                label="New password"
                value={next}
                onChange={(e) => {
                  setNext(e.target.value);
                  setErrors((x) => ({ ...x, newPassword: '' }));
                }}
                autoComplete="new-password"
                placeholder="Create a new password"
                error={errors.newPassword}
              />
              {next && <StrengthMeter evaluation={evaluation} />}
            </div>
            <PasswordField
              label="Confirm new password"
              value={confirm}
              onChange={(e) => {
                setConfirm(e.target.value);
                setErrors((x) => ({ ...x, confirm: '' }));
              }}
              autoComplete="new-password"
              placeholder="Repeat your new password"
              error={errors.confirm}
            />
          </div>

          {errors.form && <p className="mt-4 text-label text-hotpink">{errors.form}</p>}

          {hasPassword && (
            <p className="mt-6 text-center">
              <button type="button" onClick={forgot} disabled={sending} className="text-[15px] font-semibold text-maroon hover:underline disabled:opacity-60">
                {sending ? 'Sending code…' : 'Forgot your current password? Get a WhatsApp code'}
              </button>
            </p>
          )}

          <BottomBar>
            <Button type="submit" block loading={saving}>
              {hasPassword ? 'Update password' : 'Set password'}
            </Button>
          </BottomBar>
        </form>
      </div>
    </div>
  );
}
