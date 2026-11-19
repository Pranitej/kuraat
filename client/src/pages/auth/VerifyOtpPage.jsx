import { useCallback, useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { KeyRound } from 'lucide-react';
import AuthLayout from '@/components/layout/AuthLayout.jsx';
import { Button, OtpInput, TextDivider, WhatsAppIcon } from '@/components/ui';
import { useAuth } from '@/context/AuthContext.jsx';
import { useCart } from '@/context/CartContext.jsx';
import { useToast } from '@/context/ToastContext.jsx';
import { ROUTES } from '@/config/routes.js';
import { formatPhone, firstName } from '@/domain';
import { OTP_RESEND_SECONDS } from '@/services/authService.js';
import { useCountdown, useDocumentTitle } from '@/hooks';
import { t } from '@/i18n';

const ORIGIN = { signup: ROUTES.signUp, signin: ROUTES.signIn, reset: ROUTES.signIn, 'delete-account': ROUTES.account };

/** 04 · WhatsApp OTP — "Verify your number" */
export default function VerifyOtpPage() {
  useDocumentTitle(t('Verify your number'));
  const navigate = useNavigate();
  const toast = useToast();
  const { getPendingOtp, verifyOtp, resendOtp, updateProfile, deleteAccount, user } = useAuth();
  const { reload: reloadCart } = useCart();
  const [pending, setPending] = useState(() => getPendingOtp());
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const secondsLeft = useCountdown(pending ? pending.sentAt + OTP_RESEND_SECONDS * 1000 : 0);

  const verify = useCallback(
    async (value = code) => {
      if (verifying) return;
      if (value.length !== 6) {
        setError(t('Enter the 6-digit code.'));
        return;
      }
      setVerifying(true);
      setError('');
      try {
        const result = await verifyOtp(value);
        if (result.next === 'home') {
          reloadCart();
          toast.show(pending.purpose === 'signup' ? t('Welcome to kuraat, {name}', { name: firstName(result.user.name) }) : t('Welcome back, {name}', { name: firstName(result.user.name) }));
          navigate(ROUTES.home, { replace: true });
        } else if (result.next === 'set-password') {
          navigate(ROUTES.setPassword, { replace: true });
        } else if (result.next === 'account') {
          await updateProfile({ phone: pending.phone });
          toast.show(t('Your mobile number has been updated'));
          navigate(ROUTES.account, { replace: true });
        } else if (result.next === 'delete-account') {
          await deleteAccount();
          toast.show(t('Your account has been deleted'));
          navigate(ROUTES.welcome, { replace: true });
        }
      } catch (err) {
        setError(err.message);
        setCode('');
        setVerifying(false);
      }
    },
    [code, verifying, verifyOtp, pending, navigate, toast, updateProfile, deleteAccount, reloadCart],
  );

  // Signed-in users coming from sign-in are redirected home by the verify flow; nothing else to guard.
  useEffect(() => {
    setPending(getPendingOtp());
  }, [getPendingOtp]);

  if (!pending) return <Navigate to={user ? ROUTES.home : ROUTES.welcome} replace />;

  const resend = async () => {
    setResending(true);
    try {
      const next = await resendOtp();
      setPending(next);
      setCode('');
      setError('');
      toast.show(t('A new code was sent to {phone}', { phone: formatPhone(pending.phone) }));
    } catch (err) {
      setError(err.message);
    } finally {
      setResending(false);
    }
  };

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
  const ss = String(secondsLeft % 60).padStart(2, '0');

  return (
    <AuthLayout title={t('Verify your number')} subtitle={t('Enter the 6-digit code')} backFallback={ORIGIN[pending.purpose]}>
      <div className="flex items-center gap-4">
        <span className="grid size-[60px] shrink-0 place-items-center rounded-full bg-sand text-maroon">
          <WhatsAppIcon size={26} />
        </span>
        <div className="min-w-0">
          <p className="text-body text-muted">{t('Code sent on WhatsApp to')}</p>
          <p className="text-[17px] font-bold leading-6 text-ink">{formatPhone(pending.phone)}</p>
          <button
            type="button"
            onClick={() => navigate(ORIGIN[pending.purpose], { replace: true })}
            className="text-label font-bold text-maroon hover:underline"
          >{t('Edit number')}</button>
        </div>
      </div>

      <form
        noValidate
        className="mt-8"
        onSubmit={(e) => {
          e.preventDefault();
          verify();
        }}
      >
        <OtpInput
          value={code}
          onChange={(v) => {
            setCode(v);
            if (error) setError('');
          }}
          onComplete={(v) => verify(v)}
          error={error}
          disabled={verifying}
        />
        {error && (
          <p role="alert" className="mt-3 text-center text-label text-hotpink">
            {error}
          </p>
        )}
        <p className="mt-5 text-center text-body text-muted" aria-live="polite">
          {secondsLeft > 0 ? (
            <>{t('Resend code in')}{' '}<span className="tabular font-bold text-ink">{`${mm}:${ss}`}</span>
            </>
          ) : (
            <button type="button" onClick={resend} disabled={resending} className="font-bold text-maroon hover:underline disabled:opacity-60">
              {resending ? t('Sending…') : t('Resend code')}
            </button>
          )}
        </p>

        <Button type="submit" block loading={verifying} disabled={code.length !== 6 && !verifying} className="mt-6">{t('Verify & continue')}</Button>
      </form>

      {pending.purpose === 'signup' && (
        <>
          <TextDivider className="mt-8">{t('Did not get the code on WhatsApp?')}</TextDivider>
          <Button variant="secondary" block leftIcon={KeyRound} className="mt-5" to={ROUTES.setPassword}>{t('Set a password instead')}</Button>
          <p className="mt-4 text-center text-body text-muted">{t('You can still sign in with a WhatsApp code later.')}</p>
        </>
      )}
    </AuthLayout>
  );
}
