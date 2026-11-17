import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Heart, Plus } from 'lucide-react';
import { formatSAR } from '@/domain';
import { ROUTES } from '@/config/routes.js';
import { useCart } from '@/context/CartContext.jsx';
import { useFavorites } from '@/context/FavoritesContext.jsx';
import { useToast } from '@/context/ToastContext.jsx';
import { cn } from '@/lib/cn.js';

export function FavoriteButton({ productId, productName, className, size = 34 }) {
  const { isFavorite, toggle } = useFavorites();
  const toast = useToast();
  const navigate = useNavigate();
  const active = isFavorite(productId);
  const [pop, setPop] = useState(0);
  const notify = (added) =>
    toast.show(added ? 'Saved to your favourites' : 'Removed from your favourites', {
      tone: 'info',
      duration: 1800,
      action: added
        ? { label: 'View', onClick: () => navigate(ROUTES.favorites) }
        : { label: 'Undo', onClick: () => notify(toggle(productId)) },
    });
  return (
    <button
      type="button"
      aria-label={active ? `Remove ${productName} from favourites` : `Save ${productName} to favourites`}
      aria-pressed={active}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setPop((p) => p + 1);
        notify(toggle(productId));
      }}
      className={cn('grid place-items-center rounded-full bg-white/90 text-maroon backdrop-blur-sm transition hover:bg-white active:scale-90', className)}
      style={{ width: size, height: size }}
    >
      <Heart key={pop} size={Math.round(size * 0.55)} strokeWidth={1.9} className={cn(pop > 0 && 'animate-pop')} fill={active ? 'currentColor' : 'none'} />
    </button>
  );
}

/** Product card (PDF screens 07/08): photo, heart, name, meta, price, "+" add button. */
export default function ProductCard({ product, className, style }) {
  const { add } = useCart();
  const toast = useToast();
  const navigate = useNavigate();
  const [added, setAdded] = useState(0);

  const quickAdd = (e) => {
    e.preventDefault();
    e.stopPropagation();
    add(product.id, 1);
    setAdded((n) => n + 1);
    toast.show(`${product.name} added to your cart`, { action: { label: 'View cart', onClick: () => navigate(ROUTES.cart) } });
  };

  return (
    <Link
      to={ROUTES.product(product.id)}
      style={style}
      className={cn(
        'group flex flex-col overflow-hidden rounded-xl border border-line-subtle bg-white transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-float',
        className,
      )}
    >
      <div className="relative aspect-[167/158] overflow-hidden bg-sand">
        {product.images[0] && (
          <img
            src={product.images[0]}
            alt={product.name}
            loading="lazy"
            className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
        )}
        <FavoriteButton productId={product.id} productName={product.name} className="absolute right-2 top-2" />
      </div>
      <div className="flex flex-1 flex-col px-3.5 pb-3 pt-3.5">
        <h3 className="line-clamp-2 text-[15px] font-semibold leading-5 text-ink lg:text-[16px]">{product.name}</h3>
        {product.meta && <p className="mt-0.5 text-label font-normal text-muted">{product.meta}</p>}
        <div className="mt-auto flex items-center justify-between gap-2 pt-3">
          <span className="text-[16px] font-bold text-maroon">{formatSAR(product.price, { decimals: 0 })}</span>
          <button
            type="button"
            onClick={quickAdd}
            aria-label={`Add ${product.name} to cart`}
            className="grid size-9 place-items-center rounded-full bg-maroon text-white transition hover:bg-maroon-dark active:scale-90"
          >
            <Plus key={added} size={20} strokeWidth={2} className={cn(added > 0 && 'animate-pop')} />
          </button>
        </div>
      </div>
    </Link>
  );
}

export function ProductCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl border border-line-subtle bg-white">
      <div className="skeleton aspect-[167/158]" />
      <div className="space-y-2 p-3.5">
        <div className="skeleton h-4 w-3/4 rounded" />
        <div className="skeleton h-3 w-1/2 rounded" />
        <div className="flex items-center justify-between pt-2">
          <div className="skeleton h-4 w-16 rounded" />
          <div className="skeleton size-9 rounded-full" />
        </div>
      </div>
    </div>
  );
}
