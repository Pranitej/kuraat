import { useMemo, useState } from 'react';
import { Package } from 'lucide-react';
import ScreenHeader from '@/components/layout/ScreenHeader.jsx';
import { Chip, EmptyState, Skeleton } from '@/components/ui';
import { OrderCard } from '@/components/account/OrderParts.jsx';
import { useOrders } from '@/context/OrderContext.jsx';
import { orderStatusView } from '@/domain';
import { ROUTES } from '@/config/routes.js';
import { useDocumentTitle } from '@/hooks';

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'ongoing', label: 'Ongoing' },
  { id: 'delivered', label: 'Delivered' },
];

/** 20 · My orders  ·  21 · My orders (empty) */
export default function OrdersPage() {
  useDocumentTitle('My orders');
  const { orders, now, loaded } = useOrders();
  const [filter, setFilter] = useState('all');

  // Ongoing = not delivered and not cancelled; Delivered = delivered (cancelled orders: All only).
  const list = useMemo(
    () =>
      orders.filter((o) => {
        const s = orderStatusView(o);
        if (filter === 'ongoing') return s.ongoing;
        if (filter === 'delivered') return s.step === 3 && !s.cancelled;
        return true;
      }),
    [orders, filter],
  );

  const showEmpty = !orders.length && loaded;

  return (
    <div className="pb-10">
      <div className="mx-auto max-w-column lg:max-w-[720px]">
        <ScreenHeader title="My orders" backFallback={ROUTES.profile} />
        <div className="px-5 lg:px-0">
          {showEmpty ? (
            <EmptyState
              className="pt-8"
              icon={Package}
              title="No orders yet"
              message="When you place an order it will appear here, together with the branch it was delivered from."
              actionLabel="Start shopping"
              actionTo={ROUTES.home}
            />
          ) : (
            <>
              <div className="flex gap-2.5">
                {FILTERS.map((f) => (
                  <Chip key={f.id} active={filter === f.id} onClick={() => setFilter(f.id)}>
                    {f.label}
                  </Chip>
                ))}
              </div>
              <div className="mt-4 flex flex-col gap-3">
                {!orders.length && !loaded
                  ? [0, 1].map((i) => <Skeleton key={i} className="h-[220px] rounded-xl" />)
                  : list.map((o) => <OrderCard key={o.id} order={o} now={now} />)}
              </div>
              {orders.length > 0 && !list.length && (
                <EmptyState
                  compact
                  icon={Package}
                  title={filter === 'ongoing' ? 'No orders on the way' : 'No delivered orders yet'}
                  message={filter === 'ongoing' ? 'Orders you place will show here until they are delivered.' : 'Delivered orders will show here with the branch they came from.'}
                  actionLabel="Start shopping"
                  actionTo={ROUTES.home}
                />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
