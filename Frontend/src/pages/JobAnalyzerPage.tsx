import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight, FileSearch, Loader2, Sparkles, Wand2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
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
import { PageHeader } from '@/components/ui/page-header';
import { InlineNotice } from '@/components/ui/states';
import { api } from '@/lib/api';
import { jobDescriptionInputSchema } from '@shared/schemas';

type FormValues = z.infer<typeof jobDescriptionInputSchema>;

const SAMPLE_JD = `Machine Learning Engineer — Northstar Analytics (fictional demo company)

About the role
You will build and evaluate machine learning models that help retail teams understand customer behaviour.

Responsibilities
- Design, train and evaluate machine learning models using Python and scikit-learn.
- Perform data preprocessing and feature engineering with pandas and NumPy.
- Evaluate models with appropriate validation strategies and communicate limitations clearly.
- Collaborate with product and engineering teams to integrate models into internal tools.

Required qualifications
- Bachelor's degree in Computer Science, Data Science or a related field.
- 0-2 years of experience building machine learning projects, including academic or internship work.
- Strong Python programming skills.
- Solid understanding of machine learning fundamentals, data preprocessing and model evaluation.
- Experience with scikit-learn and pandas.

Preferred qualifications
- Experience with TensorFlow or PyTorch.
- Familiarity with Docker and SQL.
- Exposure to AWS is a plus.`;

export function JobFormDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (id: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState<'idle' | 'saving' | 'analyzing'>('idle');
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(jobDescriptionInputSchema),
    defaultValues: { jobTitle: '', company: '', jobUrl: '', rawText: '' },
  });

  async function onSubmit(values: FormValues) {
    setBusy(true);
    setStage('saving');
    setFormError(null);
    try {
      const created = await api.createJob(values);
      setStage('analyzing');
      try {
        const analyzed = await api.analyzeJob(created.job.id);
        if (analyzed.warning) toast.warning(analyzed.warning);
        else toast.success('Job description analyzed');
      } catch (analysisError) {
        toast.warning(
          analysisError instanceof Error
            ? `Saved, but analysis failed: ${analysisError.message}`
            : 'Saved, but analysis failed.',
        );
      }
      onCreated(created.job.id);
      onOpenChange(false);
      reset();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not save the job description.';
      setFormError(message);
    } finally {
      setBusy(false);
      setStage('idle');
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (!busy ? onOpenChange(next) : undefined)}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Analyze a job description</DialogTitle>
          <DialogDescription>
            Paste the full posting. ResumeGEN extracts required and preferred requirements — it never
            adds skills the text does not mention.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <DialogBody className="space-y-4">
            {formError ? <InlineNotice tone="danger">{formError}</InlineNotice> : null}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Job title" htmlFor="job-title" required error={errors.jobTitle?.message}>
                <Input
                  id="job-title"
                  placeholder="Machine Learning Engineer"
                  aria-invalid={Boolean(errors.jobTitle)}
                  {...register('jobTitle')}
                />
              </Field>
              <Field label="Company" htmlFor="job-company" error={errors.company?.message}>
                <Input id="job-company" placeholder="Northstar Analytics" {...register('company')} />
              </Field>
            </div>
            <Field label="Job URL" htmlFor="job-url" error={errors.jobUrl?.message} hint="Optional.">
              <Input id="job-url" placeholder="https://company.example/careers/role" {...register('jobUrl')} />
            </Field>
            <Field
              label="Job description"
              htmlFor="job-text"
              required
              error={errors.rawText?.message}
              hint={`${SAMPLE_JD.length} characters in the sample. Paste at least 40 characters.`}
            >
              <Textarea
                id="job-text"
                rows={11}
                placeholder="Paste the responsibilities, required qualifications and preferred qualifications…"
                aria-invalid={Boolean(errors.rawText)}
                {...register('rawText')}
              />
            </Field>
            <div className="flex justify-end">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setValue('jobTitle', 'Machine Learning Engineer', { shouldValidate: true });
                  setValue('company', 'Northstar Analytics (fictional)', { shouldValidate: true });
                  setValue('rawText', SAMPLE_JD, { shouldValidate: true });
                }}
              >
                <Wand2 /> Use fictional sample
              </Button>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" loading={busy}>
              {busy ? (
                stage === 'analyzing' ? (
                  <>
                    <Loader2 className="animate-spin" /> Analyzing requirements…
                  </>
                ) : (
                  'Saving…'
                )
              ) : (
                <>
                  <Sparkles /> Save & analyze
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function JobAnalyzerPage() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [jobs, setJobs] = useState<Awaited<ReturnType<typeof api.listJobs>>['jobDescriptions']>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const result = await api.listJobs();
      setJobs(result.jobDescriptions);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not load job descriptions.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <div className="space-y-6 animate-in-up">
      <PageHeader
        eyebrow="Role intelligence"
        title="Job Analyzer"
        description="Turn a job posting into a requirement map. See what your evidence supports, what is partial, and what is genuinely missing."
        actions={
          <Button onClick={() => setOpen(true)}>
            <FileSearch /> Analyze a job
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <MiniStat label="Saved roles" value={jobs.length} />
        <MiniStat label="Analyzed" value={jobs.filter((job) => job.analysis).length} />
        <MiniStat
          label="Requirements mapped"
          value={jobs.reduce(
            (total, job) =>
              total +
              (job.analysis?.requiredSkills.length ?? 0) +
              (job.analysis?.preferredSkills.length ?? 0) +
              (job.analysis?.qualifications.length ?? 0),
            0,
          )}
        />
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-44 animate-pulse rounded-2xl border border-ink-200 bg-white" />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">
          {error}{' '}
          <button className="font-semibold underline" onClick={() => void load()}>
            Retry
          </button>
        </div>
      ) : jobs.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-ink-300 bg-white px-6 py-16 text-center">
          <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
            <FileSearch className="size-6" />
          </div>
          <h2 className="text-base font-semibold text-ink-900">No job descriptions yet</h2>
          <p className="mx-auto mt-1.5 max-w-md text-sm text-ink-500">
            Paste a posting to see required skills, preferred skills, qualifications and the
            responsibilities a resume should address.
          </p>
          <Button className="mt-5" onClick={() => setOpen(true)}>
            <Sparkles /> Analyze your first job
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {jobs.map((job) => {
            const required = job.analysis?.requiredSkills.length ?? 0;
            const preferred = job.analysis?.preferredSkills.length ?? 0;
            return (
              <button
                key={job.id}
                onClick={() => navigate(`/jobs/${job.id}`)}
                className="group flex flex-col rounded-2xl border border-ink-200 bg-white p-5 text-left shadow-card transition hover:border-brand-200 hover:shadow-float"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">
                      {job.company || 'Company not specified'}
                    </p>
                    <h2 className="mt-1 truncate text-[17px] font-semibold tracking-tight text-ink-900 group-hover:text-brand-700">
                      {job.jobTitle}
                    </h2>
                  </div>
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-ink-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-ink-500">
                    {job.analysisEngine === 'gemini' ? 'Gemini' : job.analysis ? 'Heuristic' : 'Not analyzed'}
                  </span>
                </div>

                {job.analysis ? (
                  <>
                    <div className="mt-4 flex flex-wrap gap-1.5">
                      {job.analysis.requiredSkills.slice(0, 6).map((skill) => (
                        <span key={skill} className="rounded-md bg-brand-50 px-2 py-1 text-[11px] font-medium text-brand-700">
                          {skill}
                        </span>
                      ))}
                      {job.analysis.requiredSkills.length > 6 ? (
                        <span className="rounded-md bg-ink-100 px-2 py-1 text-[11px] text-ink-500">
                          +{job.analysis.requiredSkills.length - 6}
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-4 flex items-center gap-4 border-t border-ink-100 pt-3 text-[11px] text-ink-500">
                      <span>{required} required</span>
                      <span>{preferred} preferred</span>
                      <span>{job.analysis.responsibilities.length} responsibilities</span>
                      <span className="ml-auto inline-flex items-center gap-1 font-semibold text-brand-600">
                        Review <ArrowRight className="size-3" />
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="mt-5 rounded-xl border border-dashed border-ink-200 bg-ink-50/60 px-3 py-4 text-xs text-ink-500">
                    Not analyzed yet. Open this role and run analysis.
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}

      <JobFormDialog
        open={open}
        onOpenChange={setOpen}
        onCreated={(id) => {
          navigate(`/jobs/${id}`);
        }}
      />
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-ink-200 bg-white px-5 py-4 shadow-card">
      <p className="text-xs font-medium text-ink-500">{label}</p>
      <p className="mt-1 text-2xl font-bold tracking-tight text-ink-900">{value}</p>
    </div>
  );
}
