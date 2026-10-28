import {
  AlignLeft,
  Award,
  BadgeCheck,
  BookOpen,
  Briefcase,
  Code2,
  FolderKanban,
  GraduationCap,
  Languages,
  Layers,
  MessageSquare,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Trophy,
  User,
  Users,
  Wand2,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import { SkeletonList } from '@/components/ui/skeleton';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { RecordFormDialog } from '@/components/portfolio/RecordFormDialog';
import { PortfolioImportDialog } from '@/components/portfolio/PortfolioImportDialog';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { cn, formatDate, relativeTime } from '@/lib/utils';
import { CATEGORY_META, PORTFOLIO_CATEGORIES, type PortfolioCategory } from '@shared/categories';
import type { PortfolioRecord } from '@shared/types';

const CATEGORY_ICONS: Record<PortfolioCategory, typeof User> = {
  personal_info: User,
  summary: AlignLeft,
  education: GraduationCap,
  technical_skills: Code2,
  soft_skills: MessageSquare,
  certifications: Award,
  projects: FolderKanban,
  experience: Briefcase,
  achievements: Trophy,
  publications: BookOpen,
  extracurriculars: Users,
  languages: Languages,
  competencies: BadgeCheck,
};

function previewFor(record: PortfolioRecord): string {
  const values = Object.entries(record.data)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .sort(([a], [b]) => {
      const priority = ['description', 'summaryText', 'evidence', 'responsibilities', 'achievements', 'technologies'];
      return (priority.indexOf(a) + 1 || 99) - (priority.indexOf(b) + 1 || 99);
    });

  for (const [, value] of values) {
    if (Array.isArray(value) && value.length) return value.slice(0, 4).join(' · ');
    if (typeof value === 'string' && value.length > 3) return value;
  }
  return 'No details yet.';
}

export function PortfolioPage() {
  const { config } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [records, setRecords] = useState<PortfolioRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editing, setEditing] = useState<PortfolioRecord | null>(null);
  const [deleting, setDeleting] = useState<PortfolioRecord | null>(null);

  const categoryParam = searchParams.get('category');
  const selectedCategory = (categoryParam ?? 'all') as PortfolioCategory | 'all';

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.listPortfolio();
      setRecords(result.records);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not load your portfolio.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (searchParams.get('new') === '1' && !loading) {
      setEditing(null);
      setFormOpen(true);
      const next = new URLSearchParams(searchParams);
      next.delete('new');
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, loading, setSearchParams]);

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const record of records) map.set(record.category, (map.get(record.category) ?? 0) + 1);
    return map;
  }, [records]);

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    return records
      .filter((record) => selectedCategory === 'all' || record.category === selectedCategory)
      .filter((record) => {
        if (!query) return true;
        const haystack = `${record.title} ${record.category} ${JSON.stringify(record.data)} ${record.tags.join(' ')}`.toLowerCase();
        return haystack.includes(query);
      })
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [records, selectedCategory, search]);

  const activeCategory: PortfolioCategory =
    selectedCategory === 'all' ? 'personal_info' : selectedCategory;
  const activeMeta = CATEGORY_META[activeCategory];
  const singletonRecord = activeMeta.singleton
    ? records.find((record) => record.category === activeCategory)
    : undefined;

  function selectCategory(category: PortfolioCategory | 'all') {
    const next = new URLSearchParams(searchParams);
    if (category === 'all') next.delete('category');
    else next.set('category', category);
    setSearchParams(next);
  }

  function openCreate() {
    if (singletonRecord) {
      setEditing(singletonRecord);
    } else {
      setEditing(null);
    }
    setFormOpen(true);
  }

  async function handleDelete() {
    if (!deleting) return;
    try {
      await api.deleteRecord(deleting.id);
      toast.success('Portfolio record deleted');
      setDeleting(null);
      await load();
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : 'Could not delete the record.');
    }
  }

  return (
    <div className="space-y-6 animate-in-up">
      <PageHeader
        eyebrow="Evidence library"
        title="Portfolio"
        description="Every resume claim comes from here. Add verified projects, skills and experience — then select only what fits each role."
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => setImportOpen(true)}
              title={config?.aiConfigured ? 'Structure text with Gemini' : 'Requires Gemini configuration'}
            >
              <Wand2 /> AI import
            </Button>
            <Button onClick={openCreate}>
              <Plus /> Add record
            </Button>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[232px_1fr]">
        <aside className="hidden lg:block">
          <div className="sticky top-[88px] space-y-1 rounded-2xl border border-ink-200 bg-white p-2 shadow-card">
            <button
              onClick={() => selectCategory('all')}
              className={cn(
                'flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-[13px] font-medium transition',
                selectedCategory === 'all'
                  ? 'bg-brand-50 text-brand-700'
                  : 'text-ink-600 hover:bg-ink-50',
              )}
            >
              <span className="flex items-center gap-2.5">
                <Layers className="size-4" /> All records
              </span>
              <span className="text-[11px] font-semibold text-ink-400">{records.length}</span>
            </button>
            <div className="my-1 h-px bg-ink-100" />
            {PORTFOLIO_CATEGORIES.map((category) => {
              const Icon = CATEGORY_ICONS[category];
              const count = counts.get(category) ?? 0;
              return (
                <button
                  key={category}
                  onClick={() => selectCategory(category)}
                  className={cn(
                    'flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-[13px] font-medium transition',
                    selectedCategory === category
                      ? 'bg-brand-50 text-brand-700'
                      : 'text-ink-600 hover:bg-ink-50',
                  )}
                >
                  <span className="flex min-w-0 items-center gap-2.5">
                    <Icon className="size-4 shrink-0" />
                    <span className="truncate">{CATEGORY_META[category].label}</span>
                  </span>
                  <span className="text-[11px] font-semibold text-ink-400">{count}</span>
                </button>
              );
            })}
          </div>
        </aside>

        <div className="min-w-0 space-y-4">
          <div className="lg:hidden">
            <div className="scrollbar-thin -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
              <button
                onClick={() => selectCategory('all')}
                className={cn(
                  'shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold',
                  selectedCategory === 'all'
                    ? 'border-brand-200 bg-brand-50 text-brand-700'
                    : 'border-ink-200 bg-white text-ink-500',
                )}
              >
                All · {records.length}
              </button>
              {PORTFOLIO_CATEGORIES.map((category) => (
                <button
                  key={category}
                  onClick={() => selectCategory(category)}
                  className={cn(
                    'shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold',
                    selectedCategory === category
                      ? 'border-brand-200 bg-brand-50 text-brand-700'
                      : 'border-ink-200 bg-white text-ink-500',
                  )}
                >
                  {CATEGORY_META[category].label} · {counts.get(category) ?? 0}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-3 rounded-2xl border border-ink-200 bg-white p-4 shadow-card sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1 sm:max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-400" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search titles, skills, tags…"
                className="pl-9"
                aria-label="Search portfolio"
              />
            </div>
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-ink-500">
                {visible.length} {visible.length === 1 ? 'record' : 'records'}
                {selectedCategory !== 'all' ? ` in ${activeMeta.label}` : ''}
              </p>
              {selectedCategory !== 'all' ? (
                <Button size="sm" variant="outline" onClick={openCreate}>
                  {singletonRecord ? (
                    <>
                      <Pencil /> Edit
                    </>
                  ) : (
                    <>
                      <Plus /> Add
                    </>
                  )}
                </Button>
              ) : null}
            </div>
          </div>

          {loading ? (
            <SkeletonList rows={4} />
          ) : error ? (
            <ErrorState message={error} onRetry={() => void load()} />
          ) : visible.length === 0 ? (
            <EmptyState
              icon={<Sparkles className="size-6" />}
              title={search ? 'No matching records' : `No ${selectedCategory === 'all' ? 'portfolio' : activeMeta.label.toLowerCase()} records yet`}
              description={
                search
                  ? 'Try a different skill, project name or tag.'
                  : 'Add a record with only the facts you can defend. You can tailor the wording later for each role.'
              }
              action={
                search ? (
                  <Button variant="outline" onClick={() => setSearch('')}>
                    Clear search
                  </Button>
                ) : (
                  <Button onClick={openCreate}>
                    <Plus /> Add {selectedCategory === 'all' ? 'record' : activeMeta.singular.toLowerCase()}
                  </Button>
                )
              }
            />
          ) : (
            <div className="space-y-3">
              {visible.map((record) => {
                const meta = CATEGORY_META[record.category];
                const Icon = CATEGORY_ICONS[record.category] ?? Layers;
                return (
                  <article
                    key={record.id}
                    className="group rounded-2xl border border-ink-200 bg-white p-4 shadow-card transition hover:border-ink-300 sm:p-5"
                  >
                    <div className="flex items-start gap-3.5">
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-ink-50 text-ink-500">
                        <Icon className="size-[18px]" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-[15px] font-semibold text-ink-900">{record.title}</h3>
                          <Badge tone="indigo">{meta.label}</Badge>
                          {record.verificationStatus === 'needs_review' ? (
                            <Badge tone="amber">Needs review</Badge>
                          ) : record.sourceType === 'seed' ? (
                            <Badge tone="slate">Demo</Badge>
                          ) : null}
                        </div>
                        <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-ink-500">
                          {previewFor(record)}
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-ink-400">
                          <span>Updated {relativeTime(record.updatedAt)}</span>
                          {record.tags.length ? <span>· {record.tags.join(', ')}</span> : null}
                          {record.sourceType === 'sheets_import' ? <span>· Imported from Sheets</span> : null}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Edit ${record.title}`}
                          onClick={() => {
                            setEditing(record);
                            setFormOpen(true);
                          }}
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          variant="danger-ghost"
                          size="icon"
                          aria-label={`Delete ${record.title}`}
                          onClick={() => setDeleting(record)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <RecordFormDialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setEditing(null);
        }}
        category={editing?.category ?? activeCategory}
        record={editing}
        onSaved={() => void load()}
      />

      <PortfolioImportDialog open={importOpen} onOpenChange={setImportOpen} onImported={() => void load()} />

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
        title="Delete this portfolio record?"
        description={
          deleting
            ? `“${deleting.title}” will be removed. Saved resume snapshots keep their own copy, but future matches will no longer use this evidence.`
            : ''
        }
        onConfirm={handleDelete}
      />
    </div>
  );
}
