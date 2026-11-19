import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronRight, KeyRound, LogOut, MapPin, ReceiptText, User } from 'lucide-react';
import { BackButton } from '@/components/layout/ScreenHeader.jsx';
import { Avatar, Button, ConfirmDialog, IconTile, MaroonPanel } from '@/components/ui';
import { useAuth } from '@/context/AuthContext.jsx';
import { useAddresses } from '@/context/AddressContext.jsx';
import { useToast } from '@/context/ToastContext.jsx';
import { formatPhone } from '@/domain';
import { ROUTES } from '@/config/routes.js';
import { useDocumentTitle } from '@/hooks';
import { t } from '@/i18n';

/** 17 · Profile */
export default function ProfilePage() {
  useDocumentTitle(t('Profile'));
  const navigate = useNavigate();
  const toast = useToast();
  const { user, signOut } = useAuth();
  const { addresses } = useAddresses();
  const [confirm, setConfirm] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const items = [
    { to: ROUTES.account, icon: User, title: t('Account'), subtitle: t('Name, phone number, gender') },
    { to: ROUTES.password, icon: KeyRound, title: t('Password'), subtitle: t('Set or change your password') },
    { to: ROUTES.orders, icon: ReceiptText, title: t('Orders'), subtitle: t('View your previous orders') },
    { to: ROUTES.addresses, icon: MapPin, title: t('Saved addresses'), subtitle: `${addresses.length} saved ${addresses.length === 1 ? 'address' : 'addresses'}` },
  ];

  const logOut = async () => {
    setLeaving(true);
    await signOut();
    toast.show(t('You have been logged out'), { tone: 'info' });
    navigate(ROUTES.welcome, { replace: true });
  };

  return (
    <div className="pb-10">
      <MaroonPanel className="lg:mx-auto lg:mt-8 lg:max-w-[720px] lg:rounded-2xl">
        <div className="mx-auto max-w-column px-5 pb-14 pt-4 lg:max-w-none lg:px-8 lg:pb-16 lg:pt-6">
          <div className="grid grid-cols-[44px_1fr_44px] items-center">
            <BackButton variant="glass" fallback={ROUTES.home} />
            <h1 className="text-center text-heading">{t('Profile')}</h1>
          </div>
          <div className="mt-6 flex items-center gap-4 lg:mt-8">
            <Avatar name={user?.name} src={user?.avatar} size={76} tone="cream" className="text-[27px]" />
            <div className="min-w-0">
              <p className="truncate text-[22px] font-bold leading-7">{user?.name}</p>
              <p className="mt-0.5 text-body text-white/80">{formatPhone(user?.phone)}</p>
            </div>
          </div>
        </div>
      </MaroonPanel>

      <div className="relative -mt-7 rounded-t-sheet bg-cream lg:mx-auto lg:mt-6 lg:max-w-[720px] lg:rounded-none">
        <div className="mx-auto max-w-column px-5 pt-7 lg:max-w-none lg:px-0 lg:pt-0">
          <nav aria-label={t('Profile')} className="flex flex-col gap-3 lg:grid lg:grid-cols-2 lg:gap-4">
            {items.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="flex items-center gap-3.5 rounded-xl border border-line-subtle bg-white p-4 transition hover:border-line hover:shadow-float"
              >
                <IconTile icon={item.icon} />
                <span className="min-w-0 flex-1">
                  <span className="block text-[16px] font-bold leading-[22px] text-ink">{item.title}</span>
                  <span className="block truncate text-small text-muted">{item.subtitle}</span>
                </span>
                <ChevronRight size={20} strokeWidth={1.8} className="shrink-0 text-ink" aria-hidden />
              </Link>
            ))}
          </nav>
          <Button variant="secondary" block leftIcon={LogOut} className="mt-5 lg:mt-8 lg:w-auto lg:min-w-[240px]" onClick={() => setConfirm(true)}>{t('Log out')}</Button>
        </div>
      </div>

      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        onConfirm={logOut}
        loading={leaving}
        icon={LogOut}
        title={t('Log out of kuraat?')}
        message={t('Your cart and saved addresses will be here when you sign back in.')}
        confirmLabel={t('Log out')}
        cancelLabel={t('Stay signed in')}
      />
    </div>
  );
}
