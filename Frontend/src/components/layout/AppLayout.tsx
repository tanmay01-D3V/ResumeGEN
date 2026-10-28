import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import {
  Bot,
  ChevronDown,
  FileText,
  LayoutDashboard,
  LibraryBig,
  LogOut,
  Menu,
  Settings,
  Sheet,
  Sparkles,
  Target,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { cn, initials } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/portfolio', label: 'Portfolio', icon: LibraryBig },
  { to: '/jobs', label: 'Job Analyzer', icon: Target },
  { to: '/resume-builder', label: 'Resume Builder', icon: Sparkles },
  { to: '/resumes', label: 'Saved Resumes', icon: FileText },
  { to: '/sheets', label: 'Google Sheets', icon: Sheet },
];

const PAGE_LABELS: Array<{ prefix: string; label: string }> = [
  { prefix: '/dashboard', label: 'Dashboard' },
  { prefix: '/portfolio', label: 'Portfolio' },
  { prefix: '/jobs', label: 'Job Analyzer' },
  { prefix: '/resume-builder', label: 'Resume Builder' },
  { prefix: '/resumes', label: 'Saved Resumes' },
  { prefix: '/sheets', label: 'Google Sheets' },
  { prefix: '/settings', label: 'Settings' },
];

function pageLabel(pathname: string): string {
  return PAGE_LABELS.find((item) => pathname.startsWith(item.prefix))?.label ?? 'Workspace';
}

function BrandMark() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="relative flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-sm shadow-brand-600/30">
        <FileText className="size-[18px]" strokeWidth={2.2} />
        <span className="absolute -bottom-1 -right-1 flex size-4 items-center justify-center rounded-full bg-emerald-400 ring-2 ring-white">
          <Sparkles className="size-2.5 text-emerald-900" strokeWidth={3} />
        </span>
      </div>
      <div className="leading-tight">
        <p className="text-[15px] font-bold tracking-tight text-ink-900">
          Resume<span className="text-brand-600">GEN</span>
        </p>
        <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-ink-400">
          Evidence-first
        </p>
      </div>
    </div>
  );
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { config } = useAuth();

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-[72px] items-center px-5">
        <BrandMark />
      </div>

      <nav className="mt-2 flex-1 space-y-1 px-3" aria-label="Primary">
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition',
                isActive
                  ? 'bg-brand-50 text-brand-700 shadow-[inset_0_0_0_1px_rgb(199_210_254_/_0.65)]'
                  : 'text-ink-500 hover:bg-ink-50 hover:text-ink-900',
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icon
                  className={cn(
                    'size-[18px] transition',
                    isActive ? 'text-brand-600' : 'text-ink-400 group-hover:text-ink-600',
                  )}
                />
                {label}
                {label === 'Resume Builder' ? (
                  <span className="ml-auto rounded-md bg-brand-600/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-brand-700">
                    New
                  </span>
                ) : null}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="mx-3 mb-3 rounded-xl border border-ink-200 bg-ink-50/70 p-3">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">
            Environment
          </p>
          <Badge tone={config?.authMode === 'firebase' ? 'emerald' : 'amber'}>
            {config?.authMode === 'firebase' ? 'Live auth' : 'Demo auth'}
          </Badge>
        </div>
        <div className="mt-2.5 space-y-2 text-xs">
          <div className="flex items-center gap-2 text-ink-600">
            <Bot className="size-3.5 text-ink-400" />
            <span className="truncate">
              {config?.aiConfigured ? `Gemini · ${config.aiModel}` : 'Heuristic analysis'}
            </span>
          </div>
          <div className="flex items-center gap-2 text-ink-600">
            <Sheet className="size-3.5 text-ink-400" />
            <span>{config?.sheetsConfigured ? 'Sheets connected' : 'Sheets not configured'}</span>
          </div>
        </div>
      </div>

      <div className="border-t border-ink-100 px-3 py-3">
        <NavLink
          to="/settings"
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition',
              isActive ? 'bg-ink-100 text-ink-900' : 'text-ink-500 hover:bg-ink-50 hover:text-ink-900',
            )
          }
        >
          <Settings className="size-[18px] text-ink-400" />
          Settings
        </NavLink>
      </div>
    </div>
  );
}

function UserMenu() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  if (!user) return null;

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button className="flex items-center gap-2.5 rounded-xl border border-ink-200 bg-white py-1.5 pl-1.5 pr-2.5 text-left shadow-sm transition hover:bg-ink-50">
          <span className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 text-xs font-bold text-white">
            {initials(user.displayName || user.email)}
          </span>
          <span className="hidden min-w-0 sm:block">
            <span className="block max-w-[140px] truncate text-[13px] font-semibold leading-tight text-ink-900">
              {user.displayName || 'Your account'}
            </span>
            <span className="block max-w-[140px] truncate text-[11px] leading-tight text-ink-400">
              {user.email}
            </span>
          </span>
          <ChevronDown className="size-3.5 text-ink-400" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={8}
          className="z-[70] w-60 rounded-xl border border-ink-200 bg-white p-1.5 shadow-float data-[state=open]:animate-fade-in"
        >
          <div className="px-3 py-2">
            <p className="truncate text-sm font-semibold text-ink-900">{user.displayName}</p>
            <p className="truncate text-xs text-ink-400">{user.email}</p>
            <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-brand-600">
              {user.authMode === 'firebase' ? 'Firebase account' : 'Demo account'}
            </p>
          </div>
          <DropdownMenu.Separator className="my-1 h-px bg-ink-100" />
          <DropdownMenu.Item
            onSelect={() => navigate('/settings')}
            className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm text-ink-600 outline-none data-[highlighted]:bg-ink-50 data-[highlighted]:text-ink-900"
          >
            <Settings className="size-4 text-ink-400" /> Account settings
          </DropdownMenu.Item>
          <DropdownMenu.Item
            onSelect={logout}
            className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm text-rose-600 outline-none data-[highlighted]:bg-rose-50"
          >
            <LogOut className="size-4" /> Sign out
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

export function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const { config } = useAuth();

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileOpen]);

  return (
    <div className="min-h-screen bg-ink-50">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[264px] border-r border-ink-200 bg-white lg:block">
        <SidebarContent />
      </aside>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            className="absolute inset-0 bg-ink-900/40 backdrop-blur-[2px]"
            aria-label="Close navigation"
            onClick={() => setMobileOpen(false)}
          />
          <div className="relative h-full w-[280px] border-r border-ink-200 bg-white shadow-float animate-in-up">
            <button
              className="absolute right-3 top-5 rounded-lg p-1.5 text-ink-400 hover:bg-ink-100"
              onClick={() => setMobileOpen(false)}
              aria-label="Close navigation"
            >
              <X className="size-5" />
            </button>
            <SidebarContent onNavigate={() => setMobileOpen(false)} />
          </div>
        </div>
      ) : null}

      <div className="lg:pl-[264px]">
        <header className="sticky top-0 z-30 flex h-[64px] items-center justify-between gap-3 border-b border-ink-200/80 bg-white/85 px-4 backdrop-blur-md sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button
              className="rounded-lg p-2 text-ink-500 hover:bg-ink-100 lg:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation"
            >
              <Menu className="size-5" />
            </button>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-ink-400">
                Workspace
              </p>
              <p className="truncate text-sm font-semibold text-ink-900">
                {pageLabel(location.pathname)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <div className="hidden items-center gap-2 md:flex">
              <span
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold',
                  config?.aiConfigured
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                    : 'border-amber-200 bg-amber-50 text-amber-700',
                )}
                title={
                  config?.aiConfigured
                    ? 'Gemini API is configured on the server'
                    : 'AI is not configured; analysis uses a transparent local heuristic'
                }
              >
                <Bot className="size-3" />
                {config?.aiConfigured ? 'AI ready' : 'AI not configured'}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-ink-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-ink-500">
                <Sheet className="size-3" />
                {config?.sheetsConfigured ? 'Sheets ready' : 'Sheets offline'}
              </span>
            </div>
            <UserMenu />
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1240px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
