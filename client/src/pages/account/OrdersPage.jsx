import { useMemo, useState } from 'react';
import { ChevronDown, Package } from 'lucide-react';
import ScreenHeader from '@/components/layout/ScreenHeader.jsx';
import { EmptyState, Skeleton } from '@/components/ui';
import { OrderCard, RefreshButton } from '@/components/account/OrderParts.jsx';
import { useOrders } from '@/context/OrderContext.jsx';
import { ORDER_FILTERS, filterOrders } from '@/domain';
import { ROUTES } from '@/config/routes.js';
import { useDocumentTitle } from '@/hooks';

/** Status dropdown styled like a chip; a native select so phones get their own picker. */
function StatusSelect({ value, onChange }) {
  return (
    <label className="flex items-center gap-2.5 text-label text-muted">
      Show
      <span className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-label="Show orders"
          className="h-10 appearance-none rounded-pill border border-line bg-white pl-4 pr-10 text-[15px] font-semibold text-maroon outline-none transition focus:border-maroon focus:shadow-ring"
        >
          {ORDER_FILTERS.map((f) => (
            <option key={f.id} value={f.id}>
              {f.label}
            </option>
          ))}
        </select>
        <ChevronDown size={18} strokeWidth={2} className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-maroon" aria-hidden />
      </span>
    </label>
  );
}

/** 20 · My orders  ·  21 · My orders (empty) */
export default function OrdersPage() {
  useDocumentTitle('My orders');
  const { orders, now, loaded, refresh } = useOrders();
  const [filter, setFilter] = useState('all');

  // The dropdown's groups come from the server's status table (design 2026-11-18 §5.4).
  const list = useMemo(() => filterOrders(orders, filter), [orders, filter]);

  const showEmpty = !orders.length && loaded;

  return (
    <div className="pb-10">
      <div className="mx-auto max-w-column lg:max-w-[720px]">
        <ScreenHeader
          title="My orders"
          backFallback={ROUTES.profile}
          right={orders.length ? <RefreshButton label="Refresh orders" onRefresh={() => refresh({ force: true })} /> : null}
        />
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
              <StatusSelect value={filter} onChange={setFilter} />
              <div className="mt-4 flex flex-col gap-3">
                {!orders.length && !loaded
                  ? [0, 1].map((i) => <Skeleton key={i} className="h-[220px] rounded-xl" />)
                  : list.map((o) => <OrderCard key={o.id} order={o} now={now} />)}
              </div>
              {orders.length > 0 && !list.length && (
                <EmptyState
                  compact
                  icon={Package}
                  title="No orders here"
                  message="Orders with this status will show here."
                  actionLabel="Show all orders"
                  onAction={() => setFilter('all')}
                />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
