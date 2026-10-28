import type { HTMLAttributes } from 'react';
import { cn, type Tone, TONE_CLASSES } from '@/lib/utils';

export function Badge({
  className,
  tone = 'slate',
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ring-1 ring-inset',
        TONE_CLASSES[tone],
        className,
      )}
      {...props}
    />
  );
}
