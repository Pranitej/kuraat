import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Search, ShoppingBag, X } from 'lucide-react';
import { Avatar, IconButton, Logo } from '@/components/ui';
import { useAuth } from '@/context/AuthContext.jsx';
import { useCart } from '@/context/CartContext.jsx';
import { ROUTES } from '@/config/routes.js';
import { cn } from '@/lib/cn.js';

export function CountBadge({ count, className }) {
  if (!count) return null;
  return (
    <span
      className={cn(
        'absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-pill border-2 border-cream bg-maroon px-1 text-[11px] font-bold leading-none text-white',
        className,
      )}
    >
      {count > 99 ? '99+' : count}
    </span>
  );
}

const NAV = [
  { to: ROUTES.home, label: 'Shop' },
  { to: ROUTES.branches, label: 'Branches' },
  { to: ROUTES.orders, label: 'Orders' },
];

/** Desktop app bar (≥1024): logo · search · nav · cart · profile. */
export default function AppBar() {
  const { user } = useAuth();
  const { count } = useCart();
  const location = useLocation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const onHome = location.pathname === ROUTES.home;
  const [query, setQuery] = useState(onHome ? params.get('q') || '' : '');

  useEffect(() => {
    if (onHome) setQuery(params.get('q') || '');
  }, [onHome, params]);

  const submit = (value) => {
    const q = value.trim();
    const next = new URLSearchParams(onHome ? params : undefined);
    if (q) next.set('q', q);
    else next.delete('q');
    navigate({ pathname: ROUTES.home, search: next.toString() ? `?${next}` : '' }, { replace: onHome });
  };

  return (
    <header className="sticky top-0 z-40 hidden border-b border-line-subtle bg-cream/90 backdrop-blur-md lg:block">
      <div className="mx-auto flex h-[76px] max-w-app items-center gap-8 px-8">
        <Link to={ROUTES.home} aria-label="kuraat home" className="shrink-0">
          <Logo className="w-[104px]" />
        </Link>

        <form
          role="search"
          className="flex h-12 max-w-[440px] flex-1 items-center gap-3 rounded-pill border border-line bg-white pl-4 pr-1.5 transition focus-within:border-maroon focus-within:shadow-ring"
          onSubmit={(e) => {
            e.preventDefault();
            submit(query);
          }}
        >
          <Search size={20} strokeWidth={1.8} className="shrink-0 text-maroon" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              if (onHome) submit(e.target.value);
            }}
            placeholder="Search truffles, cakes, pastries"
            aria-label="Search products"
            className="h-full min-w-0 flex-1 bg-transparent text-body text-ink outline-none placeholder:text-placeholder [&::-webkit-search-cancel-button]:hidden"
          />
          {query && (
            <IconButton icon={X} label="Clear search" variant="plain" size="sm" iconSize={18} onClick={() => { setQuery(''); submit(''); }} />
          )}
        </form>

        <nav className="ml-auto flex items-center gap-1" aria-label="Main">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  'rounded-pill px-4 py-2 text-[15px] font-semibold transition-colors',
                  isActive ? 'bg-sand text-maroon' : 'text-ink hover:bg-sand/60',
                )
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <IconButton icon={ShoppingBag} label={`Cart, ${count} items`} to={ROUTES.cart} badge={<CountBadge count={count} />} />
          <Link to={ROUTES.profile} aria-label="Profile" className="rounded-full transition hover:opacity-90">
            <Avatar name={user?.name} src={user?.avatar} size={44} />
          </Link>
        </div>
      </div>
    </header>
  );
}
