import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { AuthLayout } from '@/components/layout';
import { LocateFixed, MapPin, User } from '@/components/icons';
import { Button, Field, FieldWrapper, LeadLink, PhoneField, Segmented, Spinner, Text, WhatsAppIcon } from '@/components/ui';
import { GENDERS } from '@/config/options.js';
import { ROUTES } from '@/lib/routes';
import { useAuth } from '@/context/AuthContext';
import { CURRENT_LOCATION, parseAddressText, validateAddressLine, validateMobile, validateName } from '@/domain';
import { colors } from '@/theme/theme';
import type { Gender } from '@/types/api';

type Errors = Partial<Record<'name' | 'phone' | 'gender' | 'address' | 'form', string>>;
type SignupForm = { name: string; gender: Gender; address: { line: string; district: string; location?: unknown }; addressText: string };

/** 03 · Sign up */
export default function SignUpScreen() {
  const router = useRouter();
  const { requestOtp, getPendingOtp } = useAuth();
  // "Edit number" on the OTP screen comes back here with the form intact
  const [pending] = useState(() => getPendingOtp());
  const prior = pending?.purpose === 'signup' ? (pending.payload as SignupForm | null) : null;

  const [name, setName] = useState(prior?.name || '');
  const [phone, setPhone] = useState(pending?.purpose === 'signup' ? pending.phone : '');
  const [gender, setGender] = useState<Gender | ''>(prior?.gender || '');
  const [addressText, setAddressText] = useState(prior?.addressText || '');
  const [located, setLocated] = useState<typeof CURRENT_LOCATION | null>(prior?.address?.location ? (prior.address as never) : null);
  const [locating, setLocating] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);

  const useCurrentLocation = async () => {
    setLocating(true);
    await new Promise((r) => setTimeout(r, 900));
    setLocated(CURRENT_LOCATION);
    setAddressText(`${CURRENT_LOCATION.line}, ${CURRENT_LOCATION.district}`);
    setErrors((e) => ({ ...e, address: '' }));
    setLocating(false);
  };

  const submit = async () => {
    const next: Errors = {
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
      router.push(ROUTES.verify);
    } catch (err) {
      const e = err as { field?: string; message: string };
      setErrors({ [e.field || 'form']: e.message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout title="Create your account" backFallback={ROUTES.welcome}>
      <View style={styles.form}>
        <Field
          label="Full name"
          icon={User}
          value={name}
          onChangeText={setName}
          placeholder="Your full name"
          autoComplete="name"
          textContentType="name"
          autoCapitalize="words"
          error={errors.name}
        />
        <PhoneField
          value={phone}
          onChange={setPhone}
          error={errors.phone}
          helper={
            <View style={styles.helper}>
              <WhatsAppIcon size={16} color={colors.muted} />
              <Text variant="label" weight={400} color="muted">
                We will send a 6-digit code on WhatsApp
              </Text>
            </View>
          }
        />
        <FieldWrapper label="Gender" error={errors.gender}>
          <Segmented
            label="Gender"
            options={GENDERS as { value: Gender; label: string }[]}
            value={gender || null}
            onChange={(v) => {
              setGender(v);
              setErrors((x) => ({ ...x, gender: '' }));
            }}
          />
        </FieldWrapper>
        <View>
          <Field
            label="Delivery address"
            icon={MapPin}
            value={addressText}
            onChangeText={setAddressText}
            placeholder="Building, street, district"
            autoComplete="street-address"
            textContentType="fullStreetAddress"
            error={errors.address}
          />
          <Pressable
            onPress={useCurrentLocation}
            disabled={locating}
            accessibilityRole="button"
            accessibilityState={{ busy: locating }}
            hitSlop={8}
            style={styles.locate}
          >
            {locating ? <Spinner size={18} /> : <LocateFixed size={18} color={colors.maroon} strokeWidth={1.8} />}
            <Text weight={600} color="maroon" style={styles.locateText}>
              {locating ? 'Finding your location…' : 'Use my current location'}
            </Text>
          </Pressable>
        </View>

        {errors.form ? (
          <Text variant="label" color="hotpink">
            {errors.form}
          </Text>
        ) : null}

        <Button block loading={submitting} leftIcon={WhatsAppIcon} onPress={submit} style={styles.submit}>
          Continue with WhatsApp
        </Button>
        <LeadLink lead="Already have an account?" link="Sign in" onPress={() => router.replace(ROUTES.signIn)} />
      </View>
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  form: { gap: 20 },
  helper: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  locate: { marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start' },
  locateText: { fontSize: 15 },
  submit: { marginTop: 8 },
});
