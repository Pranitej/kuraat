import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LocateFixed, MapPin, User } from 'lucide-react';
import AuthLayout from '@/components/layout/AuthLayout.jsx';
import { Button, FieldWrapper, PhoneField, SegmentedControl, Spinner, TextField, WhatsAppIcon } from '@/components/ui';
import { useAuth } from '@/context/AuthContext.jsx';
import { ROUTES } from '@/config/routes.js';
import { GENDERS } from '@/config/options.js';
import { LOCATION_FAILED, LOCATION_OUTSIDE, isInSaudi, parseAddressText, validateAddressLine, validateMobile, validateName } from '@/domain';
import { getBrowserPosition } from '@/lib/geolocation.js';
import { useDocumentTitle } from '@/hooks';
import { t } from '@/i18n';

/** 03 · Sign up */
export default function SignUpPage() {
  useDocumentTitle(t('Create your account'));
  const navigate = useNavigate();
  const { requestOtp, getPendingOtp } = useAuth();
  // "Edit number" on the OTP screen comes back here with the form intact
  const pending = getPendingOtp();
  const prior = pending?.purpose === 'signup' ? pending.payload : null;

  const [name, setName] = useState(prior?.name || '');
  const [phone, setPhone] = useState(pending?.purpose === 'signup' ? pending.phone : '');
  const [gender, setGender] = useState(prior?.gender || '');
  const [addressText, setAddressText] = useState(prior?.addressText || '');
  // The pin from "Use my current location" (the device's real position); the address itself is typed.
  const [located, setLocated] = useState(prior?.address?.location ? { location: prior.address.location } : null);
  const [locating, setLocating] = useState(false);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const useCurrentLocation = async () => {
    setLocating(true);
    const position = await getBrowserPosition({ precise: true });
    setLocating(false);
    if (!position || !isInSaudi(position)) {
      setErrors((e) => ({ ...e, address: t(position ? LOCATION_OUTSIDE : LOCATION_FAILED) }));
      return;
    }
    setLocated({ location: position });
    setErrors((e) => ({ ...e, address: '' }));
  };

  // A new customer has no address yet: ask for the device location once when the form opens, as other apps do.
  // Refusing is fine (the location is optional); "Use my current location" stays for a later try.
  const asked = useRef(false);
  useEffect(() => {
    if (asked.current || located) return;
    asked.current = true;
    (async () => {
      setLocating(true);
      const position = await getBrowserPosition({ precise: true });
      setLocating(false);
      if (isInSaudi(position)) setLocated({ location: position }); // outside Saudi Arabia: not attached, sign-up still works
    })();
  }, [located]);

  const submit = async (e) => {
    e.preventDefault();
    const next = {
      name: validateName(name),
      phone: validateMobile(phone),
      gender: gender ? '' : t('Choose an option'),
      address: validateAddressLine(addressText),
    };
    setErrors(next);
    if (Object.values(next).some(Boolean)) return;

    const address = { ...parseAddressText(addressText), ...(located?.location ? { location: located.location } : {}) };
    setSubmitting(true);
    try {
      await requestOtp(phone, 'signup', { name, gender, address, addressText });
      navigate(ROUTES.verify);
    } catch (err) {
      // A server error must always show somewhere: the form displays only these fields, the rest go in the form message.
      const field = String(err.field || '').replace(/^payload\./, '');
      const key = ['name', 'phone', 'gender'].includes(field) ? field : field.startsWith('address') ? 'address' : 'form';
      setErrors({ [key]: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout title={t('Create your account')} subtitle={t('Join kuraat in under a minute')} backFallback={ROUTES.welcome}>
      <form noValidate onSubmit={submit} className="flex flex-col gap-5">
        <TextField
          label={t('Full name')}
          icon={User}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('Your full name')}
          autoComplete="name"
          error={errors.name}
        />
        <PhoneField
          value={phone}
          onChange={setPhone}
          error={errors.phone}
          helper={
            <span className="flex items-center gap-2">
              <WhatsAppIcon size={16} className="text-muted" />{t('We will send a 6-digit code on WhatsApp')}</span>
          }
        />
        <FieldWrapper id="gender" label={t('Gender')} error={errors.gender}>
          <SegmentedControl
            label={t('Gender')}
            options={GENDERS}
            value={gender}
            onChange={(v) => {
              setGender(v);
              setErrors((x) => ({ ...x, gender: '' }));
            }}
          />
        </FieldWrapper>
        <div>
          <TextField
            label={t('Delivery address')}
            icon={MapPin}
            value={addressText}
            onChange={(e) => setAddressText(e.target.value)}
            placeholder={t('Building, street, district')}
            autoComplete="street-address"
            error={errors.address}
          />
          <button
            type="button"
            onClick={useCurrentLocation}
            disabled={locating}
            className="mt-3 inline-flex items-center gap-2 text-[15px] font-semibold text-maroon hover:underline disabled:opacity-70"
          >
            {locating ? <Spinner size={18} /> : <LocateFixed size={18} strokeWidth={1.8} />}
            {locating ? t('Finding your location…') : located ? t('Location saved · tap to update') : t('Use my current location')}
          </button>
          {located && <p className="mt-1.5 text-label font-normal text-muted">{addressText.trim() ? t('Location saved.') : t('Location saved. Now type your building, street and district.')}</p>}
        </div>

        {errors.form && <p className="text-label text-hotpink">{errors.form}</p>}

        <Button type="submit" block loading={submitting} leftIcon={WhatsAppIcon} className="mt-2">{t('Continue with WhatsApp')}</Button>
        <p className="text-center text-body text-muted">{t('Already have an account?')}{' '}<Link to={ROUTES.signIn} className="font-bold text-maroon hover:underline">{t('Sign in')}</Link>
        </p>
      </form>
    </AuthLayout>
  );
}
