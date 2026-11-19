import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { formatSAR } from '@/domain';
import { ROUTES } from '@/config/routes.js';
import { useCart } from '@/context/CartContext.jsx';
import { useToast } from '@/context/ToastContext.jsx';
import { cn } from '@/lib/cn.js';
import { t } from '@/i18n';

/** Product card (PDF screens 07/08): photo, name, meta, price, "+" add button. */
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
    toast.show(`${product.name} added to your cart`, { action: { label: t('View cart'), onClick: () => navigate(ROUTES.cart) } });
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
      </div>
      <div className="flex flex-1 flex-col px-3.5 pb-3 pt-3.5">
        <h3 className="line-clamp-2 text-[15px] font-semibold leading-5 text-ink lg:text-[16px]">{product.name}</h3>
        {product.meta && <p className="mt-0.5 text-label font-normal text-muted">{product.meta}</p>}
        <div className="mt-auto flex items-center justify-between gap-2 pt-3">
          <span className="text-[16px] font-bold text-maroon">{formatSAR(product.price, { decimals: 0 })}</span>
          <button
            type="button"
            onClick={quickAdd}
            aria-label={t('Add {name} to cart', { name: product.name })}
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
