import {
  ArrowRight,
  BadgeCheck,
  Bot,
  Briefcase,
  FileText,
  FolderKanban,
  Layers,
  Plus,
  Sheet,
  Sparkles,
  Target,
  TrendingUp,
  Wand2,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState, ErrorState, InlineNotice } from '@/components/ui/states';
import { StatCard } from '@/components/ui/stat-card';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { cn, formatDate, relativeTime, titleCase } from '@/lib/utils';
import { CATEGORY_META } from '@shared/categories';
import type { DashboardResponse } from '@shared/types';

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export function DashboardPage() {
  const { user, config } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await api.dashboard());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not load the dashboard.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function seed() {
    setSeeding(true);
    try {
      const result = await api.seed();
      toast.success(`Loaded ${result.created} fictional portfolio records and ${result.jobDescriptions} sample jobs.`);
      await load();
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : 'Could not load demo data.');
    } finally {
      setSeeding(false);
    }
  }

  const firstName = (user?.displayName || user?.email || 'there').split(/[\s@]/)[0];
  const counts = data?.counts;
  const isEmpty = Boolean(data && counts && counts.portfolioEntries === 0);

  const checklist = [
    { label: 'Personal information added', done: Boolean(data?.hasPersonalInfo) },
    { label: 'Professional summary added', done: Boolean(data?.hasSummary) },
    { label: 'At least 3 projects', done: (counts?.projects ?? 0) >= 3 },
    { label: 'At least 3 technical skills', done: (counts?.technicalSkills ?? 0) >= 3 },
    { label: 'A job description analyzed', done: (counts?.jobDescriptions ?? 0) >= 1 },
    { label: 'A tailored resume saved', done: (counts?.savedResumes ?? 0) >= 1 },
  ];
  const completed = checklist.filter((item) => item.done).length;
  const progress = Math.round((completed / checklist.length) * 100);

  return (
    <div className="space-y-7 animate-in-up">
      <PageHeader
        eyebrow={formatDate(new Date().toISOString())}
        title={`${greeting()}, ${firstName}.`}
        description="Your evidence, matched to the roles you actually want. Start with a job description or strengthen your portfolio."
        actions={
          <>
            <Button variant="outline" asChild>
              <Link to="/portfolio">
                <Layers /> Portfolio
              </Link>
            </Button>
            <Button asChild>
              <Link to="/jobs">
                <Target /> Analyze a job
              </Link>
            </Button>
          </>
        }
      />

      {loading ? (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="rounded-2xl border border-ink-200 bg-white p-5">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="mt-4 h-8 w-16" />
                <Skeleton className="mt-3 h-3 w-32" />
              </div>
            ))}
          </div>
          <div className="grid gap-5 lg:grid-cols-3">
            <Skeleton className="h-72 lg:col-span-2" />
            <Skeleton className="h-72" />
          </div>
        </div>
      ) : error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : isEmpty ? (
        <EmptyState
          icon={<Sparkles className="size-6" />}
          title="Your workspace is ready"
          description="Load the fictional demo portfolio to explore matching, tailoring and PDF export immediately — or add your own first record."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button onClick={() => void seed()} loading={seeding}>
                <Wand2 /> Load demo portfolio
              </Button>
              <Button variant="outline" onClick={() => navigate('/portfolio?new=1')}>
                <Plus /> Add my first record
              </Button>
            </div>
          }
        />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Portfolio records"
              value={counts?.portfolioEntries ?? 0}
              hint={`${counts?.technicalSkills ?? 0} skills · ${counts?.certifications ?? 0} certifications`}
              icon={Layers}
              tone="brand"
            />
            <StatCard
              label="Projects"
              value={counts?.projects ?? 0}
              hint={`${counts?.experiences ?? 0} experience entries`}
              icon={FolderKanban}
              tone="sky"
            />
            <StatCard
              label="Saved resumes"
              value={counts?.savedResumes ?? 0}
              hint="Each snapshot is reproducible"
              icon={FileText}
              tone="emerald"
            />
            <StatCard
              label="Job descriptions"
              value={counts?.jobDescriptions ?? 0}
              hint="Analyzed for requirements"
              icon={Briefcase}
              tone="amber"
            />
          </div>

          <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
            <div className="min-w-0 space-y-5">
              <Card>
                <CardHeader className="flex-row items-start justify-between gap-4">
                  <div>
                    <CardTitle>Recent portfolio evidence</CardTitle>
                    <CardDescription>What your next resume can draw from.</CardDescription>
                  </div>
                  <Button variant="ghost" size="sm" asChild>
                    <Link to="/portfolio">
                      View all <ArrowRight />
                    </Link>
                  </Button>
                </CardHeader>
                <CardContent className="pt-0">
                  {data?.recentRecords.length ? (
                    <ul className="divide-y divide-ink-100">
                      {data.recentRecords.slice(0, 6).map((record) => (
                        <li key={record.id}>
                          <Link
                            to={`/portfolio?category=${record.category}`}
                            className="group flex items-center gap-3 py-3 first:pt-0 last:pb-0"
                          >
                            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-ink-50 text-ink-400 group-hover:bg-brand-50 group-hover:text-brand-600">
                              <BadgeCheck className="size-4" />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-medium text-ink-800 group-hover:text-brand-700">
                                {record.title}
                              </span>
                              <span className="block text-xs text-ink-400">
                                {CATEGORY_META[record.category as keyof typeof CATEGORY_META]?.label ??
                                  titleCase(record.category)}{' '}
                                · updated {relativeTime(record.updatedAt)}
                              </span>
                            </span>
                            <ArrowRight className="size-4 text-ink-300 opacity-0 transition group-hover:opacity-100" />
                          </Link>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="py-6 text-center text-sm text-ink-500">No portfolio records yet.</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex-row items-start justify-between gap-4">
                  <div>
                    <CardTitle>Saved resume versions</CardTitle>
                    <CardDescription>Snapshots stay readable even as your portfolio evolves.</CardDescription>
                  </div>
                  <Button variant="ghost" size="sm" asChild>
                    <Link to="/resumes">
                      Open library <ArrowRight />
                    </Link>
                  </Button>
                </CardHeader>
                <CardContent className="pt-0">
                  {data?.recentResumes.length ? (
                    <ul className="divide-y divide-ink-100">
                      {data.recentResumes.slice(0, 4).map((resume) => (
                        <li key={resume.id}>
                          <Link to={`/resumes/${resume.id}`} className="group flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                              <FileText className="size-4" />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-medium text-ink-800 group-hover:text-brand-700">
                                {resume.title}
                              </span>
                              <span className="block truncate text-xs text-ink-400">
                                {resume.jobTitle}
                                {resume.company ? ` · ${resume.company}` : ''} · {relativeTime(resume.updatedAt)}
                              </span>
                            </span>
                            <Badge tone="indigo">PDF</Badge>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="py-4">
                      <p className="text-sm text-ink-500">
                        No saved versions yet. Tailor your first resume from a job description.
                      </p>
                      <Button variant="outline" size="sm" className="mt-3" asChild>
                        <Link to="/resume-builder">
                          <Sparkles /> Start building
                        </Link>
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="min-w-0 space-y-5">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Resume readiness</CardTitle>
                    <span className="text-sm font-bold text-brand-700">{progress}%</span>
                  </div>
                  <CardDescription>Strong evidence makes stronger resumes.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-2 overflow-hidden rounded-full bg-ink-100">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-brand-500 to-brand-700 transition-all duration-500"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <ul className="mt-4 space-y-2.5">
                    {checklist.map((item) => (
                      <li key={item.label} className="flex items-center gap-2.5 text-[13px]">
                        <span
                          className={cn(
                            'flex size-4.5 items-center justify-center rounded-full border',
                            item.done
                              ? 'border-emerald-500 bg-emerald-500 text-white'
                              : 'border-ink-300 bg-white',
                          )}
                        >
                          {item.done ? (
                            <svg viewBox="0 0 12 12" className="size-2.5" fill="none">
                              <path d="M2.2 6.2 4.7 8.7 9.8 3.4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          ) : null}
                        </span>
                        <span className={item.done ? 'text-ink-500 line-through' : 'text-ink-700'}>
                          {item.label}
                        </span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Service status</CardTitle>
                  <CardDescription>What is live in this environment.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <StatusRow
                    icon={Bot}
                    label="Gemini analysis"
                    value={config?.aiConfigured ? `Ready · ${config.aiModel}` : 'Heuristic fallback'}
                    tone={config?.aiConfigured ? 'emerald' : 'amber'}
                  />
                  <StatusRow
                    icon={Sheet}
                    label="Google Sheets"
                    value={config?.sheetsConfigured ? 'Connected' : 'Not configured'}
                    tone={config?.sheetsConfigured ? 'emerald' : 'slate'}
                  />
                  <StatusRow
                    icon={Target}
                    label="Matching engine"
                    value="Deterministic + AI merge"
                    tone="indigo"
                  />
                  <InlineNotice tone={config?.aiConfigured ? 'success' : 'warning'}>
                    {config?.aiConfigured
                      ? 'Gemini is server-side only. Results are validated before storage.'
                      : 'AI is not configured. Analysis and summaries use transparent local rules; no result is labelled as AI.'}
                  </InlineNotice>
                </CardContent>
              </Card>

              <Card className="overflow-hidden border-brand-200 bg-gradient-to-br from-brand-600 to-brand-800 text-white">
                <CardContent className="p-5 pt-5">
                  <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-brand-200">
                    <TrendingUp className="size-3.5" /> Next best action
                  </div>
                  <p className="mt-2 text-base font-semibold">
                    {counts?.jobDescriptions
                      ? 'Tailor a resume to a saved role'
                      : 'Paste a job description to begin'}
                  </p>
                  <p className="mt-1 text-[13px] leading-relaxed text-white/65">
                    {counts?.jobDescriptions
                      ? 'Review evidence coverage, select the strongest records and export a focused PDF.'
                      : 'ResumeGEN extracts required, preferred and missing requirements before you write a word.'}
                  </p>
                  <Button
                    className="mt-4 bg-white text-brand-800 hover:bg-brand-50"
                    size="sm"
                    asChild
                  >
                    <Link to={counts?.jobDescriptions ? '/resume-builder' : '/jobs'}>
                      {counts?.jobDescriptions ? 'Build resume' : 'Analyze a job'} <ArrowRight />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function StatusRow({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Bot;
  label: string;
  value: string;
  tone: 'emerald' | 'amber' | 'slate' | 'indigo';
}) {
  const dot = {
    emerald: 'bg-emerald-500',
    amber: 'bg-amber-500',
    slate: 'bg-ink-300',
    indigo: 'bg-brand-500',
  }[tone];
  return (
    <div className="flex items-center gap-3 rounded-xl border border-ink-100 bg-ink-50/60 px-3 py-2.5">
      <Icon className="size-4 text-ink-400" />
      <div className="min-w-0 flex-1">
        <p className="text-[12px] font-semibold text-ink-800">{label}</p>
        <p className="truncate text-[11px] text-ink-500">{value}</p>
      </div>
      <span className={cn('size-2 rounded-full', dot)} />
    </div>
  );
}
