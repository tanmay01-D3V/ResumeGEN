import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = 'brand',
  className,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon: LucideIcon;
  tone?: 'brand' | 'emerald' | 'amber' | 'sky';
  className?: string;
}) {
  const tones = {
    brand: 'bg-brand-50 text-brand-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
    sky: 'bg-sky-50 text-sky-600',
  };
  return (
    <div className={cn('rounded-2xl border border-ink-200/80 bg-white p-5 shadow-card', className)}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-[13px] font-medium text-ink-500">{label}</p>
        <span className={cn('flex size-9 items-center justify-center rounded-xl', tones[tone])}>
          <Icon className="size-[18px]" />
        </span>
      </div>
      <p className="mt-3 text-[28px] font-bold leading-none tracking-tight text-ink-900">{value}</p>
      {hint ? <p className="mt-2 text-xs text-ink-400">{hint}</p> : null}
    </div>
  );
}

export function Trend({ value, label }: { value: number; label: string }) {
  const Icon = value > 0 ? ArrowUpRight : value < 0 ? ArrowDownRight : Minus;
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-ink-500">
      <Icon className={cn('size-3.5', value > 0 ? 'text-emerald-600' : 'text-ink-400')} />
      {label}
    </span>
  );
}
