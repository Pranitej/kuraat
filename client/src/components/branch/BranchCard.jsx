import { forwardRef } from 'react';
import { Link } from 'react-router-dom';
import { Clock, Navigation, Phone, Store } from 'lucide-react';
import { Button, Tag } from '@/components/ui';
import { branchTypeLabel, directionsUrl, formatDistance, formatHours, telUrl } from '@/domain';
import { ROUTES } from '@/config/routes.js';
import { cn } from '@/lib/cn.js';
import { t } from '@/i18n';

function OpenLine({ branch, distanceKm, showDistance }) {
  const open = branch.openNow; // from the server, in Saudi time
  return (
    <p className="flex items-center gap-1.5 text-small">
      <Clock size={16} strokeWidth={1.8} className="shrink-0 text-ink" aria-hidden />
      <span className="font-semibold text-ink">
        {open ? t('Open') : t('Closed')} · {formatHours(branch.hours)}
      </span>
      {showDistance && distanceKm != null && <span className="text-muted">· {formatDistance(distanceKm)}</span>}
    </p>
  );
}

/** Home carousel card (PDF screen 08). */
export function BranchTeaserCard({ branch, distanceKm, className }) {
  return (
    <Link
      to={ROUTES.branch(branch.id)}
      className={cn('flex w-[254px] shrink-0 flex-col rounded-xl border border-line-subtle bg-white p-4 transition hover:shadow-float lg:w-auto', className)}
    >
      <div className="flex items-center justify-between">
        <Tag icon={Store}>{t('Branch')}</Tag>
        {distanceKm != null && <span className="text-small font-bold text-ink">{formatDistance(distanceKm)}</span>}
      </div>
      <h3 className="mt-3 truncate text-[17px] font-bold leading-6 text-ink">{branch.name}</h3>
      <p className="mt-0.5 line-clamp-2 min-h-[40px] text-small text-muted">{branch.address}</p>
      <div className="mt-3">
        <OpenLine branch={branch} />
      </div>
    </Link>
  );
}

/** Branch directory card (PDF screen 25). */
export const BranchListCard = forwardRef(function BranchListCard({ branch, distanceKm, nearest, highlighted, onFocus }, ref) {
  return (
    <article
      ref={ref}
      onMouseEnter={onFocus}
      className={cn(
        'scroll-mt-28 rounded-xl border bg-white p-4 transition-[border-color,box-shadow] duration-300',
        highlighted ? 'border-maroon shadow-ring' : 'border-line-subtle',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-[17px] font-bold leading-6 text-ink">{branch.name}</h3>
        {nearest && <Tag tone="dark">{t('Nearest to you')}</Tag>}
      </div>
      {/* RSOF's branch type (hub / master / …), small and muted so customers can tell the branches apart. */}
      {branchTypeLabel(branch.type) && <p className="mt-0.5 text-label font-normal text-muted">{branchTypeLabel(branch.type)}</p>}
      <p className="mt-1 text-small text-muted">{branch.address}</p>
      <div className="mt-2.5">
        <OpenLine branch={branch} distanceKm={distanceKm} showDistance />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <Button variant="secondary" size="md" leftIcon={Phone} href={telUrl(branch.phone)} aria-label={t('Call {name}, {phone}', { name: branch.name, phone: branch.phone })}>{t('Call')}</Button>
        <Button size="md" leftIcon={Navigation} href={directionsUrl(branch.location)} target="_blank" rel="noreferrer">{t('Directions')}</Button>
      </div>
    </article>
  );
});
