import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CirclePattern, Logo } from '@/components/ui';
import { useAuth } from '@/context/AuthContext.jsx';
import { ROUTES } from '@/config/routes.js';
import { cn } from '@/lib/cn.js';
import { useDocumentTitle } from '@/hooks';

/** 01 · Splash — brand moment while the session restores; auto-advances, tap to skip. */
export default function SplashPage() {
  useDocumentTitle('');
  const { isAuthenticated, status } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [elapsed, setElapsed] = useState(false);
  const [tapped, setTapped] = useState(false);
  const done = useRef(false);

  // Leave after the brand moment (or a tap) — but only once the session check has finished.
  useEffect(() => {
    if (done.current || status !== 'ready' || !(elapsed || tapped)) return;
    done.current = true;
    navigate(isAuthenticated ? ROUTES.home : ROUTES.welcome, { replace: true });
  }, [status, elapsed, tapped, isAuthenticated, navigate]);

  const go = useCallback(() => setTapped(true), []);

  useEffect(() => {
    const timers = [setTimeout(() => setStep(1), 800), setTimeout(() => setStep(2), 1600), setTimeout(() => setElapsed(true), 2500)];
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <button
      type="button"
      onClick={go}
      aria-label="Continue to kuraat"
      className="relative isolate flex min-h-dvh w-full cursor-default flex-col items-center justify-center overflow-hidden bg-maroon-gradient px-6 text-white"
    >
      <CirclePattern variant="splash" fade="up" className="-z-10" />
      <div className="-mt-[8vh] flex animate-fade-up flex-col items-center text-center">
        <Logo tone="white" className="w-[216px] md:w-[260px]" alt="kuraat" />
        <span className="mt-8 h-px w-10 bg-white/40" aria-hidden />
        <p className="mt-6 text-[17px] leading-6 text-white/85">Your partner for every gathering</p>
        <p lang="ar" dir="rtl" className="mt-2 font-arabic text-[22px] font-bold leading-9">
          كُرات شريك الجمعات
        </p>
      </div>
      <div className="absolute bottom-[max(56px,env(safe-area-inset-bottom))] flex items-center gap-2" aria-hidden>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className={cn('h-1.5 rounded-pill bg-white transition-all duration-500', step === i ? 'w-[26px]' : 'w-1.5 opacity-40')}
          />
        ))}
      </div>
    </button>
  );
}
