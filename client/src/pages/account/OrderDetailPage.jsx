import { Link, useParams } from 'react-router-dom';
import { Navigation, PackageSearch, Phone, Store } from 'lucide-react';
import ScreenHeader from '@/components/layout/ScreenHeader.jsx';
import { Button, Card, EmptyState, MaroonPanel, SummaryRow } from '@/components/ui';
import { OrderTimeline, StatusTag } from '@/components/account/OrderParts.jsx';
import { productImage } from '@/assets/images.js';
import { useOrders } from '@/context/OrderContext.jsx';
import { directionsUrl, formatAddress, formatPhone, formatSAR, getBranch, getProduct, orderStatus, orderTimeline, paymentLabel, telUrl } from '@/domain';
import { ROUTES } from '@/config/routes.js';
import { useDocumentTitle } from '@/hooks';

/** 22 · Order detail / tracking */
export default function OrderDetailPage() {
  const { orderId } = useParams();
  const { getById, now, loading } = useOrders();
  const order = getById(orderId);
  useDocumentTitle(order ? `Order #${order.id}` : 'Order');

  if (!order) {
    return (
      <div className="mx-auto max-w-column lg:max-w-[720px]">
        <ScreenHeader title="Order" backFallback={ROUTES.orders} />
        {!loading && (
          <EmptyState icon={PackageSearch} title="Order not found" message="We could not find this order on your account." actionLabel="View my orders" actionTo={ROUTES.orders} />
        )}
      </div>
    );
  }

  const status = orderStatus(order, now);
  const branch = getBranch(order.branchId);
  const steps = orderTimeline(order, now);

  return (
    <div className="pb-10">
      <div className="mx-auto max-w-column lg:max-w-[1080px] lg:px-8">
        <ScreenHeader title={`Order #${order.id}`} backFallback={ROUTES.orders} right={<StatusTag status={status} />} />
      </div>
      <div className="mx-auto max-w-column px-5 lg:grid lg:max-w-[1080px] lg:grid-cols-2 lg:items-start lg:gap-8 lg:px-8">
        <div className="flex flex-col gap-3 lg:gap-5">
          <Card className="p-4">
            <OrderTimeline steps={steps} />
          </Card>

          <MaroonPanel className="rounded-xl p-4">
            <div className="flex items-center gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-full bg-white/[0.16]" aria-hidden>
                <Store size={20} strokeWidth={1.8} />
              </span>
              <div className="min-w-0">
                <p className="text-label font-normal text-white/80">{status.ongoing ? 'Will be delivered from' : 'Delivered from'}</p>
                <Link to={ROUTES.branch(branch.id)} className="block truncate text-[18px] font-bold leading-6 hover:underline">
                  {branch.displayName}
                </Link>
              </div>
            </div>
            <p className="mt-2.5 text-small text-white/90">{branch.address}</p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Button variant="glass" size="sm" leftIcon={Phone} href={telUrl(branch.phone)}>
                Call branch
              </Button>
              <Button variant="glass" size="sm" leftIcon={Navigation} href={directionsUrl(branch.location)} target="_blank" rel="noreferrer">
                Directions
              </Button>
            </div>
          </MaroonPanel>
        </div>

        <div className="mt-3 flex flex-col gap-3 lg:mt-0 lg:gap-5">
          <Card className="p-4">
            <ul className="flex flex-col gap-3">
              {order.items.map((item) => {
                const p = getProduct(item.productId);
                return (
                  <li key={item.productId}>
                    <Link to={ROUTES.product(p.id)} className="flex items-center gap-3.5 rounded-md transition hover:bg-cream/60">
                      <img src={productImage(p.images[0])} alt="" className="size-14 shrink-0 rounded-sm object-cover" style={{ objectPosition: p.cardFocus }} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[16px] font-semibold text-ink">{p.name}</span>
                        <span className="block text-label font-normal text-muted">Qty {item.qty}</span>
                      </span>
                      <span className="tabular text-[15px] font-bold text-ink">{formatSAR(item.price * item.qty)}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
            <div className="my-3.5 h-px bg-divider" />
            <div className="flex flex-col gap-2.5">
              {order.discount > 0 && <SummaryRow label={`Discount (${order.promoCode})`} value={`− ${formatSAR(order.discount)}`} />}
              <SummaryRow label="Delivery" value={order.delivery === 0 ? 'Free' : formatSAR(order.delivery)} />
              <SummaryRow label="Total (incl. VAT)" value={formatSAR(order.total)} />
            </div>
          </Card>

          <Card className="p-4">
            <dl className="flex flex-col gap-3">
              {[
                ['Deliver to', formatAddress(order.address)],
                ['Phone', formatPhone(order.deliveryPhone)],
                ['Payment', paymentLabel(order.payment)],
              ].map(([label, value]) => (
                <div key={label} className="flex items-start justify-between gap-6">
                  <dt className="shrink-0 text-body text-muted">{label}</dt>
                  <dd className="text-right text-[15px] font-semibold leading-[21px] text-ink">{value}</dd>
                </div>
              ))}
            </dl>
          </Card>
        </div>
      </div>
    </div>
  );
}
