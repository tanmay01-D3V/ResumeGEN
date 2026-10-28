import {
  BadgeCheck,
  Bot,
  Database,
  FileText,
  KeyRound,
  LogOut,
  Save,
  Sheet,
  ShieldCheck,
  Sparkles,
  User,
  Wand2,
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import { InlineNotice } from '@/components/ui/states';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/utils';

export function SettingsPage() {
  const { user, config, updateDisplayName, logout } = useAuth();
  const [name, setName] = useState(user?.displayName ?? '');
  const [savingName, setSavingName] = useState(false);
  const [seeding, setSeeding] = useState(false);

  async function saveName() {
    if (!name.trim()) {
      toast.error('Display name cannot be empty.');
      return;
    }
    setSavingName(true);
    try {
      await updateDisplayName(name.trim());
      toast.success('Display name updated');
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : 'Could not update the profile.');
    } finally {
      setSavingName(false);
    }
  }

  async function seed() {
    setSeeding(true);
    try {
      const result = await api.seed();
      toast.success(`Added ${result.created} demo records and ${result.jobDescriptions} sample jobs.`);
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : 'Could not load demo data.');
    } finally {
      setSeeding(false);
    }
  }

  return (
    <div className="space-y-6 animate-in-up">
      <PageHeader
        eyebrow="Workspace"
        title="Settings"
        description="Account, environment and demo controls. Server credentials never reach the browser."
        actions={
          <Button variant="outline" onClick={logout}>
            <LogOut /> Sign out
          </Button>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[1.25fr_1fr]">
        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>Account</CardTitle>
              <CardDescription>Your verified identity owns all portfolio and resume data.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3 rounded-xl border border-ink-200 bg-ink-50/60 p-3">
                <span className="flex size-11 items-center justify-center rounded-xl bg-brand-600 text-sm font-bold text-white">
                  {(user?.displayName || user?.email || 'RG').slice(0, 2).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink-900">{user?.displayName}</p>
                  <p className="truncate text-xs text-ink-500">{user?.email}</p>
                </div>
                <Badge tone={user?.authMode === 'firebase' ? 'emerald' : 'amber'}>
                  {user?.authMode === 'firebase' ? 'Firebase' : 'Demo'}
                </Badge>
              </div>

              <Field label="Display name" htmlFor="display-name">
                <Input
                  id="display-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  maxLength={160}
                />
              </Field>

              <div className="flex items-center justify-between gap-3">
                <p className="text-[11px] text-ink-400">
                  Account created {formatDate(user?.createdAt)} · UID{' '}
                  <span className="font-mono">{user?.uid?.slice(0, 14)}…</span>
                </p>
                <Button size="sm" onClick={() => void saveName()} loading={savingName}>
                  <Save /> Save
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Environment</CardTitle>
              <CardDescription>What is configured on the API right now.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2.5">
              <SettingRow
                icon={ShieldCheck}
                label="Authentication"
                value={config?.authMode === 'firebase' ? 'Firebase Authentication' : 'Signed demo sessions (HMAC)'}
                tone={config?.authMode === 'firebase' ? 'emerald' : 'amber'}
              />
              <SettingRow
                icon={Bot}
                label="Gemini"
                value={config?.aiConfigured ? `Configured · ${config.aiModel}` : 'Not configured · heuristic fallback'}
                tone={config?.aiConfigured ? 'emerald' : 'amber'}
              />
              <SettingRow
                icon={Sheet}
                label="Google Sheets"
                value={config?.sheetsConfigured ? 'Service account + spreadsheet ready' : 'Not configured'}
                tone={config?.sheetsConfigured ? 'emerald' : 'slate'}
              />
              <SettingRow
                icon={Database}
                label="Database"
                value={config?.authMode === 'firebase' ? 'Firestore (expected)' : 'Local demo store when Firebase is absent'}
                tone="indigo"
              />
              <SettingRow
                icon={KeyRound}
                label="Secrets"
                value="Server-side environment variables only"
                tone="emerald"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Demo data</CardTitle>
              <CardDescription>Fictional records for exploring the full workflow.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <InlineNotice tone="warning">
                Demo records use fictional names, employers, projects and credentials. Do not mix real
                personal data into a demo environment that others can access.
              </InlineNotice>
              <Button variant="outline" onClick={() => void seed()} loading={seeding}>
                <Wand2 /> Load fictional demo portfolio
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>Why evidence-first?</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-[12.5px] leading-relaxed text-ink-500">
              <div className="flex gap-2.5">
                <BadgeCheck className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                Matching runs against verified records, never against the job description alone.
              </div>
              <div className="flex gap-2.5">
                <BadgeCheck className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                AI output is schema-validated and grounded; unsupported numbers and skills are rejected.
              </div>
              <div className="flex gap-2.5">
                <BadgeCheck className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                Saved snapshots are immutable, so old applications stay reproducible.
              </div>
              <div className="flex gap-2.5">
                <BadgeCheck className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                Every API record is scoped to the authenticated user on the server.
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Documentation</CardTitle>
              <CardDescription>Project files included in this repository.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              {[
                ['docs/database-schema.md', 'Firestore model, rules and ownership'],
                ['docs/api-documentation.md', 'Endpoints, validation and errors'],
                ['docs/google-sheets-setup.md', 'Service account and worksheet setup'],
                ['docs/testing.md', 'Test strategy and actual results'],
                ['README.md', 'Setup, commands and demo script'],
              ].map(([file, description]) => (
                <div key={file} className="flex items-start gap-2">
                  <FileText className="mt-0.5 size-3.5 shrink-0 text-ink-400" />
                  <div>
                    <p className="font-mono text-[11px] font-medium text-ink-700">{file}</p>
                    <p className="text-[11px] text-ink-400">{description}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-brand-200 bg-brand-50/50">
            <CardContent className="p-4 pt-4">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-brand-800">
                <Sparkles className="size-3.5" /> Demo tip
              </p>
              <p className="mt-1 text-[11.5px] leading-relaxed text-brand-800/70">
                Open the seeded Machine Learning Engineer role, match your portfolio, select the
                strongest evidence, then build a one-page Classic PDF. Repeat with the Full-Stack role
                to see materially different resumes from the same portfolio.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function SettingRow({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof User;
  label: string;
  value: string;
  tone: 'emerald' | 'amber' | 'slate' | 'indigo';
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-ink-100 px-3 py-2.5">
      <Icon className="size-4 text-ink-400" />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-ink-800">{label}</p>
        <p className="truncate text-[11px] text-ink-500">{value}</p>
      </div>
      <Badge tone={tone}>{tone === 'emerald' ? 'Ready' : tone === 'amber' ? 'Fallback' : 'Info'}</Badge>
    </div>
  );
}
