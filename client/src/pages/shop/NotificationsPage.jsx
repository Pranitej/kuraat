import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BellOff, CreditCard, Gift, Lock, Package, PackageX, Tag, Truck } from 'lucide-react';
import ScreenHeader from '@/components/layout/ScreenHeader.jsx';
import { EmptyState, Spinner } from '@/components/ui';
import { useNotifications } from '@/context/NotificationContext.jsx';
import { formatNotificationTime, isSameDay } from '@/domain';
import { ROUTES, notificationTarget } from '@/config/routes.js';
import { useDocumentTitle } from '@/hooks';
import { cn } from '@/lib/cn.js';

const ICONS = {
  order: Package,
  payment: CreditCard,
  welcome: Gift,
  delivered: Truck,
  out_for_delivery: Truck,
  product: Tag,
  security: Lock,
  cancelled: PackageX,
};

/** 26 · Notifications */
export default function NotificationsPage() {
  useDocumentTitle('Notifications');
  const navigate = useNavigate();
  const { items, unreadCount, markRead, markAllRead } = useNotifications();
  const [marking, setMarking] = useState(false);

  const groups = useMemo(() => {
    const now = new Date();
    const today = items.filter((n) => isSameDay(n.createdAt, now));
    const earlier = items.filter((n) => !isSameDay(n.createdAt, now));
    return [
      { id: 'today', label: 'Today', items: today },
      { id: 'earlier', label: 'Earlier', items: earlier },
    ].filter((g) => g.items.length);
  }, [items]);

  const open = (n) => {
    if (!n.read) markRead(n.id);
    navigate(notificationTarget(n.link));
  };

  const markAll = async () => {
    setMarking(true);
    try {
      await markAllRead();
    } finally {
      setMarking(false);
    }
  };

  return (
    <div className="pb-10">
      <div className="mx-auto max-w-column lg:max-w-[720px]">
        <ScreenHeader
          title="Notifications"
          right={
            <button
              type="button"
              onClick={markAll}
              disabled={!unreadCount || marking}
              className="w-[52px] text-right text-label font-bold leading-[16px] text-maroon transition hover:underline disabled:opacity-40 disabled:hover:no-underline lg:w-auto"
            >
              {marking ? <Spinner size={16} className="ml-auto" /> : 'Mark all read'}
            </button>
          }
        />
      </div>

      <div className="mx-auto max-w-column lg:max-w-[720px]">
        {groups.length === 0 && (
          <EmptyState
            icon={BellOff}
            title="You are all caught up"
            message="Order updates, offers and account messages will appear here."
            actionLabel="Back to home"
            actionTo={ROUTES.home}
          />
        )}
        {groups.map((group) => (
          <section key={group.id} aria-labelledby={`notif-${group.id}`} className="lg:mb-6">
            <h2 id={`notif-${group.id}`} className="px-5 pb-2 pt-3 text-overline uppercase text-muted lg:px-0">
              {group.label}
            </h2>
            <ul className="lg:overflow-hidden lg:rounded-xl lg:border lg:border-line-subtle">
              {group.items.map((n) => {
                const Icon = ICONS[n.type] || Package;
                return (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => open(n)}
                      className={cn(
                        'flex w-full items-start gap-3.5 px-5 py-4 text-left transition hover:bg-sand/60',
                        n.read ? 'bg-transparent lg:bg-white' : 'bg-sand-soft',
                      )}
                    >
                      <span className={cn('grid size-10 shrink-0 place-items-center rounded-full text-maroon', n.read ? 'bg-sand' : 'bg-sand')} aria-hidden>
                        <Icon size={19} strokeWidth={1.8} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[15px] font-bold leading-5 text-ink">{n.title}</span>
                        <span className="mt-0.5 block text-small text-muted">{n.body}</span>
                        <span className="mt-1 block text-caption text-muted">{formatNotificationTime(n.createdAt)}</span>
                      </span>
                      {!n.read && <span className="mt-2 size-2 shrink-0 rounded-full bg-maroon" aria-label="Unread" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
