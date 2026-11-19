import { Link } from 'react-router-dom';
import { ChevronRight, ListFilter, Mail, MapPin, Phone, Search, ShoppingBag, Store, X } from 'lucide-react';
import { Avatar, Button, Chip, IconButton, Logo, MaroonPanel, Sheet, Tag } from '@/components/ui';
import { CountBadge } from '@/components/layout/AppBar.jsx';
import LanguageToggle from '@/components/layout/LanguageToggle.jsx';
import { promoBannerPhoto } from '@/assets/images.js';
import { HEAD_OFFICE, SORT_OPTIONS, formatDistance, mapsUrl, telUrl } from '@/domain';
import { ROUTES } from '@/config/routes.js';
import { cn } from '@/lib/cn.js';
import { useScrollY } from '@/hooks';
import { t } from '@/i18n';

/** Mobile home header: logo centred · avatar (pinned with a hairline once scrolled). */
export function HomeHeader({ user }) {
  const scrolled = useScrollY() > 8;
  return (
    <header
      className={cn(
        'sticky top-0 z-20 border-b bg-cream/95 backdrop-blur-sm transition-colors lg:hidden',
        scrolled ? 'border-line-subtle' : 'border-transparent',
      )}
    >
      <div className="mx-auto flex h-[76px] max-w-column items-center justify-between px-5">
        <LanguageToggle className="h-11" />
        <Link to={ROUTES.home} aria-label={t('kuraat home')}>
          <Logo className="w-[116px]" />
        </Link>
        <Link to={ROUTES.profile} aria-label={t('Profile')} className="rounded-full">
          <Avatar name={user?.name} src={user?.avatar} size={44} />
        </Link>
      </div>
    </header>
  );
}

/** Search bar with filter button (mobile/tablet; desktop search lives in the app bar). */
export function SearchBar({ value, onChange, onOpenFilters, filtersActive }) {
  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        document.activeElement?.blur();
      }}
      className="flex h-[52px] items-center gap-3 rounded-pill border border-line bg-white ps-4 pe-1.5 transition focus-within:border-maroon focus-within:shadow-ring"
    >
      <Search size={20} strokeWidth={1.8} className="shrink-0 text-maroon" aria-hidden />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t('Search truffles, cakes, pastries')}
        aria-label={t('Search products')}
        className="h-full min-w-0 flex-1 bg-transparent text-body text-ink outline-none placeholder:text-placeholder [&::-webkit-search-cancel-button]:hidden"
      />
      {value && <IconButton icon={X} label={t('Clear search')} variant="plain" size="sm" iconSize={18} onClick={() => onChange('')} />}
      <IconButton
        icon={ListFilter}
        label={t('Sort and filter')}
        variant="maroon"
        size="md"
        iconSize={19}
        onClick={onOpenFilters}
        badge={filtersActive ? <span className="absolute end-0.5 top-0.5 size-2.5 rounded-full border-2 border-white bg-pink" /> : null}
      />
    </form>
  );
}

/** Sort + category sheet opened from the filter button; no categories → sort only (design 2026-11-18 §5.5). */
export function FilterSheet({ open, onClose, categories = [], category, sort, onApply }) {
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t('Sort & filter')}
      footer={
        <div className="flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={() => onApply({ category: 'all', sort: 'recommended' })}>{t('Reset')}</Button>
          <Button className="flex-1" onClick={onClose}>{t('Show results')}</Button>
        </div>
      }
    >
      <h3 className="mt-2 text-label text-maroon">{t('Sort by')}</h3>
      <div className="mt-2.5 flex flex-wrap gap-2.5">
        {SORT_OPTIONS.map((o) => (
          <Chip key={o.id} active={sort === o.id} onClick={() => onApply({ category, sort: o.id })}>
            {o.label}
          </Chip>
        ))}
      </div>
      {categories.length > 0 && (
        <>
          <h3 className="mt-6 text-label text-maroon">{t('Category')}</h3>
          <div className="mt-2.5 flex flex-wrap gap-2.5 pb-2">
            {categories.map((c) => (
              <Chip key={c.id} active={category === c.id} onClick={() => onApply({ category: c.id, sort })}>
                {c.label}
              </Chip>
            ))}
          </div>
        </>
      )}
    </Sheet>
  );
}

/**
 * "Nearest branch to Al Rakah, Al Khobar · Kuraat · Al Khobar Corniche · 2.4 km" — only when the address has a location.
 * Without one no branch is "nearest" (nothing can be measured), so the same card just opens the branch list.
 */
export function NearestBranchStrip({ delivery, showAll = false, className }) {
  if (!delivery && !showAll) return null;
  const near = Boolean(delivery);
  return (
    <Link
      to={near ? ROUTES.branch(delivery.branch.id) : ROUTES.branches}
      className={cn('flex min-h-16 items-center gap-3 rounded-lg bg-sand px-3.5 py-3 transition hover:bg-[#EFD5C7]', className)}
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-white text-maroon" aria-hidden>
        <Store size={20} strokeWidth={1.8} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-label font-normal text-muted">{near ? t('Nearest branch to {area}', { area: delivery.area }) : t('Find a branch')}</span>
        <span className="block truncate text-[15px] font-bold leading-5 text-ink">{near ? delivery.branch.displayName : t('View all branches')}</span>
      </span>
      {near ? (
        delivery.distanceKm != null && <Tag tone="dark">{formatDistance(delivery.distanceKm)}</Tag>
      ) : (
        <ChevronRight size={20} strokeWidth={1.8} className="shrink-0 text-maroon" aria-hidden />
      )}
    </Link>
  );
}

/** "NEW COLLECTION · Made fresh for every gathering · Shop now" maroon banner. */
export function PromoBanner({ onShop, className }) {
  return (
    <MaroonPanel className={cn('flex min-h-[132px] items-center gap-3 rounded-2xl py-4 ps-5 pe-4 lg:min-h-[220px] lg:px-10', className)}>
      <div className="min-w-0 flex-1">
        <p className="text-overline uppercase text-white/80">{t('New collection')}</p>
        <h2 className="mt-1 text-[22px] font-bold leading-[27px] lg:text-[32px] lg:leading-10">{t('Made fresh for every gathering')}</h2>
        <Button variant="white" size="sm" rightIcon={ChevronRight} className="mt-3 h-[44px] px-5 lg:mt-5" onClick={onShop}>{t('Shop now')}</Button>
      </div>
      <div className="size-[108px] shrink-0 overflow-hidden rounded-full border-[3px] border-cream/90 lg:size-[180px]">
        <img src={promoBannerPhoto} alt="" className="size-full object-cover" />
      </div>
    </MaroonPanel>
  );
}

/** Maroon "Contact us" footer (PDF screen 08). */
export function ContactSection() {
  const rows = [
    { icon: MapPin, label: t('Head office'), value: HEAD_OFFICE.address, href: mapsUrl(HEAD_OFFICE.location, 'kuraat head office'), external: true },
    { icon: Phone, label: t('Support · {hours}', { hours: HEAD_OFFICE.supportHours }), value: HEAD_OFFICE.supportPhone, href: telUrl(HEAD_OFFICE.supportPhone) },
    { icon: Mail, label: t('Email'), value: HEAD_OFFICE.email, href: `mailto:${HEAD_OFFICE.email}` },
  ];
  return (
    <MaroonPanel as="footer" className="mt-10 rounded-t-sheet lg:mt-16" fade="edges">
      <div className="mx-auto max-w-column px-6 pb-28 pt-8 lg:max-w-app lg:px-8 lg:pb-12 lg:pt-10">
        <h2 className="text-heading">{t('Contact us')}</h2>
        <ul className="mt-5 flex flex-col gap-4 lg:grid lg:grid-cols-3 lg:gap-8">
          {rows.map((r) => (
            <li key={r.label}>
              <a
                href={r.href}
                target={r.external ? '_blank' : undefined}
                rel={r.external ? 'noreferrer' : undefined}
                className="group flex items-center gap-3.5"
              >
                <span className="grid size-11 shrink-0 place-items-center rounded-full bg-white/[0.14] transition group-hover:bg-white/25" aria-hidden>
                  <r.icon size={20} strokeWidth={1.8} />
                </span>
                <span className="min-w-0">
                  <span className="block text-label font-normal text-white/75">{r.label}</span>
                  <span className="block text-[15px] font-bold leading-5 group-hover:underline">{r.value}</span>
                </span>
              </a>
            </li>
          ))}
        </ul>
        <div className="mt-8 hidden items-center justify-between border-t border-white/15 pt-6 lg:flex">
          <Logo tone="white" className="w-[96px]" />
          <p lang="ar" dir="rtl" className="font-arabic text-[18px] font-bold">كُرات شريك الجمعات</p>
        </div>
      </div>
    </MaroonPanel>
  );
}

/** Floating cart button with counter (mobile/tablet). */
export function CartFab({ count }) {
  return (
    <Link
      to={ROUTES.cart}
      aria-label={t('Cart, {count} items', { count })}
      className="fixed bottom-[max(24px,env(safe-area-inset-bottom))] end-5 z-30 grid size-16 place-items-center rounded-full bg-maroon text-white shadow-fab transition hover:bg-maroon-dark active:scale-95 lg:hidden"
    >
      <ShoppingBag size={26} strokeWidth={1.8} aria-hidden />
      <CountBadge count={count} className="-end-0.5 -top-0.5 size-6 border-[3px] text-[12px]" />
    </Link>
  );
}
