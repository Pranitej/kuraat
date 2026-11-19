import { Store, Truck } from 'lucide-react';
import { Tag } from '@/components/ui';
import { formatDistance } from '@/domain';
import { cn } from '@/lib/cn.js';
import { t } from '@/i18n';

/**
 * "Will be delivered from <branch>" sand card — repeated across product, cart, delivery and orders
 * (a core idea of the product). Icon sits in a white circle.
 */
export default function DeliveryFromCard({ branch, distanceKm, meta, icon = 'truck', label = t('Will be delivered from'), showDistance = false, className, onClick }) {
  if (!branch) return null;
  const Icon = icon === 'store' ? Store : Truck;
  const As = onClick ? 'button' : 'div';
  return (
    <As
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={cn('flex w-full items-center gap-3.5 rounded-lg bg-sand px-4 py-3.5 text-start', onClick && 'transition hover:bg-[#EFD5C7]', className)}
    >
      <span className="grid size-11 shrink-0 place-items-center rounded-full bg-white text-maroon" aria-hidden>
        <Icon size={21} strokeWidth={1.8} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-label font-normal text-muted">{label}</span>
        <span className="block truncate text-[16px] font-bold leading-[22px] text-ink">{branch.displayName}</span>
        {meta && <span className="mt-0.5 block text-small text-muted">{meta}</span>}
      </span>
      {showDistance && distanceKm != null && <Tag tone="dark">{formatDistance(distanceKm)}</Tag>}
    </As>
  );
}
