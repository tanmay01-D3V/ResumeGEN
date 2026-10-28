import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Bot,
  Briefcase,
  CheckCircle2,
  CircleDashed,
  FileSearch,
  RefreshCw,
  Sparkles,
  Trash2,
  TriangleAlert,
  XCircle,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { InlineNotice } from '@/components/ui/states';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { api } from '@/lib/api';
import { cn, formatDateTime, MATCH_STATUS_META, REQUIREMENT_TYPE_LABELS } from '@/lib/utils';
import type { JobDescription, MatchItem, MatchResponse } from '@shared/types';

const STATUS_ORDER: MatchItem['status'][] = ['strong', 'partial', 'not_evidenced'];

const STATUS_ICON = {
  strong: CheckCircle2,
  partial: CircleDashed,
  not_evidenced: XCircle,
};

export function JobDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [job, setJob] = useState<JobDescription | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [aiWarning, setAiWarning] = useState<string | null>(null);
  const [matching, setMatching] = useState(false);
  const [match, setMatch] = useState<MatchResponse | null>(null);
  const [matchError, setMatchError] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.getJob(id);
      setJob(result.job);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not load this job.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function analyze() {
    setAnalyzing(true);
    setAiWarning(null);
    try {
      const result = await api.analyzeJob(id);
      setJob(result.job);
      if (result.warning) {
        setAiWarning(result.warning);
        toast.warning('Analysis completed with the local heuristic engine.');
      } else {
        toast.success('Gemini analysis complete.');
      }
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : 'Analysis failed.');
    } finally {
      setAnalyzing(false);
    }
  }

  async function runMatch() {
    setMatching(true);
    setMatchError(null);
    try {
      const result = await api.match(id, true);
      setMatch(result);
      toast.success(
        `Matched ${result.matches.length} requirements using ${result.engine === 'gemini+deterministic' ? 'Gemini plus verified rules' : 'deterministic evidence rules'}.`,
      );
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Matching failed.';
      setMatchError(message);
      toast.error(message);
    } finally {
      setMatching(false);
    }
  }

  async function handleDelete() {
    try {
      await api.deleteJob(id);
      toast.success('Job description deleted');
      navigate('/jobs');
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : 'Could not delete the job.');
    }
  }

  if (loading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-9 w-2/3" />
        <div className="grid gap-4 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6">
        <p className="text-sm font-semibold text-rose-900">{error ?? 'Job not found.'}</p>
        <Button variant="outline" className="mt-3" asChild>
          <Link to="/jobs">
            <ArrowLeft /> Back to Job Analyzer
          </Link>
        </Button>
      </div>
    );
  }

  const analysis = job.analysis;
  const counts = match
    ? STATUS_ORDER.reduce<Record<string, number>>(
        (acc, status) => {
          acc[status] = match.matches.filter((item) => item.status === status).length;
          return acc;
        },
        {},
      )
    : null;

  return (
    <div className="space-y-6 animate-in-up">
      <Link
        to="/jobs"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-500 transition hover:text-brand-700"
      >
        <ArrowLeft className="size-3.5" /> All job descriptions
      </Link>

      <PageHeader
        eyebrow={job.company || 'Job description'}
        title={job.jobTitle}
        description={`Added ${formatDateTime(job.createdAt)} · ${job.rawText.length.toLocaleString()} characters`}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => setDeleteOpen(true)}>
              <Trash2 /> Delete
            </Button>
            <Button variant="outline" size="sm" onClick={() => void analyze()} loading={analyzing}>
              <RefreshCw /> {analysis ? 'Re-analyze' : 'Analyze'}
            </Button>
            <Button size="sm" onClick={() => void runMatch()} loading={matching} disabled={!analysis}>
              <Sparkles /> {match ? 'Re-match' : 'Match portfolio'}
            </Button>
          </>
        }
      />

      {aiWarning ? (
        <InlineNotice tone="warning">
          <div className="flex items-start gap-2">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" />
            {aiWarning}
          </div>
        </InlineNotice>
      ) : null}

      {!analysis ? (
        <div className="rounded-2xl border border-dashed border-ink-300 bg-white px-6 py-14 text-center">
          <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
            <FileSearch className="size-6" />
          </div>
          <h2 className="text-base font-semibold text-ink-900">This job has not been analyzed</h2>
          <p className="mx-auto mt-1.5 max-w-md text-sm text-ink-500">
            Run analysis to extract required skills, preferred skills, qualifications and
            responsibilities before matching your portfolio.
          </p>
          <Button className="mt-5" onClick={() => void analyze()} loading={analyzing}>
            <Sparkles /> Analyze requirements
          </Button>
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryStat label="Required skills" value={analysis.requiredSkills.length} tone="indigo" />
            <SummaryStat label="Preferred skills" value={analysis.preferredSkills.length} tone="sky" />
            <SummaryStat label="Qualifications" value={analysis.qualifications.length + analysis.preferredQualifications.length} tone="amber" />
            <SummaryStat label="Responsibilities" value={analysis.responsibilities.length} tone="slate" />
          </div>

          <div className="grid gap-5 xl:grid-cols-[1.35fr_1fr]">
            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <CardTitle>Extracted requirements</CardTitle>
                    <CardDescription>
                      Source-traceable only. Preferred items never silently become required.
                    </CardDescription>
                  </div>
                  <Badge tone={job.analysisEngine === 'gemini' ? 'emerald' : 'amber'}>
                    <Bot className="size-3" />
                    {job.analysisEngine === 'gemini' ? 'Gemini' : 'Local heuristic'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-1">
                <Tabs defaultValue="requirements">
                  <TabsList>
                    <TabsTrigger value="requirements">Skills & qualifications</TabsTrigger>
                    <TabsTrigger value="responsibilities">Responsibilities</TabsTrigger>
                    <TabsTrigger value="keywords">Keywords</TabsTrigger>
                  </TabsList>

                  <TabsContent value="requirements" className="mt-4 space-y-5">
                    <RequirementGroup
                      title="Required skills"
                      items={analysis.requiredSkills}
                      tone="indigo"
                    />
                    <RequirementGroup
                      title="Preferred skills"
                      items={analysis.preferredSkills}
                      tone="sky"
                    />
                    <RequirementGroup title="Qualifications" items={analysis.qualifications} tone="slate" />
                    <RequirementGroup
                      title="Preferred qualifications"
                      items={analysis.preferredQualifications}
                      tone="amber"
                    />
                    <RequirementGroup
                      title="Experience requirements"
                      items={analysis.experienceRequirements}
                      tone="slate"
                    />
                    {analysis.requestedCertifications.length ? (
                      <RequirementGroup
                        title="Certifications mentioned"
                        items={analysis.requestedCertifications}
                        tone="emerald"
                      />
                    ) : null}
                  </TabsContent>

                  <TabsContent value="responsibilities" className="mt-4">
                    {analysis.responsibilities.length ? (
                      <ul className="space-y-2.5">
                        {analysis.responsibilities.map((item) => (
                          <li key={item} className="flex gap-2.5 text-sm leading-relaxed text-ink-600">
                            <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-brand-400" />
                            {item}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="py-6 text-center text-sm text-ink-500">No responsibilities extracted.</p>
                    )}
                  </TabsContent>

                  <TabsContent value="keywords" className="mt-4">
                    <div className="flex flex-wrap gap-1.5">
                      {analysis.keywords.map((keyword) => (
                        <span
                          key={keyword}
                          className="rounded-lg border border-ink-200 bg-ink-50 px-2.5 py-1 text-xs font-medium text-ink-600"
                        >
                          {keyword}
                        </span>
                      ))}
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>

            <div className="space-y-5">
              <Card>
                <CardHeader>
                  <CardTitle>Portfolio match</CardTitle>
                  <CardDescription>
                    Verified evidence only. Missing requirements stay visible.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {match ? (
                    <>
                      <div className="grid grid-cols-3 gap-2">
                        {STATUS_ORDER.map((status) => {
                          const Icon = STATUS_ICON[status];
                          const meta = MATCH_STATUS_META[status];
                          return (
                            <div
                              key={status}
                              className={cn(
                                'rounded-xl border p-3 text-center',
                                status === 'strong' && 'border-emerald-200 bg-emerald-50/60',
                                status === 'partial' && 'border-amber-200 bg-amber-50/60',
                                status === 'not_evidenced' && 'border-ink-200 bg-ink-50',
                              )}
                            >
                              <Icon
                                className={cn(
                                  'mx-auto size-4',
                                  status === 'strong' && 'text-emerald-600',
                                  status === 'partial' && 'text-amber-600',
                                  status === 'not_evidenced' && 'text-ink-400',
                                )}
                              />
                              <p className="mt-1 text-xl font-bold text-ink-900">{counts?.[status] ?? 0}</p>
                              <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-500">
                                {meta.label}
                              </p>
                            </div>
                          );
                        })}
                      </div>

                      <div className="mt-4 space-y-2">
                        {match.matches.slice(0, 8).map((item) => {
                          const meta = MATCH_STATUS_META[item.status];
                          return (
                            <div
                              key={`${item.requirement}-${item.requirementType}`}
                              className="flex items-start justify-between gap-3 rounded-xl border border-ink-100 px-3 py-2.5"
                            >
                              <div className="min-w-0">
                                <p className="truncate text-[13px] font-medium text-ink-800">
                                  {item.requirement}
                                </p>
                                <p className="text-[11px] text-ink-400">
                                  {REQUIREMENT_TYPE_LABELS[item.requirementType] ?? item.requirementType}
                                </p>
                              </div>
                              <Badge tone={meta.tone}>{meta.label}</Badge>
                            </div>
                          );
                        })}
                      </div>

                      {match.missingRequirements.length ? (
                        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/70 p-3">
                          <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-amber-800">
                            <TriangleAlert className="size-3.5" /> Honest gaps
                          </p>
                          <p className="mt-1 text-xs leading-relaxed text-amber-800/80">
                            {match.missingRequirements.slice(0, 6).join(' · ')}
                          </p>
                        </div>
                      ) : null}

                      <p className="mt-3 text-[11px] leading-relaxed text-ink-400">{match.notes}</p>

                      <Button className="mt-4 w-full" asChild>
                        <Link to={`/resume-builder?jd=${job.id}`}>
                          Build tailored resume <ArrowRight />
                        </Link>
                      </Button>
                    </>
                  ) : (
                    <div className="py-4 text-center">
                      <div className="mx-auto mb-3 flex size-11 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
                        <BadgeCheck className="size-5" />
                      </div>
                      <p className="text-sm font-semibold text-ink-800">See how your evidence lines up</p>
                      <p className="mx-auto mt-1 max-w-xs text-xs leading-relaxed text-ink-500">
                        Matching is deterministic first. If Gemini is configured, it may only add
                        record IDs that already exist in your portfolio.
                      </p>
                      <Button className="mt-4 w-full" onClick={() => void runMatch()} loading={matching}>
                        <Sparkles /> Match my portfolio
                      </Button>
                      {matchError ? <p className="mt-2 text-xs text-rose-600">{matchError}</p> : null}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Raw job description</CardTitle>
                  <CardDescription>The source of truth for this analysis.</CardDescription>
                </CardHeader>
                <CardContent>
                  <pre className="scrollbar-thin max-h-64 overflow-auto whitespace-pre-wrap rounded-xl bg-ink-50 p-3 font-sans text-[11.5px] leading-relaxed text-ink-600">
                    {job.rawText}
                  </pre>
                  {job.jobUrl ? (
                    <a
                      href={job.jobUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:underline"
                    >
                      <Briefcase className="size-3.5" /> Original posting
                    </a>
                  ) : null}
                </CardContent>
              </Card>
            </div>
          </div>

          {match ? <MatchExplorer match={match} /> : null}
        </>
      )}

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete this job description?"
        description={`“${job.jobTitle}” and its analysis will be removed. Saved resumes keep their snapshot.`}
        onConfirm={handleDelete}
      />
    </div>
  );
}

function SummaryStat({ label, value, tone }: { label: string; value: number; tone: 'indigo' | 'sky' | 'amber' | 'slate' }) {
  const toneClass = {
    indigo: 'bg-brand-50 text-brand-700',
    sky: 'bg-sky-50 text-sky-700',
    amber: 'bg-amber-50 text-amber-700',
    slate: 'bg-ink-100 text-ink-600',
  }[tone];
  return (
    <div className="rounded-2xl border border-ink-200 bg-white p-4 shadow-card">
      <p className="text-xs font-medium text-ink-500">{label}</p>
      <div className="mt-1.5 flex items-end justify-between">
        <p className="text-2xl font-bold tracking-tight text-ink-900">{value}</p>
        <span className={cn('size-2.5 rounded-full', toneClass)} />
      </div>
    </div>
  );
}

function RequirementGroup({
  title,
  items,
  tone,
}: {
  title: string;
  items: string[];
  tone: 'indigo' | 'sky' | 'amber' | 'slate' | 'emerald';
}) {
  if (!items.length) return null;
  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <h4 className="text-[11px] font-bold uppercase tracking-[0.12em] text-ink-400">{title}</h4>
        <span className="text-[10px] font-semibold text-ink-300">{items.length}</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {items.map((item) => (
          <Badge key={item} tone={tone} className="normal-case tracking-normal">
            {item}
          </Badge>
        ))}
      </div>
    </div>
  );
}

function MatchExplorer({ match }: { match: MatchResponse }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Requirement-by-requirement evidence</CardTitle>
        <CardDescription>
          Each status explains which portfolio record supports — or fails to support — the claim.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {STATUS_ORDER.map((status) => {
          const items = match.matches.filter((item) => item.status === status);
          if (!items.length) return null;
          const meta = MATCH_STATUS_META[status];
          const Icon = STATUS_ICON[status];
          return (
            <div key={status} className="rounded-xl border border-ink-200">
              <div className="flex items-center gap-2 border-b border-ink-100 px-4 py-2.5">
                <Icon
                  className={cn(
                    'size-4',
                    status === 'strong' && 'text-emerald-600',
                    status === 'partial' && 'text-amber-600',
                    status === 'not_evidenced' && 'text-ink-400',
                  )}
                />
                <p className="text-xs font-bold uppercase tracking-wide text-ink-600">{meta.label}</p>
                <span className="text-[11px] text-ink-400">{items.length}</span>
                <span className="ml-auto hidden text-[11px] text-ink-400 sm:block">{meta.description}</span>
              </div>
              <ul className="divide-y divide-ink-100">
                {items.map((item) => (
                  <li key={`${item.requirement}-${item.requirementType}`} className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-[13px] font-semibold text-ink-800">{item.requirement}</p>
                      <Badge tone="slate">{REQUIREMENT_TYPE_LABELS[item.requirementType] ?? item.requirementType}</Badge>
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-ink-500">{item.explanation}</p>
                    {item.evidence.length ? (
                      <div className="mt-2 space-y-1">
                        {item.evidence.slice(0, 2).map((evidence) => (
                          <p
                            key={`${item.requirement}-${evidence.recordId}`}
                            className="rounded-lg bg-ink-50 px-2.5 py-1.5 text-[11px] leading-relaxed text-ink-500"
                          >
                            “{evidence.excerpt}”
                          </p>
                        ))}
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
