import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CircleCheck, Info, TriangleAlert } from 'lucide-react';
import { cn } from '@/lib/cn.js';

const ToastContext = createContext(null);

const ICONS = { success: CircleCheck, info: Info, error: TriangleAlert };

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);
  const timer = useRef(null);

  const hide = useCallback(() => {
    clearTimeout(timer.current);
    setToast(null);
  }, []);

  const show = useCallback(
    (message, { tone = 'success', action = null, duration = 2800 } = {}) => {
      clearTimeout(timer.current);
      const id = Date.now();
      setToast({ id, message, tone, action });
      timer.current = setTimeout(() => setToast((t) => (t && t.id === id ? null : t)), action ? duration + 1800 : duration);
    },
    [],
  );

  const value = useMemo(() => ({ show, hide }), [show, hide]);
  const Icon = toast ? ICONS[toast.tone] || Info : null;

  return (
    <ToastContext.Provider value={value}>
      {children}
      {createPortal(
        <div
          aria-live="polite"
          className="pointer-events-none fixed inset-x-0 z-[70] flex justify-center px-4"
          style={{ bottom: 'calc(var(--bottom-bar-h, 0px) + 16px)' }}
        >
          {toast && (
            <div
              key={toast.id}
              role="status"
              className={cn(
                'pointer-events-auto flex max-w-[440px] animate-toast-in items-center gap-3 rounded-pill py-2.5 pl-4 text-small font-semibold text-white shadow-dialog',
                toast.tone === 'error' ? 'bg-hotpink' : 'bg-ink',
                toast.action ? 'pr-2' : 'pr-5',
              )}
            >
              <Icon size={18} strokeWidth={2} className={toast.tone === 'error' ? 'text-white' : 'text-pink'} aria-hidden />
              <span className="min-w-0 flex-1">{toast.message}</span>
              {toast.action && (
                <button
                  type="button"
                  onClick={() => {
                    toast.action.onClick();
                    hide();
                  }}
                  className="rounded-pill bg-white/15 px-3 py-1.5 text-small font-bold text-white transition hover:bg-white/25"
                >
                  {toast.action.label}
                </button>
              )}
            </div>
          )}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
}
