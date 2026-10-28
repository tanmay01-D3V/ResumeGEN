import {
  ArrowDownToLine,
  ArrowUpFromLine,
  CheckCircle2,
  CircleAlert,
  Cloud,
  ExternalLink,
  Info,
  RefreshCw,
  Sheet,
  TriangleAlert,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Field, Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState, InlineNotice } from '@/components/ui/states';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { cn, formatDateTime, relativeTime } from '@/lib/utils';
import type { ImportProposal, IntegrationStatus, SheetPreview } from '@shared/types';

const ACTION_TONE: Record<ImportProposal['action'], 'emerald' | 'indigo' | 'amber' | 'slate' | 'rose'> = {
  new: 'emerald',
  update: 'indigo',
  conflict: 'amber',
  unchanged: 'slate',
  invalid: 'rose',
};

export function SheetsPage() {
  const { config } = useAuth();
  const [status, setStatus] = useState<IntegrationStatus | null>(null);
  const [preview, setPreview] = useState<SheetPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [spreadsheetInput, setSpreadsheetInput] = useState('');
  const [savingConfig, setSavingConfig] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<Array<{ name: string; updated: number; appended: number; removed: number }>>([]);
  const [importOpen, setImportOpen] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [proposals, setProposals] = useState<ImportProposal[]>([]);
  const [selectedProposals, setSelectedProposals] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);
  const [importSummary, setImportSummary] = useState<Record<string, number>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [statusResult, previewResult] = await Promise.all([api.sheetsStatus(), api.sheetsPreview()]);
      setStatus(statusResult.status);
      setPreview(previewResult.preview);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not load Google Sheets status.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveSpreadsheet() {
    if (!spreadsheetInput.trim()) {
      toast.error('Paste a Google Spreadsheet ID or URL.');
      return;
    }
    setSavingConfig(true);
    try {
      const result = await api.updateSheetsConfig({ spreadsheetId: spreadsheetInput.trim() });
      setStatus(result.status);
      setSpreadsheetInput('');
      toast.success('Spreadsheet ID saved');
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : 'Could not save spreadsheet ID.');
    } finally {
      setSavingConfig(false);
    }
  }

  async function toggleAutoSync(checked: boolean) {
    try {
      const result = await api.updateSheetsConfig({ autoSync: checked });
      setStatus(result.status);
      toast.success(checked ? 'Auto-sync enabled' : 'Auto-sync disabled');
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : 'Could not update auto-sync.');
    }
  }

  async function sync() {
    setSyncing(true);
    setSyncResult([]);
    try {
      const result = await api.syncSheets();
      setStatus(result.status);
      setSyncResult(result.tabs);
      toast.success('Portfolio synced to Google Sheets');
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : 'Sync failed.');
      await load();
    } finally {
      setSyncing(false);
    }
  }

  async function openImport() {
    setImportOpen(true);
    setImportLoading(true);
    setProposals([]);
    setSelectedProposals(new Set());
    try {
      const result = await api.sheetsImportPreview();
      setProposals(result.proposals);
      setImportSummary(result.summary);
      setSelectedProposals(
        new Set(
          result.proposals
            .filter((proposal) => proposal.action === 'new' || proposal.action === 'update')
            .map((proposal) => proposal.recordId),
        ),
      );
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : 'Could not preview the import.');
    } finally {
      setImportLoading(false);
    }
  }

  async function confirmImport() {
    const ids = [...selectedProposals];
    if (!ids.length) {
      toast.error('Select at least one proposal to import.');
      return;
    }
    setImporting(true);
    try {
      const result = await api.sheetsImportConfirm(ids);
      toast.success(`Applied ${result.applied.length} records from Google Sheets.`);
      if (result.skipped.length) {
        toast.warning(`${result.skipped.length} records were skipped.`);
      }
      setImportOpen(false);
      await load();
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : 'Import failed.');
    } finally {
      setImporting(false);
    }
  }

  const configured = status?.configured ?? false;
  const missing = status?.missingCredentials ?? [];
  const totalRows = useMemo(
    () => preview?.tabs.reduce((total, tab) => total + tab.rows.length, 0) ?? 0,
    [preview],
  );

  if (loading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (error) return <ErrorState message={error} onRetry={() => void load()} />;

  return (
    <div className="space-y-6 animate-in-up">
      <PageHeader
        eyebrow="Two-way sync"
        title="Google Sheets"
        description="Firestore is authoritative. Sheets mirrors your portfolio in stable, tabbed worksheets, with reviewed imports for spreadsheet edits."
        actions={
          <>
            <Button variant="outline" onClick={() => void openImport()} disabled={!configured}>
              <ArrowDownToLine /> Import preview
            </Button>
            <Button onClick={() => void sync()} loading={syncing} disabled={!configured}>
              <ArrowUpFromLine /> Sync to Sheets
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatusCard
          title="Connection"
          value={configured ? 'Ready' : 'Not configured'}
          hint={configured ? 'Service account and spreadsheet resolved' : missing[0] ?? 'Complete setup below'}
          tone={configured ? 'emerald' : 'amber'}
          icon={Cloud}
        />
        <StatusCard
          title="Last sync"
          value={status?.lastSyncAt ? relativeTime(status.lastSyncAt) : 'Never'}
          hint={status?.lastSyncAt ? formatDateTime(status.lastSyncAt) : 'No successful sync recorded'}
          tone={status?.lastSyncAt ? 'indigo' : 'slate'}
          icon={RefreshCw}
        />
        <StatusCard
          title="Pending changes"
          value={String(status?.pendingChanges ?? 0)}
          hint={status?.autoSync ? 'Auto-sync is on' : 'Auto-sync is off'}
          tone={(status?.pendingChanges ?? 0) > 0 ? 'amber' : 'emerald'}
          icon={Sheet}
        />
      </div>

      {!configured ? (
        <InlineNotice tone="warning">
          <div className="flex items-start gap-2">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" />
            <div>
              <p className="font-semibold">Google Sheets requires server credentials</p>
              <p className="mt-1 text-xs leading-relaxed">
                Missing: {missing.length ? missing.join(', ') : 'server configuration'}. Set
                <code className="mx-1 rounded bg-white/70 px-1 py-0.5 font-mono text-[10px]">GOOGLE_APPLICATION_CREDENTIALS</code>
                and <code className="mx-1 rounded bg-white/70 px-1 py-0.5 font-mono text-[10px]">GOOGLE_SHEETS_SPREADSHEET_ID</code>
                on the API, share the spreadsheet with the service account, then restart. The export
                preview below works without credentials.
              </p>
            </div>
          </div>
        </InlineNotice>
      ) : null}

      {status?.lastError ? (
        <InlineNotice tone="danger">
          <div className="flex items-start gap-2">
            <CircleAlert className="mt-0.5 size-4 shrink-0" />
            <span>
              <strong className="block">Last sync error</strong>
              {status.lastError}
            </span>
          </div>
        </InlineNotice>
      ) : null}

      {syncResult.length ? (
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle>Last sync result</CardTitle>
              <CardDescription>Per-worksheet row changes.</CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setSyncResult([])}>
              Dismiss
            </Button>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {syncResult.map((tab) => (
              <div key={tab.name} className="rounded-lg border border-ink-200 px-3 py-2 text-xs">
                <p className="font-semibold text-ink-800">{tab.name}</p>
                <p className="text-ink-500">
                  {tab.updated} updated · {tab.appended} appended · {tab.removed} removed
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[1fr_340px]">
        <Card>
          <CardHeader>
            <CardTitle>Export preview</CardTitle>
            <CardDescription>
              {preview ? `${preview.tabs.length} worksheets · ${totalRows} rows · generated ${relativeTime(preview.generatedAt)}` : 'No preview'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {preview ? (
              <Tabs defaultValue={preview.tabs[0]?.name ?? 'PersonalInfo'}>
                <div className="scrollbar-thin overflow-x-auto pb-1">
                  <TabsList className="w-max">
                    {preview.tabs.map((tab) => (
                      <TabsTrigger key={tab.name} value={tab.name}>
                        {tab.name}
                        <span className="text-[10px] text-ink-400">{tab.rows.length}</span>
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </div>
                {preview.tabs.map((tab) => (
                  <TabsContent key={tab.name} value={tab.name} className="mt-3">
                    <div className="scrollbar-thin max-h-[420px] overflow-auto rounded-xl border border-ink-200">
                      <table className="w-full min-w-[620px] border-collapse text-left text-[11px]">
                        <thead className="sticky top-0 bg-ink-50">
                          <tr>
                            {tab.headers.map((header) => (
                              <th
                                key={header}
                                className="whitespace-nowrap border-b border-ink-200 px-2.5 py-2 font-semibold text-ink-600"
                              >
                                {header}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {tab.rows.slice(0, 25).map((row, rowIndex) => (
                            <tr key={`${tab.name}-${rowIndex}`} className="border-b border-ink-100 last:border-0">
                              {tab.headers.map((header, columnIndex) => (
                                <td
                                  key={`${header}-${columnIndex}`}
                                  className="max-w-[240px] truncate px-2.5 py-1.5 text-ink-600"
                                  title={String(row[columnIndex] ?? '')}
                                >
                                  {String(row[columnIndex] ?? '') || <span className="text-ink-300">—</span>}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p className="mt-2 text-[11px] text-ink-400">
                      Showing {Math.min(25, tab.rows.length)} of {tab.rows.length} rows
                      {tab.recordIds.length ? ` · stable record IDs retained` : ''}.
                    </p>
                  </TabsContent>
                ))}
              </Tabs>
            ) : (
              <p className="py-8 text-center text-sm text-ink-500">No workbook data available.</p>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Spreadsheet</CardTitle>
              <CardDescription>Server-side ID, not a browser credential.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {status?.spreadsheetIdMasked ? (
                <div className="rounded-xl border border-ink-200 bg-ink-50 px-3 py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-400">
                    Configured ID
                  </p>
                  <p className="mt-0.5 font-mono text-xs text-ink-700">{status.spreadsheetIdMasked}</p>
                  {status.spreadsheetUrl ? (
                    <a
                      href={status.spreadsheetUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-brand-600 hover:underline"
                    >
                      Open spreadsheet <ExternalLink className="size-3" />
                    </a>
                  ) : null}
                </div>
              ) : (
                <p className="text-xs text-ink-500">No spreadsheet ID saved for this user yet.</p>
              )}

              <Field
                label="Spreadsheet ID or URL"
                htmlFor="spreadsheet-id"
                hint="A full Google Sheets URL is accepted and parsed."
              >
                <Input
                  id="spreadsheet-id"
                  value={spreadsheetInput}
                  onChange={(event) => setSpreadsheetInput(event.target.value)}
                  placeholder="1AbC… or https://docs.google.com/spreadsheets/d/…"
                />
              </Field>
              <Button className="w-full" variant="outline" onClick={() => void saveSpreadsheet()} loading={savingConfig}>
                Save spreadsheet
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Sync behavior</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <label className="flex cursor-pointer items-start gap-2.5">
                <Checkbox
                  checked={Boolean(status?.autoSync)}
                  disabled={!configured}
                  onCheckedChange={(checked) => void toggleAutoSync(checked === true)}
                  aria-label="Auto-sync after portfolio changes"
                  className="mt-0.5"
                />
                <span>
                  <span className="block text-xs font-semibold text-ink-800">
                    Auto-sync after edits
                  </span>
                  <span className="block text-[11px] text-ink-400">
                    Firestore remains authoritative. Failures are recorded, never silently ignored.
                  </span>
                </span>
              </label>

              <div className="rounded-xl bg-ink-50 p-3 text-[11px] leading-relaxed text-ink-500">
                <p className="flex items-center gap-1 font-semibold text-ink-700">
                  <Info className="size-3.5" /> Stable IDs
                </p>
                <p className="mt-1">
                  Each row carries its ResumeGEN record ID. Re-syncs update matching rows and remove
                  rows for deleted records while preserving user-added rows without IDs.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Setup checklist</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-[11.5px] text-ink-500">
              {[
                'Create a Google Cloud service account and enable the Sheets API.',
                'Download the JSON key and set GOOGLE_APPLICATION_CREDENTIALS on the API.',
                'Share the spreadsheet with the service-account email as Editor.',
                'Set GOOGLE_SHEETS_SPREADSHEET_ID and restart the API.',
                'Open this page and click Sync to create the 12 worksheets.',
              ].map((step, index) => (
                <div key={step} className="flex gap-2">
                  <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-ink-100 text-[9px] font-bold text-ink-500">
                    {index + 1}
                  </span>
                  {step}
                </div>
              ))}
              <p className="pt-1 text-[10px] text-ink-400">
                Full instructions: <code className="rounded bg-ink-100 px-1 py-0.5">docs/google-sheets-setup.md</code>
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Import from Google Sheets</DialogTitle>
            <DialogDescription>
              Changes are proposed, never applied blindly. Conflicts stay unselected until reviewed.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-3">
            {importLoading ? (
              <div className="flex items-center justify-center gap-2 py-10 text-sm text-ink-500">
                <RefreshCw className="size-4 animate-spin" /> Reading spreadsheet…
              </div>
            ) : proposals.length === 0 ? (
              <InlineNotice tone="info">
                No proposals were returned. The spreadsheet may be empty, or it may not be synced yet.
                Run a sync first.
              </InlineNotice>
            ) : (
              <>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(importSummary).map(([action, count]) => (
                    <Badge key={action} tone={ACTION_TONE[action as ImportProposal['action']] ?? 'slate'}>
                      {count} {action}
                    </Badge>
                  ))}
                </div>
                <div className="space-y-2">
                  {proposals.map((proposal) => {
                    const selectable = proposal.action === 'new' || proposal.action === 'update' || proposal.action === 'conflict';
                    return (
                      <label
                        key={proposal.recordId}
                        className={cn(
                          'flex items-start gap-3 rounded-xl border border-ink-200 p-3',
                          !selectable && 'opacity-60',
                        )}
                      >
                        <Checkbox
                          checked={selectedProposals.has(proposal.recordId)}
                          disabled={!selectable}
                          onCheckedChange={(checked) => {
                            const next = new Set(selectedProposals);
                            if (checked === true) next.add(proposal.recordId);
                            else next.delete(proposal.recordId);
                            setSelectedProposals(next);
                          }}
                          aria-label={`Select ${proposal.title}`}
                          className="mt-0.5"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-2">
                            <span className="text-[13px] font-semibold text-ink-900">
                              {proposal.title || proposal.recordId}
                            </span>
                            <Badge tone={ACTION_TONE[proposal.action]}>{proposal.action}</Badge>
                            {proposal.category ? <Badge tone="slate">{proposal.category}</Badge> : null}
                          </span>
                          {proposal.issues.length ? (
                            <span className="mt-1 block text-[11px] text-amber-700">
                              {proposal.issues.join('; ')}
                            </span>
                          ) : null}
                          {proposal.action === 'conflict' ? (
                            <span className="mt-1 block text-[11px] text-amber-700">
                              The spreadsheet and Firestore both changed. Selecting this will
                              overwrite the local record; review the sheet row first.
                            </span>
                          ) : null}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </>
            )}
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportOpen(false)} disabled={importing}>
              Cancel
            </Button>
            <Button onClick={() => void confirmImport()} loading={importing} disabled={importLoading || !selectedProposals.size}>
              <ArrowDownToLine /> Import {selectedProposals.size} selected
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatusCard({
  title,
  value,
  hint,
  tone,
  icon: Icon,
}: {
  title: string;
  value: string;
  hint: string;
  tone: 'emerald' | 'amber' | 'indigo' | 'slate';
  icon: typeof Cloud;
}) {
  const tones = {
    emerald: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
    indigo: 'bg-brand-50 text-brand-600',
    slate: 'bg-ink-100 text-ink-500',
  };
  return (
    <div className="rounded-2xl border border-ink-200 bg-white p-4 shadow-card">
      <div className="flex items-start justify-between">
        <p className="text-xs font-medium text-ink-500">{title}</p>
        <span className={cn('flex size-8 items-center justify-center rounded-lg', tones[tone])}>
          <Icon className="size-4" />
        </span>
      </div>
      <p className="mt-2 text-xl font-bold tracking-tight text-ink-900">{value}</p>
      <p className="mt-1 truncate text-[11px] text-ink-400">{hint}</p>
    </div>
  );
}
