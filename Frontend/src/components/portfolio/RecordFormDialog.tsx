import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { AlertCircle, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Field, Input, Textarea } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { InlineNotice } from '@/components/ui/states';
import { api } from '@/lib/api';
import { titleCase } from '@/lib/utils';
import { CATEGORY_META, type CategoryField, type PortfolioCategory } from '@shared/categories';
import { normalizeRecordData, validateRecordData } from '@shared/schemas';
import type { PortfolioRecord } from '@shared/types';

interface FormValues {
  title: string;
  [key: string]: string | boolean | undefined;
}

function defaultsFor(category: PortfolioCategory, record?: PortfolioRecord): FormValues {
  const meta = CATEGORY_META[category];
  const values: FormValues = {
    title: record?.title ?? (meta.singleton ? meta.singular : ''),
  };
  for (const field of meta.fields) {
    const raw = record?.data[field.key];
    if (field.type === 'boolean') {
      values[field.key] = Boolean(raw);
    } else if (Array.isArray(raw)) {
      values[field.key] = raw.join(', ');
    } else {
      values[field.key] = raw === undefined || raw === null ? '' : String(raw);
    }
  }
  return values;
}

function deriveTitle(category: PortfolioCategory, values: FormValues): string {
  const candidates = [
    'name',
    'title',
    'institution',
    'organization',
    'role',
    'degree',
    'fullName',
  ];
  for (const key of candidates) {
    const value = values[key];
    if (typeof value === 'string' && value.trim()) {
      if (key === 'institution' && typeof values.degree === 'string' && values.degree.trim()) {
        return `${values.degree.trim()} — ${value.trim()}`;
      }
      return value.trim();
    }
  }
  return CATEGORY_META[category].singular;
}

function toPayload(category: PortfolioCategory, values: FormValues): Record<string, unknown> {
  const meta = CATEGORY_META[category];
  const payload: Record<string, unknown> = {};
  for (const field of meta.fields) {
    payload[field.key] = values[field.key];
  }
  return payload;
}

export function RecordFormDialog({
  open,
  onOpenChange,
  category,
  record,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category: PortfolioCategory;
  record?: PortfolioRecord | null;
  onSaved: () => void;
}) {
  const meta = CATEGORY_META[category];
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const {
    register,
    handleSubmit,
    reset,
    watch,
    setError,
    formState: { errors },
  } = useForm<FormValues>({ defaultValues: defaultsFor(category, record ?? undefined) });

  useEffect(() => {
    if (open) {
      reset(defaultsFor(category, record ?? undefined));
      setFieldErrors({});
      setFormError(null);
    }
  }, [open, category, record, reset]);

  const values = watch();

  const visibleFields = useMemo(
    () => meta.fields.filter((field) => field.type !== 'boolean'),
    [meta.fields],
  );
  const booleanFields = useMemo(
    () => meta.fields.filter((field) => field.type === 'boolean'),
    [meta.fields],
  );

  async function onSubmit(formValues: FormValues) {
    setSubmitting(true);
    setFormError(null);
    setFieldErrors({});
    try {
      const data = normalizeRecordData(category, toPayload(category, formValues));
      const validation = validateRecordData(category, data);
      if (!validation.success) {
        const mapped: Record<string, string> = {};
        for (const issue of validation.error.issues) {
          const key = String(issue.path[0] ?? 'form');
          if (!mapped[key]) mapped[key] = issue.message;
        }
        setFieldErrors(mapped);
        setFormError('Review the highlighted fields. Required fields and formats must be valid.');
        for (const [key, message] of Object.entries(mapped)) {
          if (key !== 'form') setError(key, { message });
        }
        return;
      }

      const title = formValues.title.trim() || deriveTitle(category, formValues);
      if (record) {
        await api.updateRecord(record.id, {
          title,
          data: validation.data as Record<string, unknown>,
          tags: record.tags,
        });
        toast.success(`${meta.singular} updated`);
      } else {
        await api.createRecord({
          category,
          title,
          data: validation.data as Record<string, unknown>,
          tags: [],
          sourceType: 'manual',
          verificationStatus: 'verified',
        });
        toast.success(`${meta.singular} added to your portfolio`);
      }
      onSaved();
      onOpenChange(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not save this record.';
      setFormError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  function renderField(field: CategoryField) {
    const id = `field-${field.key}`;
    const error = fieldErrors[field.key] ?? errors[field.key]?.message;
    const common = {
      id,
      'aria-invalid': Boolean(error),
      ...register(field.key),
    };

    if (field.type === 'textarea') {
      return (
        <Field
          key={field.key}
          label={field.label}
          htmlFor={id}
          required={field.required}
          error={error}
          hint={field.help ?? field.placeholder}
          className="sm:col-span-2"
        >
          <Textarea {...common} placeholder={field.placeholder} rows={field.maxLength && field.maxLength > 800 ? 4 : 3} />
        </Field>
      );
    }

    if (field.type === 'boolean') {
      return null;
    }

    return (
      <Field
        key={field.key}
        label={field.label}
        htmlFor={id}
        required={field.required}
        error={error}
        hint={
          field.type === 'list'
            ? 'Separate items with commas.'
            : field.help ?? field.placeholder
        }
      >
        <Input
          {...common}
          type={field.type === 'number' ? 'number' : field.type === 'email' ? 'email' : field.type === 'url' ? 'url' : field.type === 'tel' ? 'tel' : 'text'}
          placeholder={field.type === 'list' ? 'Item one, item two' : field.placeholder}
          step={field.type === 'number' ? '0.5' : undefined}
        />
      </Field>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{record ? `Edit ${meta.singular.toLowerCase()}` : `Add ${meta.singular.toLowerCase()}`}</DialogTitle>
          <DialogDescription>{meta.description}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <DialogBody className="space-y-4">
            {formError ? (
              <InlineNotice tone="danger">
                <div className="flex items-start gap-2">
                  <AlertCircle className="mt-0.5 size-4 shrink-0" />
                  {formError}
                </div>
              </InlineNotice>
            ) : null}

            <Field
              label="Display title"
              htmlFor="record-title"
              required
              error={errors.title?.message}
              hint="Used in lists and match evidence. It can differ from the resume output."
            >
              <Input
                id="record-title"
                placeholder={meta.singular}
                aria-invalid={Boolean(errors.title)}
                {...register('title', { required: 'A display title is required' })}
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">{visibleFields.map(renderField)}</div>

            {booleanFields.map((field) => (
              <label
                key={field.key}
                className="flex cursor-pointer items-center gap-3 rounded-xl border border-ink-200 px-3.5 py-3"
              >
                <Checkbox
                  checked={Boolean(values[field.key])}
                  onCheckedChange={(checked) =>
                    reset({ ...values, [field.key]: checked === true })
                  }
                  aria-label={field.label}
                />
                <span>
                  <span className="block text-sm font-medium text-ink-800">{field.label}</span>
                  <span className="block text-xs text-ink-400">
                    {field.help ?? 'Mark this if it is currently true.'}
                  </span>
                </span>
              </label>
            ))}

            {category === 'experience' ? (
              <div className="max-w-xs">
                <Field label="Employment type" htmlFor="employment-type">
                  <Select
                    value={String(values.employmentType ?? '')}
                    onValueChange={(value) => reset({ ...values, employmentType: value })}
                  >
                    <SelectTrigger id="employment-type">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {['Internship', 'Full-time', 'Part-time', 'Contract', 'Freelance', 'Volunteer'].map(
                        (option) => (
                          <SelectItem key={option} value={option}>
                            {option}
                          </SelectItem>
                        ),
                      )}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
            ) : null}

            <p className="text-[11px] leading-relaxed text-ink-400">
              Only add facts you can support in an interview. ResumeGEN never invents metrics,
              employers or credentials.
            </p>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" loading={submitting}>
              <Save /> {record ? 'Save changes' : `Add ${meta.singular.toLowerCase()}`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
