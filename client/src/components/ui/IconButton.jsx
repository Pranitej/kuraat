import { forwardRef } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/cn.js';

const VARIANTS = {
  surface: 'bg-white border border-line-subtle text-maroon hover:bg-cream',
  glass: 'bg-white/[0.14] border border-white/40 text-white hover:bg-white/[0.22] backdrop-blur-sm',
  overlay: 'bg-white/90 text-maroon shadow-float hover:bg-white backdrop-blur-sm',
  maroon: 'bg-maroon text-white hover:bg-maroon-dark',
  viewer: 'bg-white/[0.12] border border-white/25 text-white hover:bg-white/20 backdrop-blur-sm',
  sand: 'bg-sand text-maroon hover:bg-[#EDD2C3]',
  plain: 'text-maroon hover:bg-maroon/[0.06]',
};

const SIZES = { xs: 'size-8', sm: 'size-9', md: 'size-10', lg: 'size-11', xl: 'size-16' };

/** Circular icon button (44 pt in the PDF). Requires an accessible `label`. */
const IconButton = forwardRef(function IconButton(
  { icon: Icon, label, variant = 'surface', size = 'lg', iconSize = 20, strokeWidth = 1.8, to, className, children, badge, type = 'button', ...rest },
  ref,
) {
  const classes = cn(
    'relative inline-grid shrink-0 place-items-center rounded-full transition-[background-color,transform] duration-150 active:scale-95 disabled:opacity-45',
    VARIANTS[variant],
    SIZES[size],
    className,
  );
  const inner = (
    <>
      {Icon ? <Icon size={iconSize} strokeWidth={strokeWidth} aria-hidden /> : children}
      {badge}
    </>
  );
  if (to) {
    return (
      <Link ref={ref} to={to} aria-label={label} title={label} className={classes} {...rest}>
        {inner}
      </Link>
    );
  }
  return (
    <button ref={ref} type={type} aria-label={label} title={label} className={classes} {...rest}>
      {inner}
    </button>
  );
});

export default IconButton;
