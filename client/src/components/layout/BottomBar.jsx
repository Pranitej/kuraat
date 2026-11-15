import { useEffect } from 'react';
import { cn } from '@/lib/cn.js';
import { useElementHeight, useIsDesktop } from '@/hooks';

/**
 * Sticky bottom action bar (PDF: white bar, top shadow, full-width primary CTA).
 * Phones/tablets: fixed to the viewport, with a spacer reserving its height.
 * Desktop (≥1024): rendered inline where it sits in the layout (`inlineOnDesktop`).
 */
export default function BottomBar({ children, inlineOnDesktop = true, className, innerClassName }) {
  const [ref, height] = useElementHeight();
  const isDesktop = useIsDesktop();
  const fixed = !(inlineOnDesktop && isDesktop);

  useEffect(() => {
    if (!fixed) return undefined;
    document.documentElement.style.setProperty('--bottom-bar-h', `${height}px`);
    return () => document.documentElement.style.setProperty('--bottom-bar-h', '0px');
  }, [height, fixed]);

  if (!fixed) {
    return <div className={cn('mt-6', className)}>{children}</div>;
  }

  return (
    <>
      <div aria-hidden style={{ height: height + 12 }} />
      <div ref={ref} className={cn('fixed inset-x-0 bottom-0 z-30 bg-white pb-safe pt-4 shadow-bar', className)}>
        <div className={cn('mx-auto max-w-column px-4', innerClassName)}>{children}</div>
      </div>
    </>
  );
}
