import { Languages } from 'lucide-react';
import { useI18n } from '@/context/I18nContext.jsx';
import { t } from '@/i18n';
import { cn } from '@/lib/cn.js';

const TONES = {
  surface: 'border border-line-subtle bg-white text-maroon hover:bg-cream',
  glass: 'border border-white/40 bg-white/[0.14] text-white backdrop-blur-sm hover:bg-white/[0.22]',
};

/** One-tap English ⇄ العربية switch. It names the language you will get, in that language's own script. */
export default function LanguageToggle({ tone = 'surface', className }) {
  const { other, setLanguage } = useI18n();
  return (
    <button
      type="button"
      onClick={() => setLanguage(other.code)}
      lang={other.code}
      aria-label={t('Switch language to {language}', { language: other.label })}
      className={cn(
        'inline-flex h-10 shrink-0 items-center gap-1.5 rounded-pill px-3.5 text-[14px] font-semibold transition-[background-color,transform] duration-150 active:scale-95',
        other.code === 'ar' ? 'font-arabic' : 'font-sans',
        TONES[tone],
        className,
      )}
    >
      <Languages size={18} strokeWidth={1.8} aria-hidden />
      {other.label}
    </button>
  );
}
