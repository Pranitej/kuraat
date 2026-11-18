import { useState } from 'react';
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { LocateFixed, MapPin, Phone, Trash2 } from 'lucide-react';
import ScreenHeader from '@/components/layout/ScreenHeader.jsx';
import BottomBar from '@/components/layout/BottomBar.jsx';
import { Button, Chip, ConfirmDialog, FieldWrapper, PhoneField, SelectField, Spinner, TextField, Toggle } from '@/components/ui';
import MapIllustration from '@/components/branch/MapIllustration.jsx';
import { useAddresses } from '@/context/AddressContext.jsx';
import { useAuth } from '@/context/AuthContext.jsx';
import { useBranches } from '@/context/BranchContext.jsx';
import { useCheckout } from '@/context/CheckoutContext.jsx';
import { useToast } from '@/context/ToastContext.jsx';
import { ADDRESS_LABELS, LOCATION_FAILED, deliveryCities, validateMobile, validateRequired } from '@/domain';
import { getBrowserPosition } from '@/lib/geolocation.js';
import { ROUTES } from '@/config/routes.js';
import { useDocumentTitle } from '@/hooks';

/** 24 · Edit address (also "Add address"). Waits for the saved addresses before filling the form. */
export default function EditAddressPage() {
  const { addressId } = useParams();
  const { loaded } = useAddresses();
  if (addressId && !loaded) return <div className="min-h-[60dvh]" aria-busy="true" />;
  return <AddressForm key={addressId || 'new'} addressId={addressId} />;
}

function AddressForm({ addressId }) {
  const isNew = !addressId;
  useDocumentTitle(isNew ? 'Add address' : 'Edit address');
  const navigate = useNavigate();
  const location = useLocation();
  const returnTo = location.state?.returnTo || ROUTES.addresses;
  const toast = useToast();
  const { user } = useAuth();
  const checkout = useCheckout();
  const { addresses, getById, create, update, remove } = useAddresses();
  const { branches } = useBranches();
  const existing = isNew ? null : getById(addressId);
  // City choices = the cities we deliver from (server branches, loaded at sign-in); a new address starts on the first.
  const cities = deliveryCities(branches, existing?.city);

  const [form, setForm] = useState(() => ({
    type: existing?.type || 'home',
    label: existing?.type === 'other' ? existing.label : '',
    line: existing?.line || '',
    district: existing?.district || '',
    city: existing?.city || '',
    landmark: existing?.landmark || '',
    phone: existing?.phone || user?.phone || '',
    isDefault: existing ? existing.isDefault : addresses.length === 0,
    location: existing?.location || null,
  }));
  const [errors, setErrors] = useState({});
  // True once the pin is the device's real position (from "Use current location"): then editing the street or
  // district keeps it; changing the city drops it. Without it, typing a new street or district drops the old pin.
  const [pinned, setPinned] = useState(false);
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (!isNew && !existing) return <Navigate to={ROUTES.addresses} replace />;
  const city = form.city || cities[0] || '';

  const set = (k) => (v) => {
    const dropsPin = k === 'city' || (!pinned && (k === 'line' || k === 'district'));
    if (k === 'city') setPinned(false);
    setForm((f) => ({ ...f, [k]: v, ...(dropsPin ? { location: null } : {}) }));
    setErrors((e) => ({ ...e, [k]: '' }));
  };

  const locate = async () => {
    setLocating(true);
    const position = await getBrowserPosition({ precise: true });
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
    const errs = {
      label: form.type === 'other' ? validateRequired(form.label, 'Give this address a name') : '',
      line: validateRequired(form.line, 'Enter the building and street'),
      district: validateRequired(form.district, 'Enter the district'),
      city: validateRequired(city, 'Choose a city'),
      phone: validateMobile(form.phone),
    };
    setErrors(errs);
    if (Object.values(errs).some(Boolean)) return;
    setSaving(true);
    try {
      const payload = { ...form, city, location: form.location || undefined };
      const saved = isNew ? await create(payload) : await update(existing.id, payload);
      // Added from Delivery or Home's "Deliver to": deliver to the new address straight away.
      if (returnTo === ROUTES.delivery || returnTo === ROUTES.home) checkout.patch({ addressId: saved.id });
      toast.show(isNew ? 'Address added' : 'Address saved');
      navigate(returnTo, { replace: true });
    } catch (err) {
      setErrors({ form: err.message });
      setSaving(false);
    }
  };

  const doDelete = async () => {
    setDeleting(true);
    try {
      await remove(existing.id);
      toast.show(`${existing.label} address deleted`, { tone: 'info' });
      navigate(ROUTES.addresses, { replace: true });
    } catch (err) {
      setDeleting(false);
      setConfirmDelete(false);
      toast.show(err.message, { tone: 'error' });
    }
  };

  const onlyAddress = addresses.length <= 1 && !isNew;

  return (
    <div className="pb-6">
      <div className="mx-auto max-w-column lg:max-w-[640px]">
        <ScreenHeader title={isNew ? 'Add address' : 'Edit address'} backFallback={returnTo} />
        <div className="px-5 lg:px-0">
          <MapIllustration height="h-[166px]" pins={[{ id: 'here', x: 49, y: 50, label: 'Address' }]} selectedId="here">
            <button
              type="button"
              onClick={locate}
              disabled={locating}
              className="absolute bottom-3 right-3 inline-flex h-11 items-center gap-2 rounded-pill bg-white px-4 text-[15px] font-semibold text-ink shadow-float transition hover:bg-cream disabled:opacity-80"
            >
              {locating ? <Spinner size={18} className="text-maroon" /> : <LocateFixed size={18} strokeWidth={1.8} className="text-maroon" />}
              {locating ? 'Locating…' : pinned ? 'Location saved' : 'Use current location'}
            </button>
          </MapIllustration>

          <div className="mt-5 flex flex-col gap-5">
            <FieldWrapper id="address-label" label="Label" error={errors.label}>
              <div className="flex gap-2.5" role="radiogroup" aria-label="Address label">
                {ADDRESS_LABELS.map((l) => (
                  <Chip key={l.id} active={form.type === l.id} role="radio" aria-checked={form.type === l.id} onClick={() => set('type')(l.id)}>
                    {l.label}
                  </Chip>
                ))}
              </div>
              {form.type === 'other' && (
                <TextField className="mt-3" aria-label="Address name" placeholder="e.g. Parents’ home" value={form.label} onChange={(e) => set('label')(e.target.value)} />
              )}
            </FieldWrapper>

            <TextField label="Address" icon={MapPin} value={form.line} onChange={(e) => set('line')(e.target.value)} placeholder="Building, street" autoComplete="address-line1" error={errors.line} />

            <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3">
              <TextField label="District" value={form.district} onChange={(e) => set('district')(e.target.value)} placeholder="District" error={errors.district} />
              <SelectField label="City" options={cities} value={city} onChange={(e) => set('city')(e.target.value)} error={errors.city} />
            </div>

            <TextField label="Landmark (optional)" value={form.landmark} onChange={(e) => set('landmark')(e.target.value)} placeholder="Near Al Rakah Park" />

            <PhoneField label="Phone for this address" value={form.phone} onChange={set('phone')} error={errors.phone} />

            <div className="flex items-center justify-between gap-4">
              <label htmlFor="default-toggle" className="text-[15px] font-bold text-ink">
                Make this my default address
              </label>
              <Toggle
                id="default-toggle"
                checked={form.isDefault}
                onChange={set('isDefault')}
                disabled={existing?.isDefault && addresses.length <= 1}
                label="Make this my default address"
              />
            </div>

            {!isNew && (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                disabled={onlyAddress}
                className="mx-auto inline-flex items-center gap-2 text-[15px] font-semibold text-maroon hover:underline disabled:opacity-40 disabled:hover:no-underline"
              >
                <Trash2 size={18} strokeWidth={1.8} /> Delete this address
              </button>
            )}
            {onlyAddress && <p className="-mt-3 text-center text-caption text-muted">Add another address before deleting your only one.</p>}
            {errors.form && <p className="text-label text-hotpink">{errors.form}</p>}
          </div>

          <BottomBar>
            <Button block loading={saving} onClick={save}>
              Save address
            </Button>
          </BottomBar>
        </div>
      </div>

      {!isNew && (
        <ConfirmDialog
          open={confirmDelete}
          onClose={() => setConfirmDelete(false)}
          onConfirm={doDelete}
          loading={deleting}
          icon={Trash2}
          title={`Delete ${existing.label} address?`}
          message={existing.isDefault ? 'This is your default address. Another saved address will become your default.' : 'You can add it again at any time.'}
          confirmLabel="Delete address"
          cancelLabel="Keep address"
        />
      )}
    </div>
  );
}
