import type { ReactNode } from 'react';
import type { OrderStatus } from '../../shared/types';

export function Spinner({ className = '' }: { className?: string }) {
  return (
    <svg
      className={`h-4 w-4 animate-spin ${className}`}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
      <path
        d="M22 12a10 10 0 0 1-10 10"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * Errors are announced to assistive tech, and never phrased as the user's
 * fault — they say what happened and what to do next.
 */
export function Alert({
  tone = 'error',
  children,
}: {
  tone?: 'error' | 'success' | 'info' | 'warning';
  children: ReactNode;
}) {
  const styles = {
    error: 'border-rose-200 bg-rose-50 text-rose-900',
    success: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    info: 'border-brand-200 bg-brand-50 text-brand-900',
    warning: 'border-amber-200 bg-amber-50 text-amber-900',
  }[tone];

  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={`rounded-xl border px-4 py-3 text-sm font-medium ${styles}`}
    >
      {children}
    </div>
  );
}

const STATUS_TONES: Record<OrderStatus, string> = {
  awaiting_payment: 'bg-amber-100 text-amber-800 ring-amber-200',
  submitted: 'bg-brand-100 text-brand-800 ring-brand-200',
  in_progress: 'bg-brand-100 text-brand-800 ring-brand-200',
  delivered: 'bg-emerald-100 text-emerald-800 ring-emerald-200',
  not_found: 'bg-slate-100 text-slate-700 ring-slate-200',
  rejected: 'bg-rose-100 text-rose-800 ring-rose-200',
  refunded: 'bg-slate-100 text-slate-700 ring-slate-200',
  cancelled: 'bg-slate-100 text-slate-700 ring-slate-200',
};

export function StatusPill({ status, label }: { status: OrderStatus; label: string }) {
  const active = status === 'submitted' || status === 'in_progress';
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ring-1 ${STATUS_TONES[status]}`}
    >
      {active && (
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-60" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-current" />
        </span>
      )}
      {label}
    </span>
  );
}

export function Field({
  label,
  hint,
  error,
  children,
  htmlFor,
}: {
  label: string;
  hint?: string;
  error?: string | null;
  children: ReactNode;
  htmlFor?: string;
}) {
  return (
    <div>
      <label className="label" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {error ? (
        <p className="mt-1.5 text-sm font-medium text-rose-600">{error}</p>
      ) : hint ? (
        <p className="hint">{hint}</p>
      ) : null}
    </div>
  );
}

export function Stepper({
  steps,
  current,
}: {
  steps: readonly string[];
  current: number;
}) {
  return (
    <ol className="flex items-center gap-2" aria-label="Progress">
      {steps.map((step, index) => {
        const state =
          index < current ? 'done' : index === current ? 'current' : 'upcoming';
        return (
          <li key={step} className="flex flex-1 items-center gap-2">
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <span
                className={`h-1 rounded-full transition-colors duration-300 ${
                  state === 'upcoming' ? 'bg-slate-200' : 'bg-brand-600'
                }`}
              />
              <span
                className={`truncate text-xs font-semibold ${
                  state === 'current'
                    ? 'text-brand-700'
                    : state === 'done'
                      ? 'text-slate-500'
                      : 'text-slate-400'
                }`}
                aria-current={state === 'current' ? 'step' : undefined}
              >
                {step}
              </span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-slate-200 ${className}`} />;
}
