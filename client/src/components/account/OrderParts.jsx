import { Link } from 'react-router-dom';
import { Check, ChevronRight, Store, X } from 'lucide-react';
import { Card, Tag } from '@/components/ui';
import { formatOrderDate, formatSAR, orderItemCount, orderStatusView } from '@/domain';
import { ROUTES } from '@/config/routes.js';
import { cn } from '@/lib/cn.js';

/** status: an orderStatusView(). */
export function StatusTag({ status, className }) {
  const icon = status.cancelled ? X : status.id === 'delivered' ? Check : undefined;
  return (
    <Tag tone={status.tone} icon={icon} className={cn('h-7 px-3 text-[13px]', className)}>
      {status.label}
    </Tag>
  );
}

/** "Will be delivered from" / "Delivered from" / "Ordered from" (cancelled). */
export function branchLabel(status) {
  if (status.cancelled) return 'Ordered from';
  return status.ongoing ? 'Will be delivered from' : 'Delivered from';
}

/** Up to three thumbnails, one per unit ordered (PDF screen 20). */
function Thumbnails({ items }) {
  const units = items.flatMap((i) => Array.from({ length: i.qty }, () => i)).slice(0, 3);
  return (
    <div className="flex gap-2">
      {units.map((item, idx) =>
        item.image ? (
          <img key={`${item.productId}-${idx}`} src={item.image} alt="" className="size-12 rounded-sm object-cover" />
        ) : (
          <span key={`${item.productId}-${idx}`} className="size-12 rounded-sm bg-sand" aria-hidden />
        ),
      )}
    </div>
  );
}

/** Order card (PDF screen 20). */
export function OrderCard({ order, now }) {
  const status = orderStatusView(order);
  const count = orderItemCount(order);
  return (
    <Card className="p-4">
      <Link to={ROUTES.order(order.id)} className="block" aria-label={`Order ${order.number}, ${status.label}, ${formatSAR(order.total)}`}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[17px] font-bold leading-6 text-ink">#{order.number}</p>
            <p className="text-label font-normal text-muted">{formatOrderDate(order.createdAt, now)}</p>
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
      {order.branch && (
        <Link to={ROUTES.branch(order.branch.id)} className="mt-3.5 flex items-center gap-3 rounded-lg bg-sand px-4 py-3 transition hover:bg-[#EFD5C7]">
          <Store size={20} strokeWidth={1.8} className="shrink-0 text-maroon" aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="block text-label font-normal text-muted">{branchLabel(status)}</span>
            <span className="block truncate text-[15px] font-bold text-ink">{order.branch.name}</span>
          </span>
          <ChevronRight size={20} strokeWidth={1.8} className="shrink-0 text-ink" aria-hidden />
        </Link>
      )}
    </Card>
  );
}

const lineClass = (next) => (next.state === 'cancelled' ? 'bg-hotpink/40' : next.state !== 'todo' ? 'bg-maroon' : 'bg-divider');

/** Tracking timeline (PDF screen 22); rows from orderTimelineView(). */
export function OrderTimeline({ steps }) {
  return (
    <ol className="flex flex-col">
      {steps.map((step, i) => {
        const last = i === steps.length - 1;
        const reached = step.state !== 'todo';
        return (
          <li key={step.id} className="relative flex gap-4 pb-5 last:pb-0">
            {!last && <span aria-hidden className={cn('absolute left-[10px] top-6 h-[calc(100%-20px)] w-0.5 rounded-pill', lineClass(steps[i + 1]))} />}
            <span
              aria-hidden
              className={cn(
                'relative z-[1] mt-0.5 grid size-[22px] shrink-0 place-items-center rounded-full',
                step.state === 'done' && 'bg-maroon text-white',
                step.state === 'current' && 'border-2 border-maroon bg-white',
                step.state === 'todo' && 'border-2 border-line bg-white',
                step.state === 'cancelled' && 'bg-hotpink text-white',
              )}
            >
              {step.state === 'done' && <Check size={13} strokeWidth={3} />}
              {step.state === 'current' && <span className="size-2.5 rounded-full bg-maroon" />}
              {step.state === 'cancelled' && <X size={13} strokeWidth={3} />}
            </span>
            <div className="min-w-0">
              <p className={cn('text-[16px] font-bold leading-[22px]', step.state === 'cancelled' ? 'text-hotpink' : reached ? 'text-ink' : 'text-muted')}>
                {step.title}
                <span className="sr-only">
                  {step.state === 'done' ? ' — completed' : step.state === 'current' ? ' — in progress' : step.state === 'cancelled' ? '' : ' — upcoming'}
                </span>
              </p>
              <p className="text-label font-normal text-muted">{step.time}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
