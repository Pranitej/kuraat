import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { BottomBar, Screen, ScreenHeader } from '@/components/layout';
import { Check, ChevronRight, Mail, MapPin, Pencil, Trash2, User } from '@/components/icons';
import {
  Avatar,
  Button,
  ConfirmDialog,
  Field,
  FieldWrapper,
  IconTile,
  PhoneField,
  Segmented,
  Tag,
  Text,
  TextLink,
} from '@/components/ui';
import { GENDERS } from '@/config/options.js';
import { ROUTES } from '@/lib/routes';
import { useAddresses } from '@/context/AddressContext';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { formatAddress, formatPhone, validateEmail, validateName } from '@/domain';
import { pickAvatar } from '@/lib/photo';
import { FONT_FAMILY, MAX_FONT_SCALE, colors, radii, shadows } from '@/theme/theme';
import type { Gender, User as UserType } from '@/types/api';
import { t } from '@/i18n';

type Form = { name: string; email: string; gender: Gender | null; avatar: string | null };
type Errors = Partial<Record<'name' | 'email' | 'form', string>>;

/** 18 · Account (and the store-required "Delete account") */
export default function AccountScreen() {
  const router = useRouter();
  const toast = useToast();
  const { user, updateProfile, requestOtp } = useAuth();
  const { defaultAddress } = useAddresses();
  const u = user as UserType;

  const initial: Form = { name: u.name, email: u.email || '', gender: u.gender, avatar: u.avatar };
  const [form, setForm] = useState<Form>(initial);
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [sendingDeleteCode, setSendingDeleteCode] = useState(false);

  const dirty = (['name', 'email', 'gender', 'avatar'] as const).some((k) => (form[k] || '') !== (initial[k] || ''));
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
      toast.show(t('We could not read that photo'), { tone: 'error' });
    }
  };

  const save = async () => {
    const errs: Errors = { name: validateName(form.name), email: validateEmail(form.email) };
    setErrors(errs);
    if (Object.values(errs).some(Boolean)) return;
    if (!dirty) {
      toast.show(t('Your details are up to date'), { tone: 'info' });
      return;
    }
    setSaving(true);
    try {
      await updateProfile(profileChanges() as never);
      toast.show(t('Your changes have been saved'));
    } catch (err) {
      fail(err);
    } finally {
      setSaving(false);
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
      header={<ScreenHeader title={t('Account')} backFallback={ROUTES.profile} />}
      keyboard
      bottomBar={
        <BottomBar>
          <Button block loading={saving} onPress={save}>{t('Save changes')}</Button>
        </BottomBar>
      }
    >
      <View style={styles.avatarWrap}>
        <View>
          <Avatar name={form.name || u.name} src={form.avatar} size={104} />
          <Pressable
            onPress={pickPhoto}
            accessibilityRole="button"
            accessibilityLabel={t('Change profile photo')}
            hitSlop={6}
            style={styles.pencil}
          >
            <Pencil size={16} color={colors.maroon} strokeWidth={1.9} />
          </Pressable>
        </View>
      </View>
      {form.avatar ? (
        <View style={styles.removePhoto}>
          <TextLink role="button" size={13} weight={600} onPress={() => set('avatar')(null)}>{t('Remove photo')}</TextLink>
        </View>
      ) : null}

      <View style={styles.form}>
        <Field
          label={t('Full name')}
          icon={User}
          value={form.name}
          onChangeText={set('name')}
          autoComplete="name"
          textContentType="name"
          error={errors.name}
        />

        {/* The number is fixed when the account is created: orders are found by it. */}
        <PhoneField
          label={t('Mobile number (WhatsApp)')}
          value={u.phone}
          onChange={() => {}}
          disabled
          helper={t('Your mobile number cannot be changed.')}
          trailing={<Tag icon={Check}>{t('Verified')}</Tag>}
        />

        <Field
          label={t('Email (optional)')}
          icon={Mail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          textContentType="emailAddress"
          value={form.email}
          onChangeText={set('email')}
          placeholder={t('name@example.com')}
          error={errors.email}
        />

        <FieldWrapper label={t('Gender')}>
          <Segmented label={t('Gender')} options={GENDERS as { value: Gender; label: string }[]} value={form.gender} onChange={set('gender')} />
        </FieldWrapper>

        <Pressable
          onPress={() => router.push(ROUTES.addresses)}
          accessibilityRole="button"
          accessibilityLabel={t('Default address: {v1}', { v1: defaultAddress ? formatAddress(defaultAddress) : 'Add a delivery address' })}
          style={({ pressed }) => [styles.address, pressed && styles.addressPressed]}
        >
          <IconTile icon={MapPin} />
          <View style={styles.flex}>
            <Text variant="label" weight={400} color="muted">{t('Default address')}</Text>
            <Text weight={700} style={styles.addressText}>
              {defaultAddress ? formatAddress(defaultAddress) : t('Add a delivery address')}
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
          accessibilityLabel={t('Delete account')}
          hitSlop={8}
          style={styles.delete}
        >
          <Trash2 size={18} color={colors.maroon} strokeWidth={1.8} />
          <Text weight={600} color="maroon" style={styles.deleteText}>{t('Delete account')}</Text>
        </Pressable>
      </View>

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={startDelete}
        loading={sendingDeleteCode}
        icon={Trash2}
        title={t('Delete your account?')}
        message={t('This removes your profile, saved addresses and cards. Past orders stay with the branch for its records. We will send a 6-digit code on WhatsApp to {phone} to confirm.', { v1: formatPhone(u.phone) })}
        confirmLabel={t('Send code')}
        cancelLabel={t('Keep my account')}
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
