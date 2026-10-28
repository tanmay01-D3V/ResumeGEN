import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CircleDashed,
  Download,
  Eye,
  FileText,
  Layers,
  ListChecks,
  Loader2,
  Save,
  Search,
  SlidersHorizontal,
  Sparkles,
  Target,
  TriangleAlert,
  XCircle,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Field, Input, Textarea } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton, SkeletonList } from '@/components/ui/skeleton';
import { EmptyState, ErrorState, InlineNotice } from '@/components/ui/states';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PdfViewer } from '@/components/resume/PdfViewer';
import { ResumePreview } from '@/components/resume/ResumePreview';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import {
  buildBuilderSignature,
  filterRecords,
  isPreviewStale,
  selectableRecords,
  suggestedSelection,
  toggleSelection,
  uniqueIds,
} from '@/lib/builder';
import {
  cn,
  formatDate,
  MATCH_STATUS_META,
  REQUIREMENT_TYPE_LABELS,
  relativeTime,
} from '@/lib/utils';
import { CATEGORY_META, type PortfolioCategory } from '@shared/categories';
import {
  DEFAULT_SECTION_ORDER,
  RESUME_SECTION_LABELS,
  type GenerateResumeRequest,
  type GenerateResumeResponse,
  type ImprovementSuggestion,
  type JobDescription,
  type MatchResponse,
  type PortfolioRecord,
  type ResumeDocument,
  type ResumeSectionKey,
  type ResumeSettings,
  type ResumeTemplate,
  type SavedResume,
} from '@shared/types';

const STEPS = [
  { label: 'Target role', icon: Target },
  { label: 'Match review', icon: BadgeCheck },
  { label: 'Select evidence', icon: ListChecks },
  { label: 'Customize', icon: SlidersHorizontal },
  { label: 'Preview', icon: Eye },
  { label: 'Save & export', icon: Download },
] as const;

const TEMPLATE_META: Array<{ value: ResumeTemplate; label: string; description: string }> = [
  { value: 'classic', label: 'Classic', description: 'Serif, centered header, traditional ATS profile.' },
  { value: 'modern', label: 'Modern', description: 'Clean sans-serif with left-aligned headings.' },
  { value: 'compact', label: 'Compact', description: 'Tighter spacing for dense two-page resumes.' },
];

export function ResumeBuilderPage() {
  const { config, user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [jobs, setJobs] = useState<JobDescription[]>([]);
  const [portfolio, setPortfolio] = useState<PortfolioRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [step, setStep] = useState(0);
  const [maxStep, setMaxStep] = useState(0);
  const [selectedJobId, setSelectedJobId] = useState(searchParams.get('jd') ?? '');
  const [match, setMatch] = useState<MatchResponse | null>(null);
  const [matching, setMatching] = useState(false);
  const [matchError, setMatchError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const [title, setTitle] = useState('');
  const [settings, setSettings] = useState<ResumeSettings>({
    sectionOrder: [...DEFAULT_SECTION_ORDER],
    template: 'classic',
    layout: 'one_page',
    contactOverrides: {},
  });
  const [useAiSummary, setUseAiSummary] = useState(false);

  const [generated, setGenerated] = useState<GenerateResumeResponse | null>(null);
  const [generatedSignature, setGeneratedSignature] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<ImprovementSuggestion[]>([]);
  const [suggestionsNote, setSuggestionsNote] = useState('');
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);

  const [saving, setSaving] = useState(false);
  const [savedResume, setSavedResume] = useState<SavedResume | null>(null);
  const [downloading, setDownloading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [jobResult, portfolioResult] = await Promise.all([api.listJobs(), api.listPortfolio()]);
      setJobs(jobResult.jobDescriptions);
      setPortfolio(portfolioResult.records);
    } catch (caught) {
      setLoadError(caught instanceof Error ? caught.message : 'Could not load the builder.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const job = jobs.find((item) => item.id === selectedJobId) ?? null;
  const recordById = useMemo(() => new Map(portfolio.map((record) => [record.id, record])), [portfolio]);

  const settingsPayload = useMemo<ResumeSettings>(
    () => ({
      ...settings,
      summary: settings.summary?.trim() ? settings.summary.trim() : undefined,
    }),
    [settings],
  );

  const request = useMemo<GenerateResumeRequest | null>(() => {
    if (!selectedJobId || selectedIds.length === 0) return null;
    return {
      jobDescriptionId: selectedJobId,
      selectedRecordIds: selectedIds,
      ...(title.trim() ? { title: title.trim() } : {}),
      settings: settingsPayload,
      useAiSummary,
    };
  }, [selectedJobId, selectedIds, title, settingsPayload, useAiSummary]);

  const signature = useMemo(
    () => buildBuilderSignature({ selectedIds, settings: settingsPayload, useAiSummary }),
    [selectedIds, settingsPayload, useAiSummary],
  );
  const previewStale = isPreviewStale(generatedSignature, signature);

  useEffect(() => {
    if (!title && job) setTitle(`${job.jobTitle} — ${user?.displayName || 'Tailored Resume'}`);
  }, [job, title, user?.displayName]);

  async function selectJob(jobDescriptionId: string) {
    if (jobDescriptionId === selectedJobId) return;
    setSelectedJobId(jobDescriptionId);
    setMatch(null);
    setSelectedIds([]);
    setGenerated(null);
    setGeneratedSignature(null);
    setSavedResume(null);
    setMaxStep(0);
    setStep(0);
    const jobItem = jobs.find((item) => item.id === jobDescriptionId);
    if (jobItem) setTitle(`${jobItem.jobTitle} — ${user?.displayName || 'Tailored Resume'}`);
  }

  async function runMatch() {
    if (!job) {
      toast.error('Choose a job description first.');
      return;
    }
    if (!job.analysis) {
      toast.error('Analyze this job description before matching.');
      return;
    }
    setMatching(true);
    setMatchError(null);
    try {
      const result = await api.match(job.id, true);
      setMatch(result);
      setSelectedIds(suggestedSelection(result, portfolio));
      setStep(1);
      setMaxStep((current) => Math.max(current, 1));
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Matching failed.';
      setMatchError(message);
      toast.error(message);
    } finally {
      setMatching(false);
    }
  }

  function goNext() {
    if (step === 0) {
      const targetJob = jobs.find((item) => item.id === selectedJobId);
      if (!targetJob) {
        toast.error('Choose a job description to continue.');
        return;
      }
      if (!targetJob.analysis) {
        toast.error('Analyze this job description first. Open the Job Analyzer to run analysis.');
        return;
      }
      if (match?.jobDescriptionId === targetJob.id) {
        setStep(1);
        setMaxStep((current) => Math.max(current, 1));
      } else {
        void runMatch();
      }
      return;
    }
    if (step === 1) {
      if (!match) return;
      setStep(2);
      setMaxStep((current) => Math.max(current, 2));
      return;
    }
    if (step === 2) {
      if (selectedIds.length === 0) {
        toast.error('Select at least one verified portfolio record.');
        return;
      }
      setStep(3);
      setMaxStep((current) => Math.max(current, 3));
      return;
    }
    if (step === 3) {
      setStep(4);
      setMaxStep((current) => Math.max(current, 4));
      return;
    }
    if (step === 4) {
      setStep(5);
      setMaxStep((current) => Math.max(current, 5));
    }
  }

  function goBack() {
    setStep((current) => Math.max(0, current - 1));
  }

  const ensureGenerated = useCallback(async () => {
    if (!request) {
      setGenerateError('Select at least one portfolio record.');
      return;
    }
    setGenerating(true);
    setGenerateError(null);
    try {
      const result = await api.generateResume(request);
      setGenerated(result);
      setGeneratedSignature(signature);
      if (result.document.warnings.length) {
        toast.warning(result.document.warnings[0]);
      }
      if (result.document.engine === 'gemini-assisted') {
        toast.success('Gemini-assisted summary passed grounding checks.');
      }

      setSuggestionsLoading(true);
      try {
        const suggestionResult = await api.suggestions({
          jobDescriptionId: request.jobDescriptionId,
          selectedRecordIds: request.selectedRecordIds,
          ...(request.settings.summary ? { summary: request.settings.summary } : {}),
        });
        setSuggestions(suggestionResult.suggestions);
        setSuggestionsNote(suggestionResult.disclaimer);
      } catch {
        setSuggestions([]);
        setSuggestionsNote('Suggestions could not be loaded. The resume preview is still valid.');
      } finally {
        setSuggestionsLoading(false);
      }
    } catch (caught) {
      setGenerateError(caught instanceof Error ? caught.message : 'Could not generate the resume.');
    } finally {
      setGenerating(false);
    }
  }, [request, signature]);

  useEffect(() => {
    if (step === 4) void ensureGenerated();
    // Generate once per visit to the preview step.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  async function save() {
    if (!request) return;
    if (!title.trim()) {
      toast.error('Give this resume version a title.');
      return;
    }
    if (selectedIds.length === 0) {
      toast.error('Select at least one portfolio record.');
      return;
    }
    setSaving(true);
    try {
      const result = await api.saveResume({
        title: title.trim(),
        jobDescriptionId: request.jobDescriptionId,
        selectedRecordIds: selectedIds,
        settings: settingsPayload,
        aiAssisted: generated?.document.engine === 'gemini-assisted',
      });
      setSavedResume(result.resume);
      toast.success('Resume snapshot saved');
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : 'Could not save the resume.');
    } finally {
      setSaving(false);
    }
  }

  async function downloadPdf() {
    if (!request) return;
    setDownloading(true);
    try {
      await api.downloadPreviewPdf(request, `${title || job?.jobTitle || 'resume'}.pdf`);
      toast.success('PDF downloaded');
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : 'Could not download the PDF.');
    } finally {
      setDownloading(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-16 w-full" />
        <SkeletonList rows={3} />
      </div>
    );
  }

  if (loadError) {
    return <ErrorState message={loadError} onRetry={() => void load()} />;
  }

  return (
    <div className="space-y-6 animate-in-up">
      <PageHeader
        eyebrow="Tailoring studio"
        title="Resume Builder"
        description="Six deliberate steps: choose a role, review honest matches, select evidence, customize, preview the exact PDF, then save and export."
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link to="/resumes">
              <FileText /> Saved resumes
            </Link>
          </Button>
        }
      />

      <Stepper
        step={step}
        maxStep={maxStep}
        onSelect={(index) => {
          if (index <= maxStep) setStep(index);
        }}
      />

      {step === 0 ? (
        <TargetRoleStep
          jobs={jobs}
          portfolioCount={portfolio.length}
          selectedJobId={selectedJobId}
          onSelect={(id) => void selectJob(id)}
          onNext={goNext}
          matching={matching}
          matchError={matchError}
          config={config}
        />
      ) : null}

      {step === 1 && match && job ? (
        <MatchReviewStep match={match} job={job} />
      ) : null}

      {step === 2 ? (
        <EvidenceStep
          match={match}
          records={portfolio}
          selectedIds={selectedIds}
          onChange={setSelectedIds}
        />
      ) : null}

      {step === 3 && job ? (
        <CustomizeStep
          title={title}
          setTitle={setTitle}
          settings={settings}
          setSettings={setSettings}
          useAiSummary={useAiSummary}
          setUseAiSummary={setUseAiSummary}
          aiConfigured={Boolean(config?.aiConfigured)}
          selectedCount={selectedIds.length}
          job={job}
          portfolioSummary={
            portfolio.find((record) => record.category === 'summary')?.data as
              | { summaryText?: string }
              | undefined
          }
        />
      ) : null}

      {step === 4 ? (
        <PreviewStep
          generating={generating}
          error={generateError}
          generated={generated}
          stale={previewStale}
          onRefresh={() => void ensureGenerated()}
          request={request}
          suggestions={suggestions}
          suggestionsNote={suggestionsNote}
          suggestionsLoading={suggestionsLoading}
        />
      ) : null}

      {step === 5 && job ? (
        <SaveStep
          title={title}
          setTitle={setTitle}
          job={job}
          selectedCount={selectedIds.length}
          settings={settings}
          generated={generated}
          saving={saving}
          saved={savedResume}
          downloading={downloading}
          onSave={() => void save()}
          onDownload={() => void downloadPdf()}
          onBuildAnother={() => {
            setStep(0);
            setSavedResume(null);
            setGenerated(null);
          }}
          onOpenSaved={() => savedResume && navigate(`/resumes/${savedResume.id}`)}
        />
      ) : null}

      {step > 0 && step < 5 ? (
        <div className="flex flex-col-reverse gap-3 border-t border-ink-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <Button variant="outline" onClick={goBack}>
            <ArrowLeft /> Back
          </Button>
          <div className="flex items-center gap-3">
            <p className="hidden text-xs text-ink-400 sm:block">
              {selectedIds.length} records selected · {settings.template} ·{' '}
              {settings.layout.replace('_', ' ')}
            </p>
            <Button onClick={goNext} disabled={step === 2 && selectedIds.length === 0}>
              {step === 3 ? (
                <>
                  Generate preview <Eye />
                </>
              ) : (
                <>
                  Continue <ArrowRight />
                </>
              )}
            </Button>
          </div>
        </div>
      ) : null}

      {step === 4 ? (
        <div className="flex flex-col-reverse gap-3 border-t border-ink-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <Button variant="outline" onClick={goBack}>
            <ArrowLeft /> Back to customization
          </Button>
          <Button onClick={goNext} disabled={!generated || generating}>
            Continue to save <ArrowRight />
          </Button>
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Stepper                                                             */
/* ------------------------------------------------------------------ */

function Stepper({
  step,
  maxStep,
  onSelect,
}: {
  step: number;
  maxStep: number;
  onSelect: (index: number) => void;
}) {
  return (
    <div className="scrollbar-thin -mx-1 overflow-x-auto pb-1">
      <ol className="flex min-w-[720px] items-center gap-1 px-1">
        {STEPS.map((item, index) => {
          const Icon = item.icon;
          const active = index === step;
          const complete = index < step;
          const reachable = index <= maxStep;
          return (
            <li key={item.label} className="flex flex-1 items-center gap-1">
              <button
                onClick={() => onSelect(index)}
                disabled={!reachable}
                className={cn(
                  'flex min-w-0 flex-1 items-center gap-2 rounded-xl px-2.5 py-2 text-left transition',
                  active && 'bg-brand-50',
                  !active && reachable && 'hover:bg-ink-50',
                  !reachable && 'cursor-not-allowed opacity-50',
                )}
              >
                <span
                  className={cn(
                    'flex size-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold',
                    active
                      ? 'bg-brand-600 text-white'
                      : complete
                        ? 'bg-emerald-500 text-white'
                        : 'bg-ink-100 text-ink-500',
                  )}
                >
                  {complete ? <Check className="size-3.5" strokeWidth={3} /> : index + 1}
                </span>
                <span className="min-w-0">
                  <span
                    className={cn(
                      'block truncate text-[11px] font-semibold',
                      active ? 'text-brand-800' : 'text-ink-600',
                    )}
                  >
                    {item.label}
                  </span>
                </span>
                <Icon className={cn('ml-auto hidden size-3.5 xl:block', active ? 'text-brand-500' : 'text-ink-300')} />
              </button>
              {index < STEPS.length - 1 ? <span className="h-px w-2 shrink-0 bg-ink-200" /> : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Step 1: target role                                                 */
/* ------------------------------------------------------------------ */

function TargetRoleStep({
  jobs,
  portfolioCount,
  selectedJobId,
  onSelect,
  onNext,
  matching,
  matchError,
  config,
}: {
  jobs: JobDescription[];
  portfolioCount: number;
  selectedJobId: string;
  onSelect: (id: string) => void;
  onNext: () => void;
  matching: boolean;
  matchError: string | null;
  config: ReturnType<typeof useAuth>['config'];
}) {
  if (portfolioCount === 0) {
    return (
      <EmptyState
        icon={<Layers className="size-6" />}
        title="Add portfolio evidence first"
        description="A tailored resume can only use records you have actually added. Load the demo portfolio or create your first record."
        action={
          <Button asChild>
            <Link to="/portfolio">Open portfolio</Link>
          </Button>
        }
      />
    );
  }

  if (jobs.length === 0) {
    return (
      <EmptyState
        icon={<Target className="size-6" />}
        title="No job descriptions yet"
        description="Paste a posting into the Job Analyzer, then return here to tailor a resume."
        action={
          <Button asChild>
            <Link to="/jobs">Analyze a job</Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        <div className="space-y-3">
          {jobs.map((job) => {
            const active = job.id === selectedJobId;
            return (
              <button
                key={job.id}
                onClick={() => onSelect(job.id)}
                className={cn(
                  'flex w-full items-start gap-3 rounded-2xl border bg-white p-4 text-left shadow-card transition',
                  active
                    ? 'border-brand-400 ring-2 ring-brand-100'
                    : 'border-ink-200 hover:border-ink-300',
                )}
              >
                <span
                  className={cn(
                    'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border',
                    active ? 'border-brand-600 bg-brand-600 text-white' : 'border-ink-300 bg-white',
                  )}
                >
                  {active ? <Check className="size-3" strokeWidth={3} /> : null}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-ink-900">{job.jobTitle}</span>
                    <Badge tone={job.analysis ? (job.analysisEngine === 'gemini' ? 'emerald' : 'amber') : 'rose'}>
                      {job.analysis ? (job.analysisEngine === 'gemini' ? 'Gemini' : 'Heuristic') : 'Not analyzed'}
                    </Badge>
                  </span>
                  <span className="mt-1 block text-xs text-ink-500">
                    {job.company || 'Company not specified'} · updated {relativeTime(job.updatedAt)}
                  </span>
                  {job.analysis ? (
                    <span className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-ink-400">
                      <span>{job.analysis.requiredSkills.length} required skills</span>
                      <span>{job.analysis.preferredSkills.length} preferred</span>
                      <span>{job.analysis.responsibilities.length} responsibilities</span>
                    </span>
                  ) : (
                    <span className="mt-2 block text-[11px] font-medium text-rose-600">
                      Open the Job Analyzer and run analysis before building.
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>How matching works</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-[13px] leading-relaxed text-ink-500">
              <div className="flex gap-2.5">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                <p>
                  <strong className="text-ink-800">Strong</strong> — a verified record directly names
                  or demonstrates the requirement.
                </p>
              </div>
              <div className="flex gap-2.5">
                <CircleDashed className="mt-0.5 size-4 shrink-0 text-amber-600" />
                <p>
                  <strong className="text-ink-800">Partial</strong> — related evidence exists, but you
                  must confirm the exact claim.
                </p>
              </div>
              <div className="flex gap-2.5">
                <XCircle className="mt-0.5 size-4 shrink-0 text-ink-400" />
                <p>
                  <strong className="text-ink-800">Not evidenced</strong> — shown as a gap. Never
                  auto-added to the resume.
                </p>
              </div>
            </CardContent>
          </Card>

          {config && !config.aiConfigured ? (
            <InlineNotice tone="warning">
              Gemini is not configured. Matching still works deterministically; AI-only features are
              disabled and labelled honestly.
            </InlineNotice>
          ) : null}

          {matchError ? <InlineNotice tone="danger">{matchError}</InlineNotice> : null}

          <Button className="w-full" size="lg" onClick={onNext} loading={matching}>
            {matching ? 'Matching evidence…' : 'Match portfolio'} <ArrowRight />
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Step 2: match review                                                */
/* ------------------------------------------------------------------ */

function MatchReviewStep({ match, job }: { match: MatchResponse; job: JobDescription }) {
  const counts = {
    strong: match.matches.filter((item) => item.status === 'strong').length,
    partial: match.matches.filter((item) => item.status === 'partial').length,
    not_evidenced: match.matches.filter((item) => item.status === 'not_evidenced').length,
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        {(['strong', 'partial', 'not_evidenced'] as const).map((status) => {
          const meta = MATCH_STATUS_META[status];
          return (
            <div
              key={status}
              className={cn(
                'rounded-2xl border p-5',
                status === 'strong' && 'border-emerald-200 bg-emerald-50/50',
                status === 'partial' && 'border-amber-200 bg-amber-50/50',
                status === 'not_evidenced' && 'border-ink-200 bg-white',
              )}
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">{meta.label}</p>
              <p className="mt-1 text-3xl font-bold tracking-tight text-ink-900">{counts[status]}</p>
              <p className="mt-1 text-xs leading-relaxed text-ink-500">{meta.description}</p>
            </div>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Requirement map</CardTitle>
            <CardDescription>
              {job.jobTitle} · {match.engine === 'gemini+deterministic' ? 'Gemini merged with verified rules' : 'Deterministic evidence rules'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {match.matches.map((item) => {
              const meta = MATCH_STATUS_META[item.status];
              return (
                <div key={`${item.requirement}-${item.requirementType}`} className="rounded-xl border border-ink-100 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[13px] font-semibold text-ink-800">{item.requirement}</p>
                    <Badge tone={meta.tone}>{meta.label}</Badge>
                    <span className="ml-auto text-[10px] uppercase tracking-wide text-ink-400">
                      {REQUIREMENT_TYPE_LABELS[item.requirementType] ?? item.requirementType}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-ink-500">{item.explanation}</p>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Honest gaps</CardTitle>
              <CardDescription>Do not claim these unless you add real evidence.</CardDescription>
            </CardHeader>
            <CardContent>
              {match.missingRequirements.length ? (
                <div className="flex flex-wrap gap-1.5">
                  {match.missingRequirements.map((requirement) => (
                    <span
                      key={requirement}
                      className="rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-800"
                    >
                      {requirement}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-emerald-700">Every extracted requirement has at least partial evidence.</p>
              )}
            </CardContent>
          </Card>

          <InlineNotice tone="info">
            <p className="font-semibold">Next: choose the evidence</p>
            <p className="mt-1 text-xs leading-relaxed">
              The strongest records are preselected. Skills records provide the skills section;
              projects, experience and education provide the body.
            </p>
          </InlineNotice>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Step 3: evidence selection                                          */
/* ------------------------------------------------------------------ */

function EvidenceStep({
  match,
  records,
  selectedIds,
  onChange,
}: {
  match: MatchResponse | null;
  records: PortfolioRecord[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string>('all');
  const [showAll, setShowAll] = useState(false);

  const selectable = useMemo(() => selectableRecords(records), [records]);
  const byId = useMemo(() => new Map(selectable.map((record) => [record.id, record])), [selectable]);

  const ranked = useMemo(() => match?.rankedRecords ?? [], [match]);
  const strongIds = useMemo(() => {
    if (!match) return [];
    const verified = new Set(
      selectable.filter((record) => record.verificationStatus === 'verified').map((record) => record.id),
    );
    return uniqueIds(
      match.matches.filter((item) => item.status === 'strong').flatMap((item) => item.recordIds),
    ).filter((id) => verified.has(id));
  }, [match, selectable]);

  const recommended = useMemo(() => {
    const seen = new Set<string>();
    const list: Array<{ record: PortfolioRecord; relevance?: number; reason?: string }> = [];
    for (const rankedRecord of ranked) {
      const record = byId.get(rankedRecord.recordId);
      if (!record || seen.has(record.id)) continue;
      seen.add(record.id);
      list.push({ record, relevance: rankedRecord.relevance, reason: rankedRecord.reason });
    }
    for (const id of strongIds) {
      const record = byId.get(id);
      if (!record || seen.has(record.id)) continue;
      seen.add(record.id);
      list.push({ record, relevance: 90, reason: 'Directly supports a strong requirement match.' });
    }
    return list;
  }, [ranked, byId, strongIds]);

  const all = useMemo(
    () =>
      filterRecords(
        [...selectable].sort((a, b) => {
          const order = ['projects', 'experience', 'technical_skills', 'soft_skills', 'education', 'certifications'];
          return (order.indexOf(a.category) + 1 || 99) - (order.indexOf(b.category) + 1 || 99) || a.title.localeCompare(b.title);
        }),
        { query: search, category },
      ),
    [selectable, category, search],
  );

  function toggle(id: string) {
    onChange(toggleSelection(selectedIds, id));
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1.45fr_1fr]">
      <div className="space-y-4">
        <div className="flex flex-col gap-2 rounded-2xl border border-ink-200 bg-white p-3 shadow-card sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-400" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search records…"
              className="pl-9"
              aria-label="Search evidence"
            />
          </div>
          <Button size="sm" variant="secondary" onClick={() => onChange(uniqueIds([...selectedIds, ...strongIds]))}>
            Select strong evidence
          </Button>
          <Button size="sm" variant="ghost" onClick={() => onChange([])}>
            Clear
          </Button>
        </div>

        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-ink-900">
            {showAll ? 'All portfolio records' : 'Recommended evidence'}
          </p>
          <Button size="sm" variant="ghost" onClick={() => setShowAll((value) => !value)}>
            {showAll ? 'Show recommended' : `Browse all ${selectable.length}`}
          </Button>
        </div>

        {showAll ? (
          <>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="sm:max-w-xs">
                <SelectValue placeholder="All categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {[...new Set(selectable.map((record) => record.category))].map((value) => (
                  <SelectItem key={value} value={value}>
                    {CATEGORY_META[value as PortfolioCategory]?.label ?? value}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="space-y-2">
              {all.map((record) => (
                <EvidenceRow
                  key={record.id}
                  record={record}
                  checked={selectedIds.includes(record.id)}
                  onToggle={() => toggle(record.id)}
                />
              ))}
              {all.length === 0 ? (
                <p className="rounded-xl border border-dashed border-ink-200 p-6 text-center text-sm text-ink-500">
                  No records match this filter.
                </p>
              ) : null}
            </div>
          </>
        ) : (
          <div className="space-y-2">
            {recommended.map(({ record, relevance, reason }) => (
              <EvidenceRow
                key={record.id}
                record={record}
                checked={selectedIds.includes(record.id)}
                onToggle={() => toggle(record.id)}
                relevance={relevance}
                reason={reason}
              />
            ))}
            {recommended.length === 0 ? (
              <p className="rounded-xl border border-dashed border-ink-200 p-6 text-center text-sm text-ink-500">
                No ranked records for this role. Browse all records to select manually.
              </p>
            ) : null}
          </div>
        )}
      </div>

      <div className="space-y-4">
        <Card className="lg:sticky lg:top-[88px]">
          <CardHeader>
            <CardTitle>Selection</CardTitle>
            <CardDescription>Only verified records can enter a resume.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-end justify-between">
              <p className="text-3xl font-bold tracking-tight text-ink-900">{selectedIds.length}</p>
              <p className="text-xs text-ink-400">records selected</p>
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-ink-100">
              <div
                className="h-full rounded-full bg-brand-600 transition-all"
                style={{ width: `${Math.min(100, (selectedIds.length / Math.max(1, selectable.length)) * 100)}%` }}
              />
            </div>

            <div className="mt-4 max-h-[320px] space-y-2 overflow-y-auto">
              {selectedIds.map((id) => {
                const record = byId.get(id);
                if (!record) return null;
                return (
                  <div key={id} className="flex items-start gap-2 rounded-lg bg-ink-50 px-2.5 py-2">
                    <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-emerald-600" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium text-ink-800">{record.title}</p>
                      <p className="text-[10px] text-ink-400">
                        {CATEGORY_META[record.category]?.label ?? record.category}
                      </p>
                    </div>
                    <button
                      className="text-ink-400 hover:text-rose-600"
                      onClick={() => toggle(id)}
                      aria-label={`Remove ${record.title}`}
                    >
                      ×
                    </button>
                  </div>
                );
              })}
              {selectedIds.length === 0 ? (
                <p className="text-xs text-ink-400">No evidence selected yet.</p>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <InlineNotice tone="info">
          Selecting a skill record adds it to the skills section. Projects, experience and education
          become resume items with the facts you entered.
        </InlineNotice>
      </div>
    </div>
  );
}

function EvidenceRow({
  record,
  checked,
  onToggle,
  relevance,
  reason,
}: {
  record: PortfolioRecord;
  checked: boolean;
  onToggle: () => void;
  relevance?: number;
  reason?: string;
}) {
  const unverified = record.verificationStatus !== 'verified';
  const meta = CATEGORY_META[record.category];
  return (
    <label
      className={cn(
        'flex cursor-pointer items-start gap-3 rounded-xl border bg-white p-3.5 transition',
        checked ? 'border-brand-300 bg-brand-50/30' : 'border-ink-200 hover:border-ink-300',
        unverified && 'cursor-not-allowed opacity-60',
      )}
    >
      <Checkbox
        checked={checked}
        disabled={unverified}
        onCheckedChange={onToggle}
        aria-label={`Select ${record.title}`}
        className="mt-0.5"
      />
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-[13px] font-semibold text-ink-900">{record.title}</span>
          <Badge tone="slate">{meta?.label ?? record.category}</Badge>
          {relevance !== undefined ? (
            <Badge tone={relevance >= 70 ? 'emerald' : relevance >= 40 ? 'amber' : 'slate'}>
              {relevance}% relevance
            </Badge>
          ) : null}
          {unverified ? <Badge tone="rose">Needs review</Badge> : null}
        </span>
        <span className="mt-1 block line-clamp-2 text-[11.5px] leading-relaxed text-ink-500">
          {reason ?? String(record.data.description ?? record.data.evidence ?? record.data.summaryText ?? 'No description.')}
        </span>
      </span>
    </label>
  );
}

/* ------------------------------------------------------------------ */
/* Step 4: customize                                                   */
/* ------------------------------------------------------------------ */

function CustomizeStep({
  title,
  setTitle,
  settings,
  setSettings,
  useAiSummary,
  setUseAiSummary,
  aiConfigured,
  selectedCount,
  job,
  portfolioSummary,
}: {
  title: string;
  setTitle: (value: string) => void;
  settings: ResumeSettings;
  setSettings: (updater: (current: ResumeSettings) => ResumeSettings) => void;
  useAiSummary: boolean;
  setUseAiSummary: (value: boolean) => void;
  aiConfigured: boolean;
  selectedCount: number;
  job: JobDescription;
  portfolioSummary?: { summaryText?: string };
}) {
  function moveSection(index: number, direction: -1 | 1) {
    const next = [...settings.sectionOrder];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target]!, next[index]!];
    setSettings((current) => ({ ...current, sectionOrder: next }));
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1.45fr_1fr]">
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Version details</CardTitle>
            <CardDescription>This title appears in your saved resume library.</CardDescription>
          </CardHeader>
          <CardContent>
            <Field label="Resume title" htmlFor="resume-title" required>
              <Input
                id="resume-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder={`${job.jobTitle} — tailored`}
                maxLength={200}
              />
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Template & layout</CardTitle>
            <CardDescription>All templates are single-column and ATS-readable.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2 sm:grid-cols-3">
              {TEMPLATE_META.map((template) => {
                const active = settings.template === template.value;
                return (
                  <button
                    key={template.value}
                    onClick={() => setSettings((current) => ({ ...current, template: template.value }))}
                    className={cn(
                      'rounded-xl border p-3 text-left transition',
                      active ? 'border-brand-400 bg-brand-50/40 ring-2 ring-brand-100' : 'border-ink-200 hover:border-ink-300',
                    )}
                  >
                    <MiniTemplate template={template.value} active={active} />
                    <p className="mt-2 text-xs font-semibold text-ink-900">{template.label}</p>
                    <p className="mt-0.5 text-[10px] leading-relaxed text-ink-400">{template.description}</p>
                  </button>
                );
              })}
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              {[
                { value: 'one_page' as const, label: 'Prefer one page', hint: 'Tighter margins and type.' },
                { value: 'two_page' as const, label: 'Allow two pages', hint: 'Roomier spacing and type.' },
              ].map((layout) => (
                <button
                  key={layout.value}
                  onClick={() => setSettings((current) => ({ ...current, layout: layout.value }))}
                  className={cn(
                    'rounded-xl border px-3 py-2.5 text-left transition',
                    settings.layout === layout.value
                      ? 'border-brand-400 bg-brand-50/40'
                      : 'border-ink-200 hover:border-ink-300',
                  )}
                >
                  <p className="text-xs font-semibold text-ink-900">{layout.label}</p>
                  <p className="text-[10px] text-ink-400">{layout.hint}</p>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Professional summary</CardTitle>
            <CardDescription>
              Leave blank to use your verified portfolio summary. Never add unsupported claims.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              value={settings.summary ?? ''}
              onChange={(event) =>
                setSettings((current) => ({ ...current, summary: event.target.value.slice(0, 1500) }))
              }
              rows={5}
              placeholder={portfolioSummary?.summaryText ?? 'A concise, evidence-backed summary for this role…'}
            />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[11px] text-ink-400">{(settings.summary ?? '').length} / 1500 characters</p>
              {settings.summary ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSettings((current) => ({ ...current, summary: '' }))}
                >
                  Clear and use portfolio summary
                </Button>
              ) : null}
            </div>
            <label
              className={cn(
                'flex items-start gap-2.5 rounded-xl border px-3 py-2.5',
                aiConfigured ? 'border-ink-200' : 'border-ink-200 bg-ink-50/60 opacity-70',
              )}
            >
              <Checkbox
                checked={useAiSummary}
                disabled={!aiConfigured}
                onCheckedChange={(checked) => setUseAiSummary(checked === true)}
                aria-label="Draft summary with Gemini"
                className="mt-0.5"
              />
              <span>
                <span className="flex items-center gap-1.5 text-xs font-semibold text-ink-800">
                  <Sparkles className="size-3.5 text-brand-500" /> Draft summary with Gemini
                </span>
                <span className="block text-[11px] leading-relaxed text-ink-400">
                  {aiConfigured
                    ? 'Server-side only. The result is checked against your selected records; unsupported numbers or skills are rejected.'
                    : 'Requires a Gemini API key configured on the server.'}
                </span>
              </span>
            </label>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Contact overrides</CardTitle>
            <CardDescription>Optional. Blank fields fall back to your personal information record.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            {[
              ['fullName', 'Full name'],
              ['headline', 'Headline'],
              ['email', 'Email'],
              ['location', 'Location'],
            ].map(([key, label]) => (
              <Field key={key} label={label} htmlFor={`override-${key}`}>
                <Input
                  id={`override-${key}`}
                  value={String(settings.contactOverrides[key as keyof typeof settings.contactOverrides] ?? '')}
                  onChange={(event) =>
                    setSettings((current) => ({
                      ...current,
                      contactOverrides: { ...current.contactOverrides, [key]: event.target.value },
                    }))
                  }
                  placeholder={`Portfolio ${label.toLowerCase()}`}
                />
              </Field>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <Card className="lg:sticky lg:top-[88px]">
          <CardHeader>
            <CardTitle>Section order</CardTitle>
            <CardDescription>Sections without selected evidence are omitted automatically.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {settings.sectionOrder.map((section, index) => (
              <div
                key={section}
                className="flex items-center gap-2 rounded-lg border border-ink-100 bg-ink-50/50 px-2.5 py-1.5"
              >
                <span className="w-4 text-center text-[10px] font-bold text-ink-400">{index + 1}</span>
                <span className="flex-1 text-xs font-medium text-ink-700">
                  {RESUME_SECTION_LABELS[section]}
                </span>
                <button
                  disabled={index === 0}
                  onClick={() => moveSection(index, -1)}
                  className="rounded p-0.5 text-ink-400 hover:bg-white hover:text-ink-700 disabled:opacity-30"
                  aria-label={`Move ${RESUME_SECTION_LABELS[section]} up`}
                >
                  <ChevronUp className="size-3.5" />
                </button>
                <button
                  disabled={index === settings.sectionOrder.length - 1}
                  onClick={() => moveSection(index, 1)}
                  className="rounded p-0.5 text-ink-400 hover:bg-white hover:text-ink-700 disabled:opacity-30"
                  aria-label={`Move ${RESUME_SECTION_LABELS[section]} down`}
                >
                  <ChevronDown className="size-3.5" />
                </button>
              </div>
            ))}
            <Button
              variant="ghost"
              size="sm"
              className="mt-1 w-full"
              onClick={() =>
                setSettings((current) => ({ ...current, sectionOrder: [...DEFAULT_SECTION_ORDER] }))
              }
            >
              Reset default order
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 pt-4 text-xs text-ink-500">
            <p className="font-semibold text-ink-800">{job.jobTitle}</p>
            <p className="mt-0.5">{job.company || 'Company not specified'}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge tone="indigo">{selectedCount} records</Badge>
              <Badge tone="slate">{settings.template}</Badge>
              <Badge tone="slate">{settings.layout.replace('_', ' ')}</Badge>
              {useAiSummary && aiConfigured ? <Badge tone="emerald">AI summary</Badge> : null}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function MiniTemplate({ template, active }: { template: ResumeTemplate; active: boolean }) {
  return (
    <div
      className={cn(
        'space-y-1 rounded-md border bg-white p-2',
        active ? 'border-brand-200' : 'border-ink-200',
        template === 'classic' && 'font-serif',
      )}
    >
      <div className={cn('h-1.5 w-2/3 rounded-full bg-ink-300', template === 'classic' && 'mx-auto')} />
      <div className={cn('h-1 w-1/2 rounded-full bg-ink-200', template === 'classic' && 'mx-auto')} />
      <div className="mt-1.5 h-px bg-ink-200" />
      <div className="h-1 w-1/3 rounded-full bg-brand-300" />
      <div className="space-y-0.5">
        <div className="h-0.5 w-full rounded-full bg-ink-200" />
        <div className="h-0.5 w-11/12 rounded-full bg-ink-200" />
        <div className={cn('h-0.5 w-10/12 rounded-full bg-ink-200', template === 'compact' && 'hidden')} />
      </div>
      <div className="h-1 w-1/4 rounded-full bg-brand-300" />
      <div className="h-0.5 w-full rounded-full bg-ink-200" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Step 5: preview                                                     */
/* ------------------------------------------------------------------ */

function PreviewStep({
  generating,
  error,
  generated,
  stale,
  onRefresh,
  request,
  suggestions,
  suggestionsNote,
  suggestionsLoading,
}: {
  generating: boolean;
  error: string | null;
  generated: GenerateResumeResponse | null;
  stale: boolean;
  onRefresh: () => void;
  request: GenerateResumeRequest | null;
  suggestions: ImprovementSuggestion[];
  suggestionsNote: string;
  suggestionsLoading: boolean;
}) {
  const [view, setView] = useState<'document' | 'pdf'>('document');

  if (generating && !generated) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-14 w-full" />
        <Skeleton className="mx-auto h-[700px] w-full max-w-[794px]" />
      </div>
    );
  }

  if (error && !generated) {
    return <ErrorState title="Preview failed" message={error} onRetry={onRefresh} />;
  }

  if (!generated) return null;

  return (
    <div className="space-y-4">
      {stale ? (
        <InlineNotice tone="warning">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>Your selections or settings changed since this preview was generated.</span>
            <Button size="sm" variant="outline" onClick={onRefresh}>
              Refresh preview
            </Button>
          </div>
        </InlineNotice>
      ) : null}

      {generated.document.warnings.length ? (
        <InlineNotice tone="warning">
          <div className="flex items-start gap-2">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" />
            <div>
              {generated.document.warnings.map((warning) => (
                <p key={warning}>{warning}</p>
              ))}
            </div>
          </div>
        </InlineNotice>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-ink-200 bg-white px-4 py-3 shadow-card">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={generated.document.engine === 'gemini-assisted' ? 'emerald' : 'indigo'}>
            {generated.document.engine === 'gemini-assisted' ? 'Gemini-assisted' : 'Deterministic assembly'}
          </Badge>
          <Badge tone="slate">{generated.document.template}</Badge>
          <Badge tone="slate">{generated.document.layout.replace('_', ' ')}</Badge>
          <span className="text-[11px] text-ink-400">
            Generation {generated.generationVersion.slice(0, 12)} · {formatDate(generated.document.generatedAt)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant={view === 'document' ? 'secondary' : 'ghost'}
            onClick={() => setView('document')}
          >
            Document
          </Button>
          <Button
            size="sm"
            variant={view === 'pdf' ? 'secondary' : 'ghost'}
            onClick={() => setView('pdf')}
            disabled={!request}
          >
            Exact PDF
          </Button>
          {stale || generating ? (
            <Button size="sm" variant="outline" onClick={onRefresh} loading={generating}>
              Refresh
            </Button>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 2xl:grid-cols-[1fr_300px]">
        <div className="min-w-0">
          {view === 'document' ? (
            <div className="rounded-2xl border border-ink-200 bg-ink-100/70 p-3 sm:p-5">
              <ResumePreview document={generated.document} />
            </div>
          ) : request ? (
            <PdfViewer
              key={generated.generationVersion}
              load={() => api.previewPdfBlob(request)}
              title={`${generated.document.name} — exact server PDF`}
            />
          ) : null}
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Improvement suggestions</CardTitle>
              <CardDescription>Honest gaps and weak evidence, not invented filler.</CardDescription>
            </CardHeader>
            <CardContent>
              {suggestionsLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : suggestions.length ? (
                <ul className="space-y-2">
                  {suggestions.slice(0, 8).map((suggestion, index) => (
                    <li
                      key={`${suggestion.type}-${index}`}
                      className="rounded-xl border border-ink-100 bg-ink-50/50 p-2.5"
                    >
                      <Badge tone={suggestion.type === 'missing_skill' ? 'amber' : 'slate'}>
                        {suggestion.type.replace(/_/g, ' ')}
                      </Badge>
                      <p className="mt-1.5 text-[11.5px] leading-relaxed text-ink-600">
                        {suggestion.message}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs leading-relaxed text-ink-500">
                  No suggestions for this selection. {suggestionsNote}
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Preview fidelity</CardTitle>
            </CardHeader>
            <CardContent className="text-[11.5px] leading-relaxed text-ink-500">
              The document view mirrors the saved snapshot. Switch to{' '}
              <strong className="text-ink-700">Exact PDF</strong> to inspect the server-rendered A4
              file — the download uses the same renderer, so content cannot drift.
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Step 6: save & export                                               */
/* ------------------------------------------------------------------ */

function SaveStep({
  title,
  setTitle,
  job,
  selectedCount,
  settings,
  generated,
  saving,
  saved,
  downloading,
  onSave,
  onDownload,
  onBuildAnother,
  onOpenSaved,
}: {
  title: string;
  setTitle: (value: string) => void;
  job: JobDescription;
  selectedCount: number;
  settings: ResumeSettings;
  generated: GenerateResumeResponse | null;
  saving: boolean;
  saved: SavedResume | null;
  downloading: boolean;
  onSave: () => void;
  onDownload: () => void;
  onBuildAnother: () => void;
  onOpenSaved: () => void;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
      <Card>
        <CardHeader>
          <CardTitle>{saved ? 'Version saved' : 'Save this version'}</CardTitle>
          <CardDescription>
            Saving stores a complete snapshot: document, selections and settings. Future portfolio
            edits will mark it outdated rather than changing it silently.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {saved ? (
            <InlineNotice tone="success">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
                <div>
                  <p className="font-semibold">“{saved.title}” saved.</p>
                  <p className="mt-0.5 text-xs">
                    Snapshot created {formatDate(saved.createdAt)}. You can reopen and download it any
                    time.
                  </p>
                </div>
              </div>
            </InlineNotice>
          ) : null}

          <Field label="Resume title" htmlFor="save-title" required>
            <Input
              id="save-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={200}
            />
          </Field>

          <div className="grid gap-2 rounded-xl border border-ink-100 bg-ink-50/60 p-3 text-xs text-ink-500 sm:grid-cols-2">
            <p>
              <span className="text-ink-400">Role</span>
              <br />
              <span className="font-medium text-ink-800">{job.jobTitle}</span>
            </p>
            <p>
              <span className="text-ink-400">Company</span>
              <br />
              <span className="font-medium text-ink-800">{job.company || 'Not specified'}</span>
            </p>
            <p>
              <span className="text-ink-400">Evidence</span>
              <br />
              <span className="font-medium text-ink-800">{selectedCount} verified records</span>
            </p>
            <p>
              <span className="text-ink-400">Format</span>
              <br />
              <span className="font-medium capitalize text-ink-800">
                {settings.template} · {settings.layout.replace('_', ' ')}
              </span>
            </p>
            <p className="sm:col-span-2">
              <span className="text-ink-400">Assembly</span>
              <br />
              <span className="font-medium text-ink-800">
                {generated?.document.engine === 'gemini-assisted'
                  ? 'Gemini-assisted summary, deterministic document assembly'
                  : 'Deterministic, evidence-grounded assembly'}
              </span>
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button onClick={onSave} loading={saving} disabled={Boolean(saved)} className="flex-1">
              <Save /> {saved ? 'Saved' : 'Save snapshot'}
            </Button>
            <Button variant="outline" onClick={onDownload} loading={downloading} className="flex-1">
              <Download /> Download PDF
            </Button>
          </div>

          {saved ? (
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button variant="secondary" onClick={onOpenSaved} className="flex-1">
                <FileText /> Open saved resume
              </Button>
              <Button variant="outline" onClick={onBuildAnother} className="flex-1">
                Build another version
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>What gets saved</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5 text-[12.5px] leading-relaxed text-ink-500">
            {[
              'The exact resume document shown in preview',
              'Job description and requirement analysis reference',
              'Selected portfolio record IDs',
              'Template, layout, section order and contact overrides',
              'A fingerprint for detecting outdated versions',
            ].map((item) => (
              <div key={item} className="flex gap-2">
                <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-emerald-600" />
                {item}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 pt-4 text-xs leading-relaxed text-ink-500">
            <p className="flex items-center gap-1.5 font-semibold text-ink-800">
              <Loader2 className="size-3.5 text-brand-500" /> PDF safety
            </p>
            <p className="mt-1.5">
              PDFs are generated on the server from the approved snapshot, with safe filenames,
              wrapping text, working links and page numbers.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
