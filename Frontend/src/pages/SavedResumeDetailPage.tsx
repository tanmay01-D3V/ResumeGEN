import {
  ArrowLeft,
  BadgeCheck,
  Download,
  FileText,
  History,
  Pencil,
  Sparkles,
  Trash2,
  TriangleAlert,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState, InlineNotice } from '@/components/ui/states';
import { PdfViewer } from '@/components/resume/PdfViewer';
import { ResumePreview } from '@/components/resume/ResumePreview';
import { api } from '@/lib/api';
import { formatDateTime, relativeTime } from '@/lib/utils';
import type { SavedResume } from '@shared/types';

export function SavedResumeDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [resume, setResume] = useState<SavedResume | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<'document' | 'pdf'>('document');
  const [downloading, setDownloading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.getResume(id);
      setResume(result.resume);
      setRenameValue(result.resume.title);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not load this resume.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function download() {
    if (!resume) return;
    setDownloading(true);
    try {
      await api.downloadSavedPdf(resume.id);
      toast.success('PDF downloaded');
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : 'Download failed.');
    } finally {
      setDownloading(false);
    }
  }

  async function remove() {
    if (!resume) return;
    setBusy(true);
    try {
      await api.deleteResume(resume.id);
      toast.success('Saved resume deleted');
      navigate('/resumes');
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : 'Delete failed.');
    } finally {
      setBusy(false);
    }
  }

  async function rename() {
    if (!resume || !renameValue.trim()) return;
    setBusy(true);
    try {
      const result = await api.renameResume(resume.id, renameValue.trim());
      setResume(result.resume);
      setRenaming(false);
      toast.success('Resume renamed');
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : 'Rename failed.');
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-8 w-2/3" />
        <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
          <Skeleton className="h-[800px]" />
          <Skeleton className="h-80" />
        </div>
      </div>
    );
  }

  if (error || !resume) {
    return (
      <div className="space-y-4">
        <ErrorState message={error ?? 'Saved resume not found.'} onRetry={() => void load()} />
        <Button variant="outline" asChild>
          <Link to="/resumes">
            <ArrowLeft /> Back to saved resumes
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-in-up">
      <Link
        to="/resumes"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-500 transition hover:text-brand-700"
      >
        <ArrowLeft className="size-3.5" /> Saved resumes
      </Link>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-ink-900">{resume.title}</h1>
            {resume.outdated ? <Badge tone="amber">Outdated</Badge> : <Badge tone="emerald">Current</Badge>}
            {resume.aiAssisted ? <Badge tone="indigo">AI-assisted</Badge> : null}
          </div>
          <p className="mt-1.5 text-sm text-ink-500">
            {resume.jobTitle}
            {resume.company ? ` · ${resume.company}` : ''} · saved {formatDateTime(resume.createdAt)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setRenaming(true)}>
            <Pencil /> Rename
          </Button>
          <Button variant="outline" size="sm" onClick={() => setDeleting(true)}>
            <Trash2 /> Delete
          </Button>
          <Button size="sm" onClick={() => void download()} loading={downloading}>
            <Download /> Download PDF
          </Button>
        </div>
      </div>

      {resume.outdated ? (
        <InlineNotice tone="warning">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-start gap-2">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" />
              <span>
                Your portfolio or the job analysis changed after this version was saved. This
                snapshot is unchanged — build a fresh version to use the new evidence.
              </span>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="border-amber-300 bg-white text-amber-900"
              asChild
            >
              <Link to={`/resume-builder?jd=${resume.jobDescriptionId}`}>Build updated version</Link>
            </Button>
          </div>
        </InlineNotice>
      ) : null}

      <div className="grid gap-5 2xl:grid-cols-[1fr_320px]">
        <div className="min-w-0 space-y-3">
          <div className="flex items-center justify-between rounded-2xl border border-ink-200 bg-white px-3 py-2 shadow-card">
            <div className="flex items-center gap-1">
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
              >
                <FileText /> PDF
              </Button>
            </div>
            <p className="hidden text-[11px] text-ink-400 sm:block">
              Immutable snapshot · generation {resume.generationVersion.slice(0, 10)}
            </p>
          </div>

          {view === 'document' ? (
            <div className="rounded-2xl border border-ink-200 bg-ink-100/70 p-3 sm:p-5">
              <ResumePreview document={resume.document} />
            </div>
          ) : (
            <PdfViewer
              load={() => api.savedPdfBlob(resume.id)}
              title={`${resume.title} — saved PDF`}
            />
          )}
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Snapshot details</CardTitle>
              <CardDescription>Reproducible exactly as saved.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              <Detail label="Role" value={resume.jobTitle} />
              <Detail label="Company" value={resume.company || 'Not specified'} />
              <Detail label="Template" value={`${resume.settings.template} · ${resume.settings.layout.replace('_', ' ')}`} />
              <Detail label="Selected records" value={`${resume.selectedRecordIds.length} verified records`} />
              <Detail
                label="Document engine"
                value={resume.document.engine === 'gemini-assisted' ? 'Gemini-assisted summary' : 'Deterministic assembly'}
              />
              <Detail label="Generation version" value={resume.generationVersion.slice(0, 16)} mono />
              <Detail label="Saved" value={formatDateTime(resume.createdAt)} />
              <Detail label="Age" value={relativeTime(resume.createdAt)} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Section order</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="space-y-1 text-xs text-ink-600">
                {resume.document.sections.map((section, index) => (
                  <li key={section.key} className="flex items-center gap-2">
                    <span className="flex size-4 items-center justify-center rounded-full bg-ink-100 text-[9px] font-bold text-ink-500">
                      {index + 1}
                    </span>
                    {section.title}
                    <span className="ml-auto text-[10px] text-ink-400">{section.items.length}</span>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 pt-4">
              <div className="flex items-start gap-2 text-[11.5px] leading-relaxed text-ink-500">
                <BadgeCheck className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                This version cannot silently change. If evidence is edited later, a new resume must be
                built and saved.
              </div>
              <Button variant="ghost" size="sm" className="mt-2 w-full" asChild>
                <Link to={`/resume-builder?jd=${resume.jobDescriptionId}`}>
                  <Sparkles /> Build from this role
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 pt-4 text-[11px] text-ink-400">
              <p className="flex items-center gap-1.5 font-semibold text-ink-600">
                <History className="size-3.5" /> Audit trail
              </p>
              <p className="mt-1.5">
                Portfolio fingerprint {resume.portfolioFingerprint.slice(0, 16)}… keeps snapshots
                comparable over time.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={renaming} onOpenChange={setRenaming}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Rename saved resume</DialogTitle>
            <DialogDescription>Only the library title changes.</DialogDescription>
          </DialogHeader>
          <DialogBody>
            <Field label="Title" htmlFor="rename-detail">
              <Input
                id="rename-detail"
                value={renameValue}
                onChange={(event) => setRenameValue(event.target.value)}
                maxLength={200}
              />
            </Field>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenaming(false)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={() => void rename()} loading={busy} disabled={!renameValue.trim()}>
              Save name
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title="Delete this saved resume?"
        description={`“${resume.title}” will be removed from your library.`}
        onConfirm={remove}
      />
    </div>
  );
}

function Detail({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-ink-100 pb-2 last:border-0 last:pb-0">
      <span className="shrink-0 text-ink-400">{label}</span>
      <span className={`text-right font-medium text-ink-800 ${mono ? 'font-mono text-[10px]' : ''}`}>
        {value}
      </span>
    </div>
  );
}
