import { forwardRef } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/cn.js';
import Spinner from './Spinner.jsx';

const SIZES = {
  lg: 'h-[54px] px-6 text-button gap-2.5',
  md: 'h-[46px] px-5 text-[15px] leading-5 font-semibold gap-2',
  sm: 'h-11 px-5 text-[15px] leading-5 font-bold gap-2',
  xs: 'h-9 px-4 text-small font-semibold gap-1.5',
};

const VARIANTS = {
  primary: 'bg-maroon text-white hover:bg-maroon-dark active:bg-maroon-dark',
  secondary: 'bg-transparent text-maroon border border-maroon hover:bg-maroon/[0.04] active:bg-maroon/[0.08]',
  white: 'bg-white text-maroon hover:bg-cream',
  glass: 'bg-white/[0.06] text-white border border-white/60 hover:bg-white/[0.12]',
  ghost: 'bg-transparent text-maroon hover:bg-maroon/[0.05]',
  sand: 'bg-sand text-maroon hover:bg-[#EDD2C3]',
};

/**
 * Pill button (PDF: Primary / Secondary). Renders a <Link> when `to` is given, <a> for `href`.
 */
const Button = forwardRef(function Button(
  { variant = 'primary', size = 'lg', block = false, loading = false, leftIcon: Left, rightIcon: Right, iconSize, to, href, className, children, disabled, type = 'button', ...rest },
  ref,
) {
  const icon = iconSize ?? (size === 'lg' ? 20 : 18);
  const classes = cn(
    'relative inline-flex select-none items-center justify-center whitespace-nowrap rounded-pill font-bold transition-[background-color,box-shadow,transform,opacity] duration-150 active:scale-[0.985] disabled:pointer-events-none disabled:opacity-45',
    SIZES[size],
    VARIANTS[variant],
    block && 'w-full',
    className,
  );
  const content = (
    <>
      <span className={cn('inline-flex items-center justify-center gap-[inherit]', loading && 'invisible')}>
        {Left && <Left size={icon} strokeWidth={1.9} aria-hidden />}
        {children}
        {Right && <Right size={icon} strokeWidth={2} aria-hidden />}
      </span>
      {loading && (
        <span className="absolute inset-0 grid place-items-center">
          <Spinner size={22} />
        </span>
      )}
    </>
  );

  if (to) {
    return (
      <Link ref={ref} to={to} className={classes} {...rest}>
        {content}
      </Link>
    );
  }
  if (href) {
    return (
      <a ref={ref} href={href} className={classes} {...rest}>
        {content}
      </a>
    );
  }
  return (
    <button ref={ref} type={type} className={classes} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {content}
    </button>
  );
});

export default Button;
