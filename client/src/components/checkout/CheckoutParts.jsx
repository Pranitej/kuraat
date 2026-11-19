import { Fragment } from 'react';
import { Link } from 'react-router-dom';
import { Check, Store, Trash2 } from 'lucide-react';
import { Card, IconButton, QuantityStepper, SummaryRow } from '@/components/ui';
import { formatSAR, lineWarning } from '@/domain';
import { ROUTES } from '@/config/routes.js';
import { cn } from '@/lib/cn.js';
import { useIsDesktop } from '@/hooks';
import { localized, t } from '@/i18n';

const STEPS = localized(['Cart', 'Delivery', 'Payment']);

/** 1 Cart —— 2 Delivery —— 3 Payment */
export function CheckoutSteps({ current }) {
  return (
    <ol className="flex items-center gap-2.5" aria-label={t('Checkout progress')}>
      {STEPS.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <Fragment key={label}>
            <li className="flex shrink-0 items-center gap-2" aria-current={active ? 'step' : undefined}>
              <span
                className={cn(
                  'grid size-6 place-items-center rounded-full text-[13px] font-bold',
                  done || active ? 'bg-maroon text-white' : 'bg-sand text-maroon',
                )}
              >
                {done ? <Check size={14} strokeWidth={3} aria-label={t('Done')} /> : i + 1}
              </span>
              <span className={cn('text-small font-semibold', done || active ? 'text-ink' : 'text-muted')}>{label}</span>
            </li>
            {i < STEPS.length - 1 && <li aria-hidden className={cn('h-[1.5px] flex-1 rounded-pill', done ? 'bg-maroon' : 'bg-divider')} />}
          </Fragment>
        );
      })}
    </ol>
  );
}

/** Cart line (PDF screen 12). Server warnings (price, stock) show under the name in hot pink. */
export function CartItemCard({ line, branchName, onQty, onRemove }) {
  const { product, qty, lineTotal } = line;
  const name = product?.name ?? t('This product');
  const warning = lineWarning(line);
  return (
    <Card className="relative flex gap-3 p-3.5">
      {product ? (
        <Link to={ROUTES.product(product.id)} className="size-[88px] shrink-0 overflow-hidden rounded-sm bg-sand" tabIndex={-1} aria-hidden>
          {product.image && <img src={product.image} alt="" className="size-full object-cover" />}
        </Link>
      ) : (
        <span className="size-[88px] shrink-0 rounded-sm bg-sand" aria-hidden />
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        {product ? (
          <Link to={ROUTES.product(product.id)} className="pe-8 text-[16px] font-bold leading-[21px] text-ink hover:underline">
            {name}
          </Link>
        ) : (
          <p className="pe-8 text-[16px] font-bold leading-[21px] text-ink">{name}</p>
        )}
        {product?.meta && <p className="text-label font-normal text-muted">{product.meta}</p>}
        {branchName && line.available && (
          <p className="mt-1 flex min-w-0 items-center gap-1.5 text-label text-maroon">
            <Store size={15} strokeWidth={1.9} className="shrink-0" aria-hidden />
            <span className="truncate">{t('From {branchName}', { branchName })}</span>
          </p>
        )}
        {warning && (
          <p role="status" className="mt-1 text-label font-semibold text-hotpink">
            {warning}
          </p>
        )}
        <div className="mt-2 flex items-center justify-between gap-2">
          {line.available ? (
            <QuantityStepper value={qty} onChange={onQty} onMinReached={onRemove} max={line.maxQuantity || 20} label={t('Quantity of {name}', { name })} />
          ) : (
            <span />
          )}
          <span className="tabular whitespace-nowrap text-[16px] font-bold text-ink">{formatSAR(lineTotal)}</span>
        </div>
      </div>
      <IconButton icon={Trash2} label={t('Remove {name}', { name })} variant="plain" size="sm" iconSize={19} className="absolute end-2 top-2" onClick={onRemove} />
    </Card>
  );
}

/** Totals card: the items and their total (RSOF's product prices only). */
export function OrderSummary({ totals, className, children, title }) {
  return (
    <Card className={cn('p-4', className)}>
      {title && <h2 className="mb-3 text-h3 text-ink">{title}</h2>}
      <div className="flex flex-col gap-3">
        <SummaryRow label={totals.count === 1 ? t('Subtotal (1 item)') : t('Subtotal ({count} items)', { count: totals.count })} value={formatSAR(totals.subtotal)} />
      </div>
      <div className="my-3.5 h-[2px] rounded-pill bg-divider" />
      <div className="flex items-baseline justify-between gap-4">
        <span className="text-[16px] font-bold text-ink">{t('Total')}</span>
        <span className="tabular text-[22px] font-bold text-maroon">{formatSAR(totals.total)}</span>
      </div>
      {children}
    </Card>
  );
}

/** Desktop checkout frame: content left, sticky summary right. Mobile: single column. */
export function CheckoutLayout({ header, steps, children, aside }) {
  const isDesktop = useIsDesktop();
  return (
    <div className="pb-6">
      <div className="mx-auto max-w-column lg:max-w-[1080px] lg:px-8">{header}</div>
      <div className="mx-auto max-w-column px-5 lg:max-w-[1080px] lg:px-8">
        {steps}
        <div className="mt-4 lg:mt-8 lg:grid lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start lg:gap-10">
          <div className="min-w-0">{children}</div>
          {aside && isDesktop && <aside className="sticky top-[100px]">{aside}</aside>}
        </div>
      </div>
    </div>
  );
}
