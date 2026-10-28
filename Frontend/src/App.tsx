import { FileText } from 'lucide-react';
import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { Toaster } from 'sonner';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { DashboardPage } from '@/pages/DashboardPage';
import { JobAnalyzerPage } from '@/pages/JobAnalyzerPage';
import { JobDetailPage } from '@/pages/JobDetailPage';
import { LoginPage } from '@/pages/LoginPage';
import { PortfolioPage } from '@/pages/PortfolioPage';
import { ResumeBuilderPage } from '@/pages/ResumeBuilderPage';
import { SavedResumeDetailPage } from '@/pages/SavedResumeDetailPage';
import { SavedResumesPage } from '@/pages/SavedResumesPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { SheetsPage } from '@/pages/SheetsPage';

function BootScreen() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-ink-50">
      <div className="flex size-12 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-float">
        <FileText className="size-6" />
      </div>
      <div className="text-center">
        <p className="text-sm font-bold tracking-tight text-ink-900">
          Resume<span className="text-brand-600">GEN</span>
        </p>
        <p className="mt-1 text-xs text-ink-400">Restoring your workspace…</p>
      </div>
      <span className="size-5 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" />
    </div>
  );
}

function ProtectedRoute() {
  const { user, initializing } = useAuth();
  const location = useLocation();

  if (initializing) return <BootScreen />;
  if (!user) {
    return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />;
  }
  return <Outlet />;
}

function PublicOnlyRoute() {
  const { user, initializing } = useAuth();
  if (initializing) return <BootScreen />;
  if (user) return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}

function NotFoundPage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <p className="text-6xl font-bold tracking-tight text-ink-200">404</p>
      <h1 className="mt-3 text-xl font-semibold text-ink-900">This page does not exist</h1>
      <p className="mt-1.5 max-w-sm text-sm text-ink-500">
        The link may be outdated. Return to your dashboard and continue from there.
      </p>
      <a
        href="/dashboard"
        className="mt-5 inline-flex h-10 items-center rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700"
      >
        Back to dashboard
      </a>
    </div>
  );
}

export default function App() {
  return (
    <>
      <Routes>
        <Route element={<PublicOnlyRoute />}>
          <Route path="/login" element={<LoginPage />} />
        </Route>

        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/portfolio" element={<PortfolioPage />} />
            <Route path="/jobs" element={<JobAnalyzerPage />} />
            <Route path="/jobs/:id" element={<JobDetailPage />} />
            <Route path="/resume-builder" element={<ResumeBuilderPage />} />
            <Route path="/resumes" element={<SavedResumesPage />} />
            <Route path="/resumes/:id" element={<SavedResumeDetailPage />} />
            <Route path="/sheets" element={<SheetsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Route>
      </Routes>

      <Toaster
        position="top-right"
        richColors
        closeButton
        toastOptions={{
          style: {
            fontFamily: 'inherit',
            borderRadius: '12px',
          },
        }}
      />
    </>
  );
}
