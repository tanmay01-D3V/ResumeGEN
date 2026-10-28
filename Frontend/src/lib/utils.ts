import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(value?: string, fallback = '—'): string {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en', { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
}

export function formatDateTime(value?: string): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

export function relativeTime(value?: string): string {
  if (!value) return 'never';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const diff = Date.now() - date.getTime();
  const minutes = Math.round(diff / 60000);
  if (Math.abs(minutes) < 1) return 'just now';
  if (Math.abs(minutes) < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (Math.abs(days) < 30) return `${days}d ago`;
  return formatDate(value);
}

export function initials(name?: string): string {
  if (!name) return 'RG';
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^\w\s-]/g, '')
      .trim()
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'resume'
  );
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function titleCase(value: string): string {
  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export const MATCH_STATUS_META = {
  strong: {
    label: 'Strong evidence',
    tone: 'emerald' as const,
    description: 'Directly supported by verified portfolio records.',
  },
  partial: {
    label: 'Partial evidence',
    tone: 'amber' as const,
    description: 'Related evidence exists, but the exact claim needs review.',
  },
  not_evidenced: {
    label: 'Not evidenced',
    tone: 'slate' as const,
    description: 'No portfolio record supports this requirement yet.',
  },
};

export const REQUIREMENT_TYPE_LABELS: Record<string, string> = {
  required_skill: 'Required skill',
  preferred_skill: 'Preferred skill',
  qualification: 'Qualification',
  preferred_qualification: 'Preferred qualification',
  responsibility: 'Responsibility',
  experience: 'Experience',
  keyword: 'Keyword',
};

export type Tone = 'slate' | 'indigo' | 'emerald' | 'amber' | 'rose' | 'sky';

export const TONE_CLASSES: Record<Tone, string> = {
  slate: 'bg-ink-100 text-ink-600 ring-ink-200',
  indigo: 'bg-brand-50 text-brand-700 ring-brand-200',
  emerald: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  amber: 'bg-amber-50 text-amber-700 ring-amber-200',
  rose: 'bg-rose-50 text-rose-700 ring-rose-200',
  sky: 'bg-sky-50 text-sky-700 ring-sky-200',
};

export function safeErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return 'Something went wrong. Please try again.';
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
