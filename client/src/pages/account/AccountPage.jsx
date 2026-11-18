import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Check, ChevronRight, Mail, MapPin, Pencil, Phone, Trash2, User } from 'lucide-react';
import ScreenHeader from '@/components/layout/ScreenHeader.jsx';
import BottomBar from '@/components/layout/BottomBar.jsx';
import { Avatar, Button, ConfirmDialog, FieldWrapper, IconTile, PhoneField, SegmentedControl, Tag, TextField } from '@/components/ui';
import { GENDERS } from '@/config/options.js';
import { useAuth } from '@/context/AuthContext.jsx';
import { useAddresses } from '@/context/AddressContext.jsx';
import { useToast } from '@/context/ToastContext.jsx';
import { formatAddress, formatPhone, validateEmail, validateMobile, validateName } from '@/domain';
import { ROUTES } from '@/config/routes.js';
import { useDocumentTitle } from '@/hooks';

/** Resize a chosen photo to a small square JPEG data URL (keeps demo storage light). */
function resizeImage(file, size = 256) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        const s = Math.min(img.width, img.height);
        ctx.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

/** 18 · Account */
export default function AccountPage() {
  useDocumentTitle('Account');
  const navigate = useNavigate();
  const toast = useToast();
  const { user, updateProfile, requestOtp } = useAuth();
  const { defaultAddress } = useAddresses();
  const fileRef = useRef(null);

  const initial = { name: user.name, phone: user.phone, email: user.email || '', gender: user.gender, avatar: user.avatar };
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [confirmPhone, setConfirmPhone] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [sendingDeleteCode, setSendingDeleteCode] = useState(false);

  const dirty = ['name', 'email', 'gender', 'avatar', 'phone'].some((k) => (form[k] || '') !== (initial[k] || ''));
  const phoneChanged = form.phone !== user.phone;
  const set = (k) => (v) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => ({ ...e, [k]: '' }));
  };

  const pickPhoto = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.show('Choose an image file', { tone: 'error' });
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast.show('Choose a photo smaller than 8 MB', { tone: 'error' });
      return;
    }
    try {
      set('avatar')(await resizeImage(file));
    } catch {
      toast.show('We could not read that photo', { tone: 'error' });
    }
  };

  const save = async () => {
    const errs = { name: validateName(form.name), email: validateEmail(form.email), phone: validateMobile(form.phone) };
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
      await updateProfile({ name: form.name, email: form.email, gender: form.gender, avatar: form.avatar });
      toast.show('Your changes have been saved');
    } catch (err) {
      setErrors({ [err.field || 'form']: err.message });
    } finally {
      setSaving(false);
    }
  };

  const verifyNewNumber = async () => {
    setSendingCode(true);
    try {
      // Save the other fields first, then verify the new number on WhatsApp
      await updateProfile({ name: form.name, email: form.email, gender: form.gender, avatar: form.avatar });
      await requestOtp(form.phone, 'change-phone');
      setConfirmPhone(false);
      navigate(ROUTES.verify);
    } catch (err) {
      setConfirmPhone(false);
      setErrors({ [err.field || 'form']: err.message });
    } finally {
      setSendingCode(false);
    }
  };

  /** Delete account (App Store / Google Play requirement): confirmed with a WhatsApp code. */
  const startDelete = async () => {
    setSendingDeleteCode(true);
    try {
      await requestOtp(user.phone, 'delete-account');
      setConfirmDelete(false);
      navigate(ROUTES.verify);
    } catch (err) {
      setConfirmDelete(false);
      setErrors({ form: err.message });
    } finally {
      setSendingDeleteCode(false);
    }
  };

  return (
    <div className="pb-6">
      <div className="mx-auto max-w-column lg:max-w-[640px]">
        <ScreenHeader title="Account" backFallback={ROUTES.profile} />
        <div className="px-5 lg:px-0">
          <div className="flex justify-center">
            <div className="relative">
              <Avatar name={form.name || user.name} src={form.avatar} size={104} />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                aria-label="Change profile photo"
                className="absolute -bottom-0.5 -right-0.5 grid size-9 place-items-center rounded-full border border-line-subtle bg-white text-maroon shadow-float transition hover:bg-cream"
              >
                <Pencil size={16} strokeWidth={1.9} />
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={pickPhoto} />
            </div>
          </div>
          {form.avatar && (
            <p className="mt-2 text-center">
              <button type="button" onClick={() => set('avatar')(null)} className="text-label text-maroon hover:underline">
                Remove photo
              </button>
            </p>
          )}

          <div className="mt-5 flex flex-col gap-5">
            <TextField label="Full name" icon={User} value={form.name} onChange={(e) => set('name')(e.target.value)} autoComplete="name" error={errors.name} />

            <PhoneField
              id="account-phone"
              label="Mobile number (WhatsApp)"
              value={form.phone}
              onChange={set('phone')}
              error={errors.phone}
              helper="Changing your number needs a new WhatsApp code."
              trailing={phoneChanged ? <Tag>Needs code</Tag> : <Tag icon={Check}>Verified</Tag>}
            />

            <TextField
              label="Email (optional)"
              icon={Mail}
              type="email"
              value={form.email}
              onChange={(e) => set('email')(e.target.value)}
              placeholder="name@example.com"
              autoComplete="email"
              error={errors.email}
            />

            <FieldWrapper id="account-gender" label="Gender">
              <SegmentedControl label="Gender" options={GENDERS} value={form.gender} onChange={set('gender')} />
            </FieldWrapper>

            <Link to={ROUTES.addresses} className="flex items-center gap-3.5 rounded-xl border border-line-subtle bg-white p-4 transition hover:border-line">
              <IconTile icon={MapPin} />
              <span className="min-w-0 flex-1">
                <span className="block text-label font-normal text-muted">Default address</span>
                <span className="block text-[15px] font-bold leading-[21px] text-ink">{defaultAddress ? formatAddress(defaultAddress) : 'Add a delivery address'}</span>
              </span>
              <ChevronRight size={20} strokeWidth={1.8} className="shrink-0 text-ink" aria-hidden />
            </Link>
            {errors.form && <p className="text-label text-hotpink">{errors.form}</p>}
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="mx-auto inline-flex items-center gap-2 text-[15px] font-semibold text-maroon hover:underline"
            >
              <Trash2 size={18} strokeWidth={1.8} /> Delete account
            </button>
          </div>

          <BottomBar>
            <Button block loading={saving} onClick={save}>
              {phoneChanged ? 'Verify number & save' : 'Save changes'}
            </Button>
          </BottomBar>
        </div>
      </div>

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
        message={`This removes your profile, saved addresses and cards. Past orders stay with the branch for its records. We will send a 6-digit code on WhatsApp to ${formatPhone(user.phone)} to confirm.`}
        confirmLabel="Send code"
        cancelLabel="Keep my account"
      />
    </div>
  );
}
