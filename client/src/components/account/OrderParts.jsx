import { Link } from 'react-router-dom';
import { Check, ChevronRight, Store } from 'lucide-react';
import { Card, Tag } from '@/components/ui';
import { productImage } from '@/assets/images.js';
import { formatOrderDate, formatSAR, getBranch, getProduct, orderItemCount, orderStatus } from '@/domain';
import { ROUTES } from '@/config/routes.js';
import { cn } from '@/lib/cn.js';

export function StatusTag({ status, className }) {
  return (
    <Tag tone={status.tone} icon={status.id === 'delivered' ? Check : undefined} className={cn('h-7 px-3 text-[13px]', className)}>
      {status.label}
    </Tag>
  );
}

/** Up to three thumbnails, one per unit ordered (PDF screen 20). */
function Thumbnails({ items }) {
  const units = items.flatMap((i) => Array.from({ length: i.qty }, () => i.productId)).slice(0, 3);
  return (
    <div className="flex gap-2">
      {units.map((id, idx) => {
        const p = getProduct(id);
        return <img key={`${id}-${idx}`} src={productImage(p.images[0])} alt="" className="size-12 rounded-sm object-cover" style={{ objectPosition: p.cardFocus }} />;
      })}
    </div>
  );
}

/** Order card (PDF screen 20). */
export function OrderCard({ order, now }) {
  const status = orderStatus(order, now);
  const branch = getBranch(order.branchId);
  const count = orderItemCount(order);
  return (
    <Card className="p-4">
      <Link to={ROUTES.order(order.id)} className="block" aria-label={`Order ${order.id}, ${status.label}, ${formatSAR(order.total)}`}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[17px] font-bold leading-6 text-ink">#{order.id}</p>
            <p className="text-label font-normal text-muted">{formatOrderDate(order.schedule.createdAt, now)}</p>
          </div>
          <StatusTag status={status} />
        </div>
        <div className="mt-3 flex items-end justify-between gap-3">
          <Thumbnails items={order.items} />
          <div className="text-right">
            <p className="text-small text-muted">
              {count} {count === 1 ? 'item' : 'items'}
            </p>
            <p className="tabular text-[18px] font-bold leading-6 text-ink">{formatSAR(order.total)}</p>
          </div>
        </div>
      </Link>
      <Link to={ROUTES.branch(branch.id)} className="mt-3.5 flex items-center gap-3 rounded-lg bg-sand px-4 py-3 transition hover:bg-[#EFD5C7]">
        <Store size={20} strokeWidth={1.8} className="shrink-0 text-maroon" aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block text-label font-normal text-muted">{status.ongoing ? 'Will be delivered from' : 'Delivered from'}</span>
          <span className="block truncate text-[15px] font-bold text-ink">{branch.displayName}</span>
        </span>
        <ChevronRight size={20} strokeWidth={1.8} className="shrink-0 text-ink" aria-hidden />
      </Link>
    </Card>
  );
}

/** Tracking timeline (PDF screen 22). */
export function OrderTimeline({ steps }) {
  return (
    <ol className="flex flex-col">
      {steps.map((step, i) => {
        const last = i === steps.length - 1;
        const reached = step.state !== 'todo';
        return (
          <li key={step.id} className="relative flex gap-4 pb-5 last:pb-0">
            {!last && (
              <span
                aria-hidden
                className={cn('absolute left-[10px] top-6 h-[calc(100%-20px)] w-0.5 rounded-pill', steps[i + 1].state !== 'todo' ? 'bg-maroon' : 'bg-divider')}
              />
            )}
            <span
              aria-hidden
              className={cn(
                'relative z-[1] mt-0.5 grid size-[22px] shrink-0 place-items-center rounded-full',
                step.state === 'done' && 'bg-maroon text-white',
                step.state === 'current' && 'border-2 border-maroon bg-white',
                step.state === 'todo' && 'border-2 border-line bg-white',
              )}
            >
              {step.state === 'done' && <Check size={13} strokeWidth={3} />}
              {step.state === 'current' && <span className="size-2.5 rounded-full bg-maroon" />}
            </span>
            <div className="min-w-0">
              <p className={cn('text-[16px] font-bold leading-[22px]', reached ? 'text-ink' : 'text-muted')}>
                {step.title}
                <span className="sr-only">{step.state === 'done' ? ' — completed' : step.state === 'current' ? ' — in progress' : ' — upcoming'}</span>
              </p>
              <p className="text-label font-normal text-muted">{step.time}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
