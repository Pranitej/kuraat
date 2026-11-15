import { cn } from '@/lib/cn.js';
import { CheckCircle } from './Controls.jsx';

/** 4-segment strength meter + caption (PDF screens 05, 19). */
export function StrengthMeter({ evaluation, className }) {
  const { score, label, level } = evaluation;
  const fill = level === 'weak' ? 'bg-hotpink' : 'bg-maroon';
  return (
    <div className={cn('mt-3', className)} aria-live="polite">
      <div className="flex gap-1.5">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={cn('h-1 flex-1 rounded-pill transition-colors duration-200', i < score ? fill : 'bg-sand')} />
        ))}
      </div>
      {label && <p className={cn('mt-2 text-label', level === 'weak' ? 'text-hotpink' : 'text-maroon')}>{label}</p>}
    </div>
  );
}

/** Checklist of password rules. */
export function PasswordRules({ evaluation, className }) {
  return (
    <ul className={cn('flex flex-col gap-2.5', className)}>
      {evaluation.results.map((r) => (
        <li key={r.id} className={cn('flex items-center gap-3 text-body transition-colors', r.met ? 'text-ink' : 'text-muted')}>
          <CheckCircle checked={r.met} />
          <span>{r.label}</span>
          <span className="sr-only">{r.met ? '(met)' : '(not met)'}</span>
        </li>
      ))}
    </ul>
  );
}
