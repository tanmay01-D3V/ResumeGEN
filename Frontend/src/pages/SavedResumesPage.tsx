import {
  Clock,
  Download,
  FileText,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Trash2,
  TriangleAlert,
} from 'lucide-react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Field, Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import { SkeletonList } from '@/components/ui/skeleton';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { api } from '@/lib/api';
import { cn, formatDate, relativeTime } from '@/lib/utils';
import type { SavedResume } from '@shared/types';

export function SavedResumesPage() {
  const navigate = useNavigate();
  const [resumes, setResumes] = useState<SavedResume[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [renaming, setRenaming] = useState<SavedResume | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [deleting, setDeleting] = useState<SavedResume | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.listResumes();
      setResumes(result.resumes);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not load saved resumes.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = useMemo(() => {
    const query = search.toLowerCase().trim();
    return resumes.filter((resume) => {
      if (!query) return true;
      return `${resume.title} ${resume.jobTitle} ${resume.company}`.toLowerCase().includes(query);
    });
  }, [resumes, search]);

  async function download(resume: SavedResume) {
    try {
      await api.downloadSavedPdf(resume.id);
      toast.success('PDF downloaded');
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : 'Download failed.');
    }
  }

  async function rename() {
    if (!renaming || !renameValue.trim()) return;
    setBusy(true);
    try {
      await api.renameResume(renaming.id, renameValue.trim());
      toast.success('Resume renamed');
      setRenaming(null);
      await load();
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : 'Rename failed.');
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!deleting) return;
    setBusy(true);
    try {
      await api.deleteResume(deleting.id);
      toast.success('Saved resume deleted');
      setDeleting(null);
      await load();
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : 'Delete failed.');
    } finally {
      setBusy(false);
    }
  }

  const outdatedCount = resumes.filter((resume) => resume.outdated).length;

  return (
    <div className="space-y-6 animate-in-up">
      <PageHeader
        eyebrow="Version library"
        title="Saved Resumes"
        description="Every saved version is an immutable snapshot. Outdated snapshots are flagged, never silently rewritten."
        actions={
          <Button asChild>
            <Link to="/resume-builder">
              <Plus /> Build a resume
            </Link>
          </Button>
        }
      />

      {outdatedCount > 0 ? (
        <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          <p>
            {outdatedCount} saved {outdatedCount === 1 ? 'version is' : 'versions are'} outdated
            because your portfolio or job analysis changed. The snapshots remain exactly as saved.
          </p>
        </div>
      ) : null}

      <div className="flex flex-col gap-3 rounded-2xl border border-ink-200 bg-white p-4 shadow-card sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-400" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search versions, roles or companies…"
            className="pl-9"
            aria-label="Search saved resumes"
          />
        </div>
        <p className="text-xs text-ink-500">
          {visible.length} of {resumes.length} versions
        </p>
      </div>

      {loading ? (
        <SkeletonList rows={3} />
      ) : error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : resumes.length === 0 ? (
        <EmptyState
          icon={<FileText className="size-6" />}
          title="No saved resumes yet"
          description="Build a tailored resume from a job description, preview the exact PDF, then save a reproducible version."
          action={
            <Button asChild>
              <Link to="/resume-builder">
                <Sparkles /> Open Resume Builder
              </Link>
            </Button>
          }
        />
      ) : visible.length === 0 ? (
        <EmptyState
          title="No matching versions"
          description="Try a different title, role or company."
          action={
            <Button variant="outline" onClick={() => setSearch('')}>
              Clear search
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((resume) => (
            <article
              key={resume.id}
              className="group flex flex-col rounded-2xl border border-ink-200 bg-white p-5 shadow-card transition hover:border-ink-300"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="flex size-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                  <FileText className="size-[18px]" />
                </span>
                <div className="flex items-center gap-1">
                  {resume.outdated ? <Badge tone="amber">Outdated</Badge> : <Badge tone="emerald">Current</Badge>}
                  <DropdownMenu.Root>
                    <DropdownMenu.Trigger asChild>
                      <Button variant="ghost" size="icon" aria-label={`Actions for ${resume.title}`}>
                        <MoreHorizontal className="size-4" />
                      </Button>
                    </DropdownMenu.Trigger>
                    <DropdownMenu.Portal>
                      <DropdownMenu.Content
                        align="end"
                        sideOffset={6}
                        className="z-[60] w-44 rounded-xl border border-ink-200 bg-white p-1 shadow-float"
                      >
                        <DropdownMenu.Item
                          onSelect={() => {
                            setRenaming(resume);
                            setRenameValue(resume.title);
                          }}
                          className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm text-ink-600 outline-none data-[highlighted]:bg-ink-50"
                        >
                          <Pencil className="size-3.5" /> Rename
                        </DropdownMenu.Item>
                        <DropdownMenu.Item
                          onSelect={() => void download(resume)}
                          className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm text-ink-600 outline-none data-[highlighted]:bg-ink-50"
                        >
                          <Download className="size-3.5" /> Download PDF
                        </DropdownMenu.Item>
                        <DropdownMenu.Item
                          onSelect={() => setDeleting(resume)}
                          className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm text-rose-600 outline-none data-[highlighted]:bg-rose-50"
                        >
                          <Trash2 className="size-3.5" /> Delete
                        </DropdownMenu.Item>
                      </DropdownMenu.Content>
                    </DropdownMenu.Portal>
                  </DropdownMenu.Root>
                </div>
              </div>

              <button onClick={() => navigate(`/resumes/${resume.id}`)} className="mt-3 text-left">
                <h2 className="line-clamp-2 text-[15px] font-semibold leading-snug text-ink-900 group-hover:text-brand-700">
                  {resume.title}
                </h2>
                <p className="mt-1 text-xs text-ink-500">
                  {resume.jobTitle}
                  {resume.company ? ` · ${resume.company}` : ''}
                </p>
              </button>

              <div className="mt-3 flex flex-wrap gap-1.5">
                <Badge tone="slate">{resume.settings.template}</Badge>
                <Badge tone="slate">{resume.settings.layout.replace('_', ' ')}</Badge>
                <Badge tone="indigo">{resume.selectedRecordIds.length} records</Badge>
                {resume.aiAssisted ? <Badge tone="emerald">AI-assisted</Badge> : null}
              </div>

              <div className="mt-auto flex items-center justify-between border-t border-ink-100 pt-3 text-[11px] text-ink-400">
                <span className="flex items-center gap-1">
                  <Clock className="size-3" /> Saved {relativeTime(resume.createdAt)}
                </span>
                <span>{formatDate(resume.createdAt)}</span>
              </div>

              <div className="mt-3 flex gap-2">
                <Button size="sm" variant="outline" className="flex-1" onClick={() => navigate(`/resumes/${resume.id}`)}>
                  Open snapshot
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => void download(resume)}
                  aria-label="Download PDF"
                >
                  <Download />
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}

      <Dialog open={Boolean(renaming)} onOpenChange={(open) => !open && setRenaming(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Rename saved resume</DialogTitle>
            <DialogDescription>The snapshot content does not change.</DialogDescription>
          </DialogHeader>
          <DialogBody>
            <Field label="Title" htmlFor="rename-resume">
              <Input
                id="rename-resume"
                value={renameValue}
                onChange={(event) => setRenameValue(event.target.value)}
                maxLength={200}
              />
            </Field>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenaming(null)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={() => void rename()} loading={busy} disabled={!renameValue.trim()}>
              Save name
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Delete this saved resume?"
        description={deleting ? `“${deleting.title}” will be removed from your library.` : ''}
        onConfirm={remove}
      />
    </div>
  );
}
