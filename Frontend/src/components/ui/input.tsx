import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      className={cn(
        'h-10 w-full rounded-xl border border-ink-200 bg-white px-3 text-sm text-ink-900 shadow-sm transition placeholder:text-ink-400 hover:border-ink-300 focus:border-brand-400 disabled:cursor-not-allowed disabled:bg-ink-50 disabled:opacity-70',
        'aria-[invalid=true]:border-rose-400 aria-[invalid=true]:ring-rose-200',
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = 'Input';

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        'min-h-24 w-full resize-y rounded-xl border border-ink-200 bg-white px-3 py-2.5 text-sm leading-relaxed text-ink-900 shadow-sm transition placeholder:text-ink-400 hover:border-ink-300 focus:border-brand-400 disabled:cursor-not-allowed disabled:bg-ink-50 disabled:opacity-70',
        'aria-[invalid=true]:border-rose-400 aria-[invalid=true]:ring-rose-200',
        className,
      )}
      {...props}
    />
  ),
);
Textarea.displayName = 'Textarea';

export function Label({
  className,
  children,
  required,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement> & { required?: boolean }) {
  return (
    <label className={cn('text-[13px] font-medium text-ink-700', className)} {...props}>
      {children}
      {required ? <span className="ml-0.5 text-rose-500">*</span> : null}
    </label>
  );
}

export function Field({
  label,
  htmlFor,
  error,
  hint,
  required,
  children,
  className,
}: {
  label: string;
  htmlFor?: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <Label htmlFor={htmlFor} required={required}>
        {label}
      </Label>
      {children}
      {error ? (
        <p className="text-xs font-medium text-rose-600" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-ink-400">{hint}</p>
      ) : null}
    </div>
  );
}
