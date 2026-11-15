import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '@/lib/cn.js';
import { useLockBodyScroll } from '@/hooks';
import Button from './Button.jsx';
import IconButton from './IconButton.jsx';
import { IconTile } from './Surface.jsx';

function useDialogBehaviour(open, onClose, dismissible) {
  const panelRef = useRef(null);
  useLockBodyScroll(open);
  useEffect(() => {
    if (!open) return undefined;
    const previouslyFocused = document.activeElement;
    const t = setTimeout(() => {
      const el = panelRef.current?.querySelector('[data-autofocus], button, [href], input, select, textarea');
      el?.focus({ preventScroll: true });
    }, 30);
    const onKey = (e) => {
      if (e.key === 'Escape' && dismissible) onClose?.();
      if (e.key === 'Tab' && panelRef.current) {
        const focusables = [...panelRef.current.querySelectorAll('button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])')];
        if (!focusables.length) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(t);
      document.removeEventListener('keydown', onKey);
      previouslyFocused?.focus?.({ preventScroll: true });
    };
  }, [open, onClose, dismissible]);
  return panelRef;
}

/** Centred dialog (PDF screen 16 branch popup): white, r-sheet 28, over the maroon scrim. */
export function Modal({ open, onClose, children, className, labelledBy, dismissible = true, size = 'sm' }) {
  const panelRef = useDialogBehaviour(open, onClose, dismissible);
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-5">
      <div
        className="absolute inset-0 animate-fade-in bg-[rgba(64,15,30,0.66)]"
        onClick={dismissible ? onClose : undefined}
        aria-hidden
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        className={cn(
          'relative max-h-[calc(100dvh-40px)] w-full animate-scale-in overflow-y-auto rounded-sheet bg-white p-6 shadow-dialog',
          size === 'sm' ? 'max-w-[350px]' : 'max-w-[480px]',
          className,
        )}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}

/** Bottom sheet on phones, centred dialog from 768 px. */
export function Sheet({ open, onClose, title, children, footer }) {
  const panelRef = useDialogBehaviour(open, onClose, true);
  const titleId = useId();
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end justify-center md:items-center md:p-5">
      <div className="absolute inset-0 animate-fade-in bg-[rgba(64,15,30,0.66)]" onClick={onClose} aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative flex max-h-[88dvh] w-full animate-sheet-up flex-col rounded-t-sheet bg-cream shadow-dialog md:max-w-[480px] md:animate-scale-in md:rounded-sheet"
      >
        <div className="mx-auto mt-2.5 h-1 w-10 rounded-pill bg-line md:hidden" aria-hidden />
        <div className="flex items-center justify-between px-5 pb-2 pt-3 md:pt-5">
          <h2 id={titleId} className="text-heading text-ink">
            {title}
          </h2>
          <IconButton icon={X} label="Close" size="md" onClick={onClose} />
        </div>
        <div className="overflow-y-auto px-5 pb-4">{children}</div>
        {footer && <div className="border-t border-line-subtle bg-white px-5 pb-safe pt-4 md:rounded-b-sheet md:pb-5">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

/** Confirmation dialog built from the popup pattern. */
export function ConfirmDialog({ open, onClose, onConfirm, icon, title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', loading }) {
  const titleId = useId();
  return (
    <Modal open={open} onClose={loading ? undefined : onClose} labelledBy={titleId} dismissible={!loading}>
      <div className="flex flex-col items-center text-center">
        {icon && <IconTile icon={icon} size={72} iconSize={30} />}
        <h2 id={titleId} className="mt-5 text-[22px] font-bold leading-7 text-ink">
          {title}
        </h2>
        {message && <p className="mt-2 text-body text-muted">{message}</p>}
        <Button block className="mt-6" onClick={onConfirm} loading={loading} data-autofocus>
          {confirmLabel}
        </Button>
        <button type="button" onClick={onClose} disabled={loading} className="mt-4 text-[15px] font-bold text-maroon hover:underline disabled:opacity-50">
          {cancelLabel}
        </button>
      </div>
    </Modal>
  );
}
