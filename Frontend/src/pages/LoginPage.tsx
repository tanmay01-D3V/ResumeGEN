import { zodResolver } from '@hookform/resolvers/zod';
import {
  ArrowRight,
  BadgeCheck,
  Bot,
  CheckCircle2,
  FileText,
  Loader2,
  LockKeyhole,
  Sparkles,
  Target,
} from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/input';
import { InlineNotice } from '@/components/ui/states';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

const schema = z.object({
  email: z.string().trim().email('Enter a valid email address'),
  name: z.string().trim().max(160).optional(),
  password: z.string().max(200).optional(),
});

type FormValues = z.infer<typeof schema>;

const FEATURES = [
  { icon: BadgeCheck, text: 'Every resume claim is traced to a verified portfolio record.' },
  { icon: Target, text: 'Requirement-by-requirement matching with honest gaps.' },
  { icon: FileText, text: 'Export clean, ATS-friendly PDFs that match the preview.' },
];

export function LoginPage() {
  const { config, loginDemo, loginWithFirebase } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '/dashboard';
  const [intent, setIntent] = useState<'signin' | 'signup'>('signin');
  const [submitting, setSubmitting] = useState(false);
  const isFirebase = config?.authMode === 'firebase';

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: isFirebase ? '' : 'demo@example.com', name: 'Aarav Mehta', password: '' },
  });

  async function onSubmit(values: FormValues) {
    setSubmitting(true);
    try {
      if (isFirebase) {
        if (!values.password || values.password.length < 6) {
          toast.error('Enter your Firebase password (at least 6 characters).');
          return;
        }
        await loginWithFirebase({
          email: values.email,
          password: values.password,
          name: values.name,
          intent,
        });
        toast.success(intent === 'signup' ? 'Account created' : 'Signed in');
      } else {
        await loginDemo({ email: values.email, name: values.name, intent });
        toast.success('Signed in to the demo workspace');
      }
      navigate(from, { replace: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not sign in');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid min-h-screen bg-white lg:grid-cols-[1.05fr_1fr]">
      <section className="relative hidden overflow-hidden bg-ink-900 p-10 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute inset-0 surface-grid opacity-[0.09]" />
        <div className="absolute -left-24 top-1/4 size-[420px] rounded-full bg-brand-600/30 blur-3xl" />
        <div className="absolute -right-24 bottom-0 size-[360px] rounded-full bg-sky-500/20 blur-3xl" />

        <div className="relative">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/15">
              <FileText className="size-5" />
            </div>
            <div>
              <p className="text-lg font-bold tracking-tight">
                Resume<span className="text-brand-300">GEN</span>
              </p>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/45">
                Evidence-first resume studio
              </p>
            </div>
          </div>
        </div>

        <div className="relative max-w-xl">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-brand-200">
            <Sparkles className="size-3" /> Tailor without inventing
          </span>
          <h1 className="mt-5 text-balance text-[42px] font-bold leading-[1.08] tracking-[-0.03em]">
            One verified portfolio.
            <br />
            A resume for every role.
          </h1>
          <p className="mt-4 max-w-md text-[15px] leading-relaxed text-white/60">
            Match job requirements to real project evidence, select what belongs, and export a
            concise resume — without fabricated skills or metrics.
          </p>

          <div className="mt-8 space-y-3">
            {FEATURES.map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-start gap-3 text-sm text-white/70">
                <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-lg bg-white/10 text-brand-200">
                  <Icon className="size-3.5" />
                </span>
                {text}
              </div>
            ))}
          </div>
        </div>

        <div className="relative rounded-2xl border border-white/10 bg-white/[0.06] p-4 backdrop-blur">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-white/40">
              Example match
            </p>
            <span className="rounded-full bg-emerald-400/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-300">
              17 strong
            </span>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {[
              ['Python', 'Strong evidence', 'emerald'],
              ['scikit-learn', 'Strong evidence', 'emerald'],
              ['Docker', 'Partial evidence', 'amber'],
              ['Kubernetes', 'Not evidenced', 'slate'],
            ].map(([skill, status, tone]) => (
              <div
                key={skill}
                className="flex items-center justify-between rounded-xl border border-white/10 bg-ink-900/40 px-3 py-2"
              >
                <span className="text-xs font-medium text-white/80">{skill}</span>
                <span
                  className={cn(
                    'text-[10px] font-semibold',
                    tone === 'emerald' && 'text-emerald-300',
                    tone === 'amber' && 'text-amber-300',
                    tone === 'slate' && 'text-white/40',
                  )}
                >
                  {status}
                </span>
              </div>
            ))}
          </div>
        </div>

        <p className="relative text-[11px] text-white/35">
          Fictional sample data only. No real credentials are required in demo mode.
        </p>
      </section>

      <section className="flex items-center justify-center px-5 py-10 sm:px-10">
        <div className="w-full max-w-[400px]">
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <div className="flex size-9 items-center justify-center rounded-xl bg-brand-600 text-white">
              <FileText className="size-[18px]" />
            </div>
            <p className="text-base font-bold tracking-tight text-ink-900">
              Resume<span className="text-brand-600">GEN</span>
            </p>
          </div>

          <div className="mb-7">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-brand-600">
              {isFirebase ? 'Secure workspace' : 'Demo workspace'}
            </p>
            <h2 className="mt-2 text-[28px] font-bold tracking-tight text-ink-900">
              {intent === 'signup' ? 'Create your workspace' : 'Welcome back'}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-500">
              {isFirebase
                ? 'Sign in with the Firebase account that owns this workspace.'
                : 'Enter any email to explore the demo. Your data stays in the local demo store.'}
            </p>
          </div>

          {config ? (
            <InlineNotice tone={isFirebase ? 'success' : 'warning'} className="mb-5">
              <div className="flex items-start gap-2">
                {isFirebase ? (
                  <LockKeyhole className="mt-0.5 size-4 shrink-0" />
                ) : (
                  <Bot className="mt-0.5 size-4 shrink-0" />
                )}
                <span>
                  {isFirebase
                    ? 'Firebase Authentication is enabled. Requests are verified server-side.'
                    : config.demoModeReason ??
                      'Demo authentication is enabled. Do not use real personal data in this mode.'}
                </span>
              </div>
            </InlineNotice>
          ) : null}

          <form className="space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
            {intent === 'signup' || isFirebase ? (
              <Field
                label="Display name"
                htmlFor="name"
                error={errors.name?.message}
                hint={isFirebase ? 'Shown in your workspace.' : 'Optional for the demo.'}
              >
                <Input id="name" autoComplete="name" placeholder="Ada Lovelace" {...register('name')} />
              </Field>
            ) : null}

            <Field label="Email address" htmlFor="email" required error={errors.email?.message}>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                aria-invalid={Boolean(errors.email)}
                {...register('email')}
              />
            </Field>

            {isFirebase ? (
              <Field label="Password" htmlFor="password" required error={errors.password?.message}>
                <Input
                  id="password"
                  type="password"
                  autoComplete={intent === 'signup' ? 'new-password' : 'current-password'}
                  placeholder="••••••••"
                  {...register('password')}
                />
              </Field>
            ) : null}

            <Button type="submit" size="lg" className="w-full" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="animate-spin" /> Signing in…
                </>
              ) : (
                <>
                  {intent === 'signup' ? 'Create workspace' : 'Enter workspace'} <ArrowRight />
                </>
              )}
            </Button>
          </form>

          <div className="mt-5 flex items-center justify-between text-sm">
            <span className="text-ink-500">
              {intent === 'signup' ? 'Already have an account?' : 'New to ResumeGEN?'}
            </span>
            <button
              type="button"
              onClick={() => setIntent(intent === 'signup' ? 'signin' : 'signup')}
              className="font-semibold text-brand-600 hover:text-brand-700"
            >
              {intent === 'signup' ? 'Sign in' : 'Create demo workspace'}
            </button>
          </div>

          <div className="mt-8 grid gap-2 rounded-xl border border-ink-200 bg-ink-50/60 p-3 text-[11px] text-ink-500">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="size-3.5 text-emerald-600" />
              Ownership checks on every API request
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="size-3.5 text-emerald-600" />
              No Gemini key is ever exposed to the browser
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="size-3.5 text-emerald-600" />
              Demo data is clearly fictional
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
