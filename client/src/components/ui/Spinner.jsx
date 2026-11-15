import { cn } from '@/lib/cn.js';

export default function Spinner({ size = 20, className, label = 'Loading' }) {
  return (
    <svg
      role="status"
      aria-label={label}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={cn('animate-spin', className)}
      fill="none"
    >
      <circle cx="12" cy="12" r="9.5" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2.5" />
      <path d="M21.5 12a9.5 9.5 0 0 0-9.5-9.5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}
