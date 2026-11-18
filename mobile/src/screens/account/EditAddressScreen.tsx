import { Redirect, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { MapIllustration } from '@/components/branch/MapIllustration';
import { BottomBar, Screen, ScreenHeader } from '@/components/layout';
import { LocateFixed, MapPin, Trash2 } from '@/components/icons';
import { Button, Chip, ConfirmDialog, Field, FieldWrapper, SelectField, Spinner, Text, Toggle } from '@/components/ui';
import { ROUTES } from '@/lib/routes';
import { useAddresses, type AddressInput } from '@/context/AddressContext';
import { useBranches } from '@/context/BranchContext';
import { useCheckout } from '@/context/CheckoutContext';
import { useToast } from '@/context/ToastContext';
import { ADDRESS_LABELS, LOCATION_FAILED, deliveryCities, validateRequired } from '@/domain';
import { getDevicePosition } from '@/lib/location';
import { colors, radii, shadows } from '@/theme/theme';
import type { AddressType, LatLng } from '@/types/api';

type Form = {
  type: AddressType;
  label: string;
  line: string;
  district: string;
  city: string;
  landmark: string;
  isDefault: boolean;
  location: LatLng | null;
};
type Errors = Partial<Record<'label' | 'line' | 'district' | 'city' | 'form', string>>;

/** 24 · Edit address (also "Add address"). Waits for the saved addresses before filling the form. */
export default function EditAddressScreen() {
  const { addressId } = useLocalSearchParams<{ addressId?: string }>();
  const { loaded } = useAddresses();
  if (addressId && !loaded) return <Screen>{null}</Screen>;
  return <AddressForm key={addressId || 'new'} addressId={addressId} />;
}

function AddressForm({ addressId }: { addressId?: string }) {
  const isNew = !addressId;
  const router = useRouter();
  const params = useLocalSearchParams<{ returnTo?: string }>();
  const returnTo = (params.returnTo || ROUTES.addresses) as Href;
  // Added from Delivery or Home's "Deliver to": deliver to the new address straight away.
  const fromDelivery = params.returnTo === ROUTES.delivery || params.returnTo === ROUTES.home;
  const toast = useToast();
  const checkout = useCheckout();
  const { addresses, getById, create, update, remove } = useAddresses();
  const { branches } = useBranches();
  const existing = isNew ? null : getById(addressId);
  // City choices = the cities we deliver from (server branches, loaded at sign-in); a new address starts on the first.
  const cities = deliveryCities(branches, existing?.city) as string[];

  const [form, setForm] = useState<Form>(() => ({
    type: existing?.type || 'home',
    label: existing?.type === 'other' ? existing.label : '',
    line: existing?.line || '',
    district: existing?.district || '',
    city: existing?.city || '',
    landmark: existing?.landmark || '',
    isDefault: existing ? existing.isDefault : addresses.length === 0,
    location: existing?.location || null,
  }));
  const [errors, setErrors] = useState<Errors>({});
  // True once the pin is the device's real position (from "Use current location"): then editing the street or
  // district keeps it; changing the city drops it. Without it, typing a new street or district drops the old pin.
  const [pinned, setPinned] = useState(false);
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // A new address: ask for the device location once, as other apps do. Refusing is fine (the location is
  // optional and the address can still be saved and ordered to); "Use current location" stays for a later try.
  const asked = useRef(false);
  useEffect(() => {
    if (!isNew || asked.current) return;
    asked.current = true;
    (async () => {
      setLocating(true);
      const position = await getDevicePosition({ precise: true });
      setLocating(false);
      if (!position) return;
      setForm((f) => (f.location ? f : { ...f, location: position }));
      setPinned(true);
    })();
  }, [isNew]);

  if (!isNew && !existing) return <Redirect href={ROUTES.addresses} />;
  const city = form.city || cities[0] || '';

  // Back to where the form was opened from (Delivery or Saved addresses) without stacking a copy.
  const leave = () => {
    if (router.canGoBack()) router.back();
    else router.replace(returnTo);
  };

  const set =
    <K extends keyof Form>(k: K) =>
    (v: Form[K]) => {
      const dropsPin = k === 'city' || (!pinned && (k === 'line' || k === 'district'));
      if (k === 'city') setPinned(false);
      setForm((f) => ({ ...f, [k]: v, ...(dropsPin ? { location: null } : {}) }));
      setErrors((e) => ({ ...e, [k]: '' }));
    };

  const locate = async () => {
    setLocating(true);
    const position = await getDevicePosition({ precise: true });
    setLocating(false);
    if (!position) {
      toast.show(LOCATION_FAILED, { tone: 'error' });
      return;
    }
    setForm((f) => ({ ...f, location: position }));
    setPinned(true);
    toast.show('Location saved for this address. Add the building and street.', { tone: 'info' });
  };

  const save = async () => {
    const errs: Errors = {
      label: form.type === 'other' ? validateRequired(form.label, 'Give this address a name') : '',
      line: validateRequired(form.line, 'Enter the building and street'),
      district: validateRequired(form.district, 'Enter the district'),
      city: validateRequired(city, 'Choose a city'),
    };
    setErrors(errs);
    if (Object.values(errs).some(Boolean)) return;
    setSaving(true);
    try {
      const payload = { ...form, city, location: form.location || undefined } as AddressInput;
      const saved = isNew ? await create(payload) : await update(existing!.id, payload);
      if (fromDelivery) checkout.patch({ addressId: saved.id });
      toast.show(isNew ? 'Address added' : 'Address saved');
      leave();
    } catch (err) {
      setErrors({ form: (err as Error).message });
      setSaving(false);
    }
  };

  const doDelete = async () => {
    if (!existing) return;
    setDeleting(true);
    try {
      await remove(existing.id);
      toast.show(`${existing.label} address deleted`, { tone: 'info' });
      leave();
    } catch (err) {
      setDeleting(false);
      setConfirmDelete(false);
      toast.show((err as Error).message, { tone: 'error' });
    }
  };

  const onlyAddress = addresses.length <= 1 && !isNew;

  return (
    <Screen
      header={<ScreenHeader title={isNew ? 'Add address' : 'Edit address'} backFallback={returnTo} />}
      keyboard
      bottomBar={
        <BottomBar>
          <Button block loading={saving} onPress={save}>
            Save address
          </Button>
        </BottomBar>
      }
    >
      <MapIllustration height={166} pins={[{ id: 'here', x: 49, y: 50, label: 'Address' }]} selectedId="here">
        <Pressable
          onPress={locate}
          disabled={locating}
          accessibilityRole="button"
          accessibilityState={{ busy: locating }}
          style={styles.locate}
        >
          {locating ? <Spinner size={18} /> : <LocateFixed size={18} color={colors.maroon} strokeWidth={1.8} />}
          <Text weight={600} style={styles.locateText} numberOfLines={1}>
            {locating ? 'Locating…' : pinned ? 'Location saved' : 'Use current location'}
          </Text>
        </Pressable>
      </MapIllustration>

      <View style={styles.form}>
        <FieldWrapper label="Label" error={errors.label}>
          <View style={styles.labels} accessibilityRole="radiogroup" accessibilityLabel="Address label">
            {(ADDRESS_LABELS as { id: AddressType; label: string }[]).map((l) => (
              <Chip key={l.id} active={form.type === l.id} onPress={() => set('type')(l.id)}>
                {l.label}
              </Chip>
            ))}
          </View>
          {form.type === 'other' ? (
            <Field
              accessibilityLabel="Address name"
              placeholder="e.g. Parents’ home"
              value={form.label}
              onChangeText={set('label')}
              style={styles.otherName}
            />
          ) : null}
        </FieldWrapper>

        <Field
          label="Address"
          icon={MapPin}
          value={form.line}
          onChangeText={set('line')}
          placeholder="Building, street"
          autoComplete="address-line1"
          textContentType="streetAddressLine1"
          error={errors.line}
        />

        <View style={styles.row}>
          <Field
            label="District"
            value={form.district}
            onChangeText={set('district')}
            placeholder="District"
            error={errors.district}
            style={styles.flex}
          />
          <SelectField label="City" options={cities} value={city} onChange={set('city')} error={errors.city} style={styles.flex} />
        </View>

        <Field label="Landmark (optional)" value={form.landmark} onChangeText={set('landmark')} placeholder="Near Al Rakah Park" />

        <View style={styles.toggleRow}>
          <Text weight={700} style={[styles.flex, styles.toggleLabel]}>
            Make this my default address
          </Text>
          <Toggle
            value={form.isDefault}
            onChange={set('isDefault')}
            disabled={Boolean(existing?.isDefault && addresses.length <= 1)}
            label="Make this my default address"
          />
        </View>

        {!isNew ? (
          <Pressable
            onPress={() => setConfirmDelete(true)}
            disabled={onlyAddress}
            accessibilityRole="button"
            accessibilityState={{ disabled: onlyAddress }}
            hitSlop={8}
            style={[styles.delete, onlyAddress && styles.dim]}
          >
            <Trash2 size={18} color={colors.maroon} strokeWidth={1.8} />
            <Text weight={600} color="maroon" style={styles.deleteText}>
              Delete this address
            </Text>
          </Pressable>
        ) : null}
        {onlyAddress ? (
          <Text variant="caption" color="muted" align="center" style={styles.onlyNote}>
            Add another address before deleting your only one.
          </Text>
        ) : null}
        {errors.form ? (
          <Text variant="label" color="hotpink" accessibilityRole="alert">
            {errors.form}
          </Text>
        ) : null}
      </View>

      {existing ? (
        <ConfirmDialog
          open={confirmDelete}
          onClose={() => setConfirmDelete(false)}
          onConfirm={doDelete}
          loading={deleting}
          icon={Trash2}
          title={`Delete ${existing.label} address?`}
          message={
            existing.isDefault
              ? 'This is your default address. Another saved address will become your default.'
              : 'You can add it again at any time.'
          }
          confirmLabel="Delete address"
          cancelLabel="Keep address"
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  locate: {
    position: 'absolute',
    right: 12,
    bottom: 12,
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    borderRadius: radii.pill,
    backgroundColor: colors.white,
    ...shadows.float,
  },
  locateText: { fontSize: 15 },
  form: { marginTop: 20, gap: 20 },
  labels: { flexDirection: 'row', gap: 10 },
  otherName: { marginTop: 12 },
  row: { flexDirection: 'row', gap: 12 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  toggleLabel: { fontSize: 15 },
  delete: { alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 8 },
  dim: { opacity: 0.4 },
  deleteText: { fontSize: 15 },
  onlyNote: { marginTop: -12 },
});
