import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { BottomBar, Screen, ScreenHeader } from '@/components/layout';
import { Check, ChevronRight, Mail, MapPin, Pencil, Phone, Trash2, User } from '@/components/icons';
import {
  Avatar,
  Button,
  ConfirmDialog,
  Field,
  FieldWrapper,
  IconTile,
  Segmented,
  Tag,
  Text,
  TextLink,
  inputShellStyle,
} from '@/components/ui';
import { GENDERS } from '@/config/options.js';
import { ROUTES } from '@/config/routes.js';
import { useAddresses } from '@/context/AddressContext';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { formatAddress, formatPhone, formatPhoneLocal, onlyDigits, validateEmail, validateMobile, validateName } from '@/domain';
import { pickAvatar } from '@/lib/photo';
import { FONT_FAMILY, MAX_FONT_SCALE, colors, radii, shadows } from '@/theme/theme';
import type { Gender, User as UserType } from '@/types/api';

type Form = { name: string; phone: string; email: string; gender: Gender | null; avatar: string | null };
type Errors = Partial<Record<'name' | 'phone' | 'email' | 'form', string>>;

/** 18 · Account (and the store-required "Delete account") */
export default function AccountScreen() {
  const router = useRouter();
  const toast = useToast();
  const { user, updateProfile, requestOtp } = useAuth();
  const { defaultAddress } = useAddresses();
  const u = user as UserType;

  const initial: Form = { name: u.name, phone: u.phone, email: u.email || '', gender: u.gender, avatar: u.avatar };
  const [form, setForm] = useState<Form>(initial);
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);
  const [confirmPhone, setConfirmPhone] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [sendingDeleteCode, setSendingDeleteCode] = useState(false);
  const [phoneFocused, setPhoneFocused] = useState(false);

  const dirty = (['name', 'email', 'gender', 'avatar', 'phone'] as const).some((k) => (form[k] || '') !== (initial[k] || ''));
  const phoneChanged = form.phone !== u.phone;
  const set =
    <K extends keyof Form>(k: K) =>
    (v: Form[K]) => {
      setForm((f) => ({ ...f, [k]: v }));
      setErrors((e) => ({ ...e, [k]: '' }));
    };
  const profileChanges = () => ({ name: form.name, email: form.email, gender: form.gender, avatar: form.avatar });
  const fail = (err: unknown) => {
    const e = err as { field?: string; message: string };
    setErrors({ [e.field || 'form']: e.message });
  };

  const pickPhoto = async () => {
    try {
      const avatar = await pickAvatar();
      if (avatar) set('avatar')(avatar);
    } catch {
      toast.show('We could not read that photo', { tone: 'error' });
    }
  };

  const save = async () => {
    const errs: Errors = { name: validateName(form.name), email: validateEmail(form.email), phone: validateMobile(form.phone) };
    setErrors(errs);
    if (Object.values(errs).some(Boolean)) return;
    if (phoneChanged) {
      setConfirmPhone(true);
      return;
    }
    if (!dirty) {
      toast.show('Your details are up to date', { tone: 'info' });
      return;
    }
    setSaving(true);
    try {
      await updateProfile(profileChanges() as never);
      toast.show('Your changes have been saved');
    } catch (err) {
      fail(err);
    } finally {
      setSaving(false);
    }
  };

  const verifyNewNumber = async () => {
    setSendingCode(true);
    try {
      // Save the other fields first, then verify the new number on WhatsApp
      await updateProfile(profileChanges() as never);
      await requestOtp(form.phone, 'change-phone');
      setConfirmPhone(false);
      router.push(ROUTES.verify);
    } catch (err) {
      setConfirmPhone(false);
      fail(err);
    } finally {
      setSendingCode(false);
    }
  };

  /** Delete account (App Store / Google Play requirement): confirmed with a WhatsApp code. */
  const startDelete = async () => {
    setSendingDeleteCode(true);
    try {
      await requestOtp(u.phone, 'delete-account');
      setConfirmDelete(false);
      router.push(ROUTES.verify);
    } catch (err) {
      setConfirmDelete(false);
      setErrors({ form: (err as Error).message });
    } finally {
      setSendingDeleteCode(false);
    }
  };

  return (
    <Screen
      header={<ScreenHeader title="Account" backFallback={ROUTES.profile} />}
      keyboard
      bottomBar={
        <BottomBar>
          <Button block loading={saving} onPress={save}>
            {phoneChanged ? 'Verify number & save' : 'Save changes'}
          </Button>
        </BottomBar>
      }
    >
      <View style={styles.avatarWrap}>
        <View>
          <Avatar name={form.name || u.name} src={form.avatar} size={104} />
          <Pressable
            onPress={pickPhoto}
            accessibilityRole="button"
            accessibilityLabel="Change profile photo"
            hitSlop={6}
            style={styles.pencil}
          >
            <Pencil size={16} color={colors.maroon} strokeWidth={1.9} />
          </Pressable>
        </View>
      </View>
      {form.avatar ? (
        <View style={styles.removePhoto}>
          <TextLink role="button" size={13} weight={600} onPress={() => set('avatar')(null)}>
            Remove photo
          </TextLink>
        </View>
      ) : null}

      <View style={styles.form}>
        <Field
          label="Full name"
          icon={User}
          value={form.name}
          onChangeText={set('name')}
          autoComplete="name"
          textContentType="name"
          error={errors.name}
        />

        <FieldWrapper label="Mobile number (WhatsApp)" error={errors.phone} helper="Changing your number needs a new WhatsApp code.">
          <View style={inputShellStyle({ focused: phoneFocused, error: Boolean(errors.phone) })}>
            <Phone size={20} color={colors.maroon} strokeWidth={1.8} />
            <Text variant="input">+966</Text>
            <TextInput
              value={formatPhoneLocal(form.phone)}
              onChangeText={(t) => set('phone')(onlyDigits(t).slice(0, 9))}
              keyboardType="number-pad"
              autoComplete="tel-national"
              textContentType="telephoneNumber"
              maxLength={11}
              accessibilityLabel="Mobile number (WhatsApp)"
              maxFontSizeMultiplier={MAX_FONT_SCALE}
              selectionColor={colors.maroon}
              cursorColor={colors.maroon}
              onFocus={() => setPhoneFocused(true)}
              onBlur={() => setPhoneFocused(false)}
              style={styles.phoneInput}
            />
            {phoneChanged ? <Tag>Needs code</Tag> : <Tag icon={Check}>Verified</Tag>}
          </View>
        </FieldWrapper>

        <Field
          label="Email (optional)"
          icon={Mail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          textContentType="emailAddress"
          value={form.email}
          onChangeText={set('email')}
          placeholder="name@example.com"
          error={errors.email}
        />

        <FieldWrapper label="Gender">
          <Segmented label="Gender" options={GENDERS as { value: Gender; label: string }[]} value={form.gender} onChange={set('gender')} />
        </FieldWrapper>

        <Pressable
          onPress={() => router.push(ROUTES.addresses)}
          accessibilityRole="button"
          accessibilityLabel={`Default address: ${defaultAddress ? formatAddress(defaultAddress) : 'Add a delivery address'}`}
          style={({ pressed }) => [styles.address, pressed && styles.addressPressed]}
        >
          <IconTile icon={MapPin} />
          <View style={styles.flex}>
            <Text variant="label" weight={400} color="muted">
              Default address
            </Text>
            <Text weight={700} style={styles.addressText}>
              {defaultAddress ? formatAddress(defaultAddress) : 'Add a delivery address'}
            </Text>
          </View>
          <ChevronRight size={20} color={colors.ink} strokeWidth={1.8} />
        </Pressable>

        {errors.form ? (
          <Text variant="label" color="hotpink" accessibilityRole="alert">
            {errors.form}
          </Text>
        ) : null}

        <Pressable
          onPress={() => setConfirmDelete(true)}
          accessibilityRole="button"
          accessibilityLabel="Delete account"
          hitSlop={8}
          style={styles.delete}
        >
          <Trash2 size={18} color={colors.maroon} strokeWidth={1.8} />
          <Text weight={600} color="maroon" style={styles.deleteText}>
            Delete account
          </Text>
        </Pressable>
      </View>

      <ConfirmDialog
        open={confirmPhone}
        onClose={() => setConfirmPhone(false)}
        onConfirm={verifyNewNumber}
        loading={sendingCode}
        icon={Phone}
        title="Verify your new number"
        message={`We will send a 6-digit code on WhatsApp to ${formatPhone(form.phone)}.`}
        confirmLabel="Send code"
      />

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={startDelete}
        loading={sendingDeleteCode}
        icon={Trash2}
        title="Delete your account?"
        message={`This removes your profile, saved addresses, cards and favourites. Past orders stay with the branch for its records. We will send a 6-digit code on WhatsApp to ${formatPhone(u.phone)} to confirm.`}
        confirmLabel="Send code"
        cancelLabel="Keep my account"
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  avatarWrap: { alignItems: 'center' },
  pencil: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.lineSubtle,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.float,
  },
  removePhoto: { marginTop: 8, alignSelf: 'center' },
  form: { marginTop: 20, gap: 20 },
  phoneInput: { flex: 1, height: '100%', paddingVertical: 0, fontSize: 16, fontFamily: FONT_FAMILY[500], color: colors.ink },
  address: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.lineSubtle,
    backgroundColor: colors.surface,
    padding: 16,
  },
  addressPressed: { borderColor: colors.line },
  addressText: { fontSize: 15, lineHeight: 21 },
  delete: { alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  deleteText: { fontSize: 15 },
});
