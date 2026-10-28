import { CircleAlert, Sparkles, Wand2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
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
import { Field, Textarea } from '@/components/ui/input';
import { InlineNotice } from '@/components/ui/states';
import { api } from '@/lib/api';
import { titleCase } from '@/lib/utils';
import { CATEGORY_META } from '@shared/categories';
import type { StructuredRecordCandidate } from '@shared/types';

export function PortfolioImportDialog({
  open,
  onOpenChange,
  onImported,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: () => void;
}) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [candidates, setCandidates] = useState<StructuredRecordCandidate[]>([]);
  const [notes, setNotes] = useState('');
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);

  function resetAll() {
    setText('');
    setCandidates([]);
    setSelected(new Set());
    setNotes('');
    setError(null);
  }

  async function structure() {
    if (text.trim().length < 20) {
      setError('Paste at least a few sentences (20 characters minimum).');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await api.structurePortfolioText(text);
      setCandidates(result.records);
      setNotes(result.notes);
      setSelected(
        new Set(
          result.records
            .map((record, index) => (record.validationIssues.length === 0 ? index : -1))
            .filter((index) => index >= 0),
        ),
      );
      if (result.records.length === 0) {
        setError('Gemini did not find any complete records. Add more detail and try again.');
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'AI structuring failed.');
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    const records = [...selected]
      .map((index) => candidates[index])
      .filter(Boolean)
      .map((record) => ({
        category: record.category,
        title: record.title,
        data: record.data,
        tags: ['ai-structured'],
      }));
    if (records.length === 0) {
      setError('Select at least one record to import.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const result = await api.importConfirmedRecords(records);
      toast.success(`Added ${result.created.length} records to your portfolio.`);
      if (result.skipped.length) {
        toast.warning(`${result.skipped.length} records were skipped: ${result.skipped[0].reason}`);
      }
      onImported();
      onOpenChange(false);
      resetAll();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not import records.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) resetAll();
      }}
    >
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Structure portfolio text with AI</DialogTitle>
          <DialogDescription>
            Paste a resume, bio or project notes. Gemini proposes structured records for you to
            review — nothing is saved until you confirm.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-4">
          <InlineNotice tone="warning">
            This feature requires a server-side Gemini API key. Without one, use manual entry — the
            app will not pretend a local guess came from AI.
          </InlineNotice>

          {error ? (
            <InlineNotice tone="danger">
              <div className="flex items-start gap-2">
                <CircleAlert className="mt-0.5 size-4 shrink-0" /> {error}
              </div>
            </InlineNotice>
          ) : null}

          {candidates.length === 0 ? (
            <>
              <Field
                label="Source text"
                htmlFor="import-text"
                hint="Fictional or your own data. Avoid pasting sensitive information."
              >
                <Textarea
                  id="import-text"
                  rows={10}
                  value={text}
                  onChange={(event) => setText(event.target.value)}
                  placeholder={'Example:\nBuilt a churn prediction pipeline with Python and scikit-learn. Improved recall from 0.71 to 0.83 on a held-out test set. GitHub: github.com/…'}
                />
              </Field>
              <div className="flex justify-end">
                <Button onClick={() => void structure()} loading={busy}>
                  <Wand2 /> Structure with Gemini
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-ink-900">
                    {candidates.length} proposed records
                  </p>
                  <p className="text-xs text-ink-500">{notes || 'Review each record before importing.'}</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setSelected(new Set(candidates.map((_, i) => i)))}>
                    Select all
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
                    Clear
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                {candidates.map((candidate, index) => {
                  const valid = candidate.validationIssues.length === 0;
                  return (
                    <div
                      key={`${candidate.category}-${index}`}
                      className="flex items-start gap-3 rounded-xl border border-ink-200 p-3.5"
                    >
                      <Checkbox
                        checked={selected.has(index)}
                        disabled={!valid}
                        onCheckedChange={(checked) => {
                          const next = new Set(selected);
                          if (checked === true) next.add(index);
                          else next.delete(index);
                          setSelected(next);
                        }}
                        aria-label={`Select ${candidate.title}`}
                        className="mt-0.5"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-ink-900">{candidate.title}</p>
                          <Badge tone={valid ? 'emerald' : 'rose'}>
                            {CATEGORY_META[candidate.category]?.label ?? titleCase(candidate.category)}
                          </Badge>
                          <Badge tone="slate">{Math.round(candidate.confidence * 100)}% confidence</Badge>
                        </div>
                        {candidate.sourceExcerpt ? (
                          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-ink-500">
                            {candidate.sourceExcerpt}
                          </p>
                        ) : null}
                        {candidate.validationIssues.length ? (
                          <p className="mt-1.5 text-xs font-medium text-rose-600">
                            Needs fixes: {candidate.validationIssues.slice(0, 2).join('; ')}
                          </p>
                        ) : candidate.warnings.length ? (
                          <p className="mt-1.5 text-xs text-amber-700">
                            {candidate.warnings.slice(0, 2).join('; ')}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-between">
                <Button variant="outline" size="sm" onClick={() => setCandidates([])}>
                  Back
                </Button>
                <Button onClick={() => void confirm()} loading={saving}>
                  <Sparkles /> Import {selected.size} selected
                </Button>
              </div>
            </>
          )}
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
