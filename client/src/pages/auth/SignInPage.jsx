import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import AuthLayout from '@/components/layout/AuthLayout.jsx';
import { Button, PasswordField, PhoneField, SegmentedControl, TextDivider, WhatsAppIcon } from '@/components/ui';
import { useAuth } from '@/context/AuthContext.jsx';
import { useCart } from '@/context/CartContext.jsx';
import { useToast } from '@/context/ToastContext.jsx';
import { ROUTES } from '@/config/routes.js';
import { firstName, validateMobile } from '@/domain';
import { useDocumentTitle } from '@/hooks';
import { t, localized } from '@/i18n';

const TABS = localized([
  { value: 'password', label: 'Password' },
  { value: 'whatsapp', label: 'WhatsApp code' },
]);

/** 06 · Sign in */
export default function SignInPage() {
  useDocumentTitle(t('Sign in'));
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const { signInWithPassword, requestOtp, getPendingOtp } = useAuth();
  const { reload: reloadCart } = useCart();
  const pending = getPendingOtp();
  const [tab, setTab] = useState('password');
  const [phone, setPhone] = useState(pending && pending.purpose !== 'signup' ? pending.phone : '');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(null); // 'password' | 'otp' | 'reset'

  const redirectTo = location.state?.from || ROUTES.home;

  const sendCode = async (purpose) => {
    const phoneError = validateMobile(phone);
    if (phoneError) {
      setErrors({ phone: purpose === 'reset' && !phone ? t('Enter your mobile number to reset your password') : phoneError });
      return;
    }
    setBusy(purpose === 'reset' ? 'reset' : 'otp');
    setErrors({});
    try {
      await requestOtp(phone, purpose);
      navigate(ROUTES.verify);
    } catch (err) {
      setErrors({ [err.field || 'form']: err.message });
      setBusy(null);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    if (tab === 'whatsapp') {
      sendCode('signin');
      return;
    }
    const next = { phone: validateMobile(phone), password: password ? '' : t('Enter your password') };
    setErrors(next);
    if (next.phone || next.password) return;
    setBusy('password');
    try {
      const user = await signInWithPassword(phone, password);
      reloadCart();
      toast.show(t('Welcome back, {name}', { name: firstName(user.name) }));
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setErrors({ [err.field || 'form']: err.message });
      setBusy(null);
    }
  };

  return (
    <AuthLayout title={<>{t('Hello,')}<br />{t('welcome back')}</>} subtitle={t('Sign in to order your favourites')} backFallback={ROUTES.welcome}>
      <SegmentedControl label={t('Sign-in method')} options={TABS} value={tab} onChange={(v) => { setTab(v); setErrors({}); }} />
      <form noValidate onSubmit={submit} className="mt-5 flex flex-col">
        <PhoneField value={phone} onChange={setPhone} error={errors.phone} autoFocus />
        {tab === 'password' ? (
          <>
            <PasswordField
              className="mt-5"
              label={t('Password')}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              placeholder={t('Your password')}
              error={errors.password}
            />
            <button
              type="button"
              onClick={() => sendCode('reset')}
              disabled={Boolean(busy)}
              className="mt-3 self-end text-[15px] font-semibold text-maroon hover:underline disabled:opacity-60"
            >
              {busy === 'reset' ? t('Sending code…') : t('Forgot password?')}
            </button>
          </>
        ) : (
          <p className="mt-3 text-label font-normal text-muted">{t('We will send a 6-digit code to this number on WhatsApp.')}</p>
        )}
        {errors.form && <p className="mt-3 text-label text-hotpink">{errors.form}</p>}

        <Button
          type="submit"
          block
          className="mt-6"
          loading={busy === 'password' || (tab === 'whatsapp' && busy === 'otp')}
          leftIcon={tab === 'whatsapp' ? WhatsAppIcon : undefined}
        >
          {tab === 'password' ? t('Sign in') : t('Send code on WhatsApp')}
        </Button>
      </form>

      {tab === 'password' && (
        <>
          <TextDivider className="mt-7">{t('or')}</TextDivider>
          <Button
            variant="secondary"
            block
            className="mt-6"
            leftIcon={WhatsAppIcon}
            loading={busy === 'otp'}
            disabled={Boolean(busy) && busy !== 'otp'}
            onClick={() => sendCode('signin')}
          >{t('Get a code on WhatsApp')}</Button>
        </>
      )}
      <p className="mt-6 text-center text-body text-muted">{t('New to kuraat?')}{' '}<Link to={ROUTES.signUp} className="font-bold text-maroon hover:underline">{t('Sign up')}</Link>
      </p>
    </AuthLayout>
  );
}
