import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LocateFixed, MapPin, User } from 'lucide-react';
import AuthLayout from '@/components/layout/AuthLayout.jsx';
import { Button, FieldWrapper, PhoneField, SegmentedControl, Spinner, TextField, WhatsAppIcon } from '@/components/ui';
import { useAuth } from '@/context/AuthContext.jsx';
import { ROUTES } from '@/config/routes.js';
import { GENDERS } from '@/config/options.js';
import { CURRENT_LOCATION, parseAddressText, validateAddressLine, validateMobile, validateName } from '@/domain';
import { useDocumentTitle } from '@/hooks';

/** 03 · Sign up */
export default function SignUpPage() {
  useDocumentTitle('Create your account');
  const navigate = useNavigate();
  const { requestOtp, getPendingOtp } = useAuth();
  // "Edit number" on the OTP screen comes back here with the form intact
  const pending = getPendingOtp();
  const prior = pending?.purpose === 'signup' ? pending.payload : null;

  const [name, setName] = useState(prior?.name || '');
  const [phone, setPhone] = useState(pending?.purpose === 'signup' ? pending.phone : '');
  const [gender, setGender] = useState(prior?.gender || '');
  const [addressText, setAddressText] = useState(prior?.addressText || '');
  const [located, setLocated] = useState(prior?.address?.location ? prior.address : null);
  const [locating, setLocating] = useState(false);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const useCurrentLocation = async () => {
    setLocating(true);
    await new Promise((r) => setTimeout(r, 900));
    setLocated(CURRENT_LOCATION);
    setAddressText(`${CURRENT_LOCATION.line}, ${CURRENT_LOCATION.district}`);
    setErrors((e) => ({ ...e, address: '' }));
    setLocating(false);
  };

  const submit = async (e) => {
    e.preventDefault();
    const next = {
      name: validateName(name),
      phone: validateMobile(phone),
      gender: gender ? '' : 'Choose an option',
      address: validateAddressLine(addressText),
    };
    setErrors(next);
    if (Object.values(next).some(Boolean)) return;

    const typed = `${located?.line}, ${located?.district}` !== addressText;
    const address = typed || !located ? parseAddressText(addressText) : located;
    setSubmitting(true);
    try {
      await requestOtp(phone, 'signup', { name, gender, address, addressText });
      navigate(ROUTES.verify);
    } catch (err) {
      setErrors({ [err.field || 'form']: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout title="Create your account" subtitle="Join kuraat in under a minute" backFallback={ROUTES.welcome}>
      <form noValidate onSubmit={submit} className="flex flex-col gap-5">
        <TextField
          label="Full name"
          icon={User}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your full name"
          autoComplete="name"
          error={errors.name}
        />
        <PhoneField
          value={phone}
          onChange={setPhone}
          error={errors.phone}
          helper={
            <span className="flex items-center gap-2">
              <WhatsAppIcon size={16} className="text-muted" />
              We will send a 6-digit code on WhatsApp
            </span>
          }
        />
        <FieldWrapper id="gender" label="Gender" error={errors.gender}>
          <SegmentedControl
            label="Gender"
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
            label="Delivery address"
            icon={MapPin}
            value={addressText}
            onChange={(e) => setAddressText(e.target.value)}
            placeholder="Building, street, district"
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
            {locating ? 'Finding your location…' : 'Use my current location'}
          </button>
        </div>

        {errors.form && <p className="text-label text-hotpink">{errors.form}</p>}

        <Button type="submit" block loading={submitting} leftIcon={WhatsAppIcon} className="mt-2">
          Continue with WhatsApp
        </Button>
        <p className="text-center text-body text-muted">
          Already have an account?{' '}
          <Link to={ROUTES.signIn} className="font-bold text-maroon hover:underline">
            Sign in
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}
