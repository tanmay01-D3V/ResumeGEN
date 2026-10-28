import { AlertTriangle, Inbox, RefreshCw } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from './button';
import { cn } from '@/lib/utils';

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-2xl border border-dashed border-ink-300 bg-white/70 px-6 py-14 text-center',
        className,
      )}
    >
      <div className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
        {icon ?? <Inbox className="size-6" />}
      </div>
      <h3 className="text-base font-semibold text-ink-900">{title}</h3>
      <p className="mt-1.5 max-w-md text-sm leading-relaxed text-ink-500">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function ErrorState({
  title = 'Something went wrong',
  message,
  onRetry,
  className,
}: {
  title?: string;
  message: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-2xl border border-rose-200 bg-rose-50/60 px-6 py-12 text-center',
        className,
      )}
      role="alert"
    >
      <div className="mb-4 flex size-11 items-center justify-center rounded-2xl bg-rose-100 text-rose-600">
        <AlertTriangle className="size-5" />
      </div>
      <h3 className="text-base font-semibold text-rose-900">{title}</h3>
      <p className="mt-1.5 max-w-lg text-sm leading-relaxed text-rose-700">{message}</p>
      {onRetry ? (
        <Button variant="outline" className="mt-5 border-rose-200 text-rose-700" onClick={onRetry}>
          <RefreshCw /> Try again
        </Button>
      ) : null}
    </div>
  );
}

export function InlineNotice({
  tone = 'info',
  children,
  className,
}: {
  tone?: 'info' | 'warning' | 'success' | 'danger';
  children: ReactNode;
  className?: string;
}) {
  const tones = {
    info: 'border-brand-200 bg-brand-50/80 text-brand-800',
    warning: 'border-amber-200 bg-amber-50/80 text-amber-900',
    success: 'border-emerald-200 bg-emerald-50/80 text-emerald-900',
    danger: 'border-rose-200 bg-rose-50/80 text-rose-900',
  };
  return (
    <div className={cn('rounded-xl border px-4 py-3 text-sm leading-relaxed', tones[tone], className)}>
      {children}
    </div>
  );
}
