import React from 'react';
import { AlertCircle, Inbox, Loader2, RefreshCw } from 'lucide-react';

/** Shared surface for every workspace panel. */
export const Panel: React.FC<{
  title?: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}> = ({ title, description, actions, children, className = '' }) => (
  <section
    className={`bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden ${className}`}
  >
    {(title || actions) && (
      <header className="flex flex-wrap items-start justify-between gap-3 px-5 py-4 border-b border-slate-100">
        <div>
          {title && <h2 className="text-sm font-bold text-slate-900">{title}</h2>}
          {description && <p className="mt-0.5 text-xs text-slate-500">{description}</p>}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </header>
    )}
    <div className="p-5">{children}</div>
  </section>
);

export const PanelLoading: React.FC<{ label?: string }> = ({ label = 'Loading…' }) => (
  <div className="flex items-center gap-2.5 py-8 text-slate-500" role="status" aria-live="polite">
    <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
    <span className="text-xs font-medium">{label}</span>
  </div>
);

export const PanelError: React.FC<{ message: string; onRetry?: () => void }> = ({ message, onRetry }) => (
  <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-3.5 rounded-xl bg-rose-50 border border-rose-200">
    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" aria-hidden="true" />
    <span className="text-xs text-rose-800 flex-1">{message}</span>
    {onRetry && (
      <button
        onClick={onRetry}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-rose-200 text-[11px] font-bold text-rose-700 hover:bg-rose-100 transition-colors"
      >
        <RefreshCw className="w-3 h-3" aria-hidden="true" />
        Retry
      </button>
    )}
  </div>
);

export const PanelEmpty: React.FC<{ title: string; hint?: string }> = ({ title, hint }) => (
  <div className="flex flex-col items-center justify-center py-10 text-center">
    <Inbox className="w-7 h-7 text-slate-300" aria-hidden="true" />
    <p className="mt-2.5 text-sm font-semibold text-slate-600">{title}</p>
    {hint && <p className="mt-1 text-xs text-slate-400 max-w-sm">{hint}</p>}
  </div>
);

/** A truthful banner for features the deployment has not wired up yet. */
export const NotConfigured: React.FC<{ label: string; detail: string }> = ({ label, detail }) => (
  <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-amber-50 border border-amber-200">
    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" aria-hidden="true" />
    <div className="text-xs text-amber-900">
      <p className="font-bold">{label} — Not Configured</p>
      <p className="mt-0.5">{detail}</p>
    </div>
  </div>
);

export const StatCard: React.FC<{
  label: string;
  value: React.ReactNode;
  hint?: string;
  tone?: 'default' | 'good' | 'warn' | 'bad';
  icon?: React.ReactNode;
}> = ({ label, value, hint, tone = 'default', icon }) => {
  const toneClass = {
    default: 'text-slate-900',
    good: 'text-emerald-700',
    warn: 'text-amber-700',
    bad: 'text-rose-700',
  }[tone];

  return (
    <div className="spatial-card bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</span>
        {icon}
      </div>
      <div className={`mt-2 text-2xl font-extrabold tabular-nums ${toneClass}`}>{value}</div>
      {hint && <div className="mt-0.5 text-[11px] text-slate-400">{hint}</div>}
    </div>
  );
};

/** Small, consistent status pill. */
export const StatusPill: React.FC<{ value: string; tone?: 'neutral' | 'good' | 'warn' | 'bad' }> = ({
  value,
  tone = 'neutral',
}) => {
  const map = {
    neutral: 'bg-slate-100 text-slate-700 border-slate-200',
    good: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    warn: 'bg-amber-50 text-amber-700 border-amber-200',
    bad: 'bg-rose-50 text-rose-700 border-rose-200',
  } as const;

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[10.5px] font-bold uppercase tracking-wide ${map[tone]}`}
    >
      {value.replace(/_/g, ' ')}
    </span>
  );
};

/** Maps a domain status string to a pill tone. */
export function toneForStatus(status: string): 'neutral' | 'good' | 'warn' | 'bad' {
  switch (status) {
    case 'completed':
    case 'confirmed':
    case 'dispensed':
    case 'resolved':
    case 'verified':
    case 'active':
      return 'good';
    case 'cancelled':
    case 'no_show':
    case 'rejected':
    case 'expired':
      return 'bad';
    case 'requested':
    case 'checked_in':
    case 'processing':
    case 'in_review':
    case 'in_progress':
    case 'needs_update':
      return 'warn';
    default:
      return 'neutral';
  }
}

export const formatDateTime = (value?: string | Date | null): string => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const formatDate = (value?: string | Date | null): string => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};
