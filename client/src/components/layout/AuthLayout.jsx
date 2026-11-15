import { Logo, MaroonPanel } from '@/components/ui';
import { BackButton } from './ScreenHeader.jsx';

/**
 * Auth screens (PDF 03–06): maroon gradient header with glass back button and large white title,
 * followed by a cream sheet with 28 pt top corners. On desktop the header becomes the left brand panel.
 */
export default function AuthLayout({ title, subtitle, children, backFallback = '/welcome', onBack, showBack = true }) {
  return (
    <div className="min-h-dvh bg-cream lg:grid lg:grid-cols-[minmax(440px,46%)_1fr]">
      <MaroonPanel className="h-[228px] lg:sticky lg:top-0 lg:h-dvh" fade="down">
        <div className="mx-auto flex h-full max-w-column flex-col px-6 pb-[52px] pt-4 lg:max-w-none lg:px-14 lg:pb-14 lg:pt-12">
          <div className="flex items-center justify-between">
            {showBack ? <BackButton variant="glass" fallback={backFallback} onClick={onBack} /> : <span />}
            <Logo tone="white" className="hidden w-[132px] lg:block" />
          </div>
          <h1 className="mt-auto max-w-[232px] text-display text-white lg:max-w-[420px] lg:text-[44px] lg:leading-[50px]">{title}</h1>
          {/* The PDF keeps these subtitles in the header layer, hidden under the sheet on phones; desktop has room to show them. */}
          {subtitle && <p className="mt-4 hidden max-w-[420px] text-[18px] leading-7 text-white/80 lg:block">{subtitle}</p>}
        </div>
      </MaroonPanel>

      <main className="relative -mt-7 min-h-[calc(100dvh-200px)] rounded-t-sheet bg-cream lg:mt-0 lg:flex lg:min-h-dvh lg:items-center lg:rounded-none">
        <div className="mx-auto w-full max-w-column px-6 pb-10 pt-7 lg:max-w-form lg:px-0 lg:py-16">{children}</div>
      </main>
    </div>
  );
}
