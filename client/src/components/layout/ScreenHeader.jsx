import { ChevronLeft } from 'lucide-react';
import IconButton from '@/components/ui/IconButton.jsx';
import { cn } from '@/lib/cn.js';
import { useGoBack, useScrollY } from '@/hooks';

export function BackButton({ fallback = '/home', variant = 'surface', onClick, label = 'Back', className }) {
  const goBack = useGoBack(fallback);
  return <IconButton icon={ChevronLeft} label={label} variant={variant} iconSize={22} strokeWidth={2} onClick={onClick || goBack} className={className} />;
}

/**
 * Screen header (PDF: 44 back button · centred 20/700 title · optional right element).
 * Sticky on phones with a hairline once the page scrolls; static inside the desktop layout.
 */
export default function ScreenHeader({ title, back = true, backFallback = '/home', onBack, right, className, sticky = true }) {
  const y = useScrollY();
  const scrolled = y > 8;
  return (
    <header
      className={cn(
        'z-20 bg-cream/95 backdrop-blur-sm transition-[border-color] duration-150 lg:static lg:bg-transparent lg:backdrop-blur-none',
        sticky && 'sticky top-0',
        'border-b',
        scrolled && sticky ? 'border-line-subtle lg:border-transparent' : 'border-transparent',
        className,
      )}
    >
      <div className="mx-auto grid min-h-[76px] max-w-column grid-cols-[1fr_auto_1fr] items-center gap-3 px-5 py-4 lg:min-h-0 lg:max-w-none lg:px-0 lg:pb-6 lg:pt-8">
        <div className="flex justify-start">{back && <BackButton fallback={backFallback} onClick={onBack} />}</div>
        <h1 className="max-w-[60vw] truncate text-center text-heading text-ink lg:max-w-none">{title}</h1>
        <div className="flex justify-end">{right}</div>
      </div>
    </header>
  );
}
