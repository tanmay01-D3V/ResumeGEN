import type {
  DashboardResponse,
  GenerateResumeRequest,
  GenerateResumeResponse,
  ImportProposal,
  IntegrationStatus,
  ImprovementSuggestion,
  JDAnalysis,
  JobDescription,
  JobDescriptionInput,
  MatchResponse,
  MeResponse,
  PortfolioCategory,
  PortfolioRecord,
  PortfolioRecordInput,
  PublicConfig,
  ResumeSettings,
  SavedResume,
  SheetPreview,
  StructuredRecordCandidate,
  UserProfile,
} from '@shared/types';
import { downloadBlob } from './utils';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '');
const TOKEN_KEY = 'resumegen.token';
export const UNAUTHORIZED_EVENT = 'resumegen:unauthorized';

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(message: string, status: number, code = 'request_failed', details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null): void {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

type RequestOptions = Omit<RequestInit, 'body'> & { body?: unknown; auth?: boolean };

async function parseError(response: Response): Promise<ApiError> {
  let message = `Request failed (${response.status})`;
  let code = 'request_failed';
  let details: unknown;
  try {
    const payload = (await response.json()) as {
      error?: { message?: string; code?: string; details?: unknown };
    };
    if (payload?.error?.message) message = payload.error.message;
    if (payload?.error?.code) code = payload.error.code;
    details = payload?.error?.details;
  } catch {
    // Non-JSON response (e.g. HTML 502). Keep the generic message.
  }
  return new ApiError(message, response.status, code, details);
}

function buildHeaders(options: RequestOptions): HeadersInit {
  const headers = new Headers(options.headers);
  if (options.body !== undefined && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  const token = getToken();
  if (token && options.auth !== false) headers.set('Authorization', `Bearer ${token}`);
  return headers;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: buildHeaders(options),
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  if (response.status === 401 && options.auth !== false) {
    setToken(null);
    window.dispatchEvent(new CustomEvent(UNAUTHORIZED_EVENT));
  }

  if (!response.ok) throw await parseError(response);
  if (response.status === 204) return undefined as T;
  const payload = (await response.json()) as { data: T };
  return payload.data;
}

async function download(path: string, body: unknown, fallbackName: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: buildHeaders({ body, method: 'POST' }),
    body: JSON.stringify(body),
  });
  if (!response.ok) throw await parseError(response);
  const blob = await response.blob();
  const disposition = response.headers.get('content-disposition') ?? '';
  const match = disposition.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i);
  downloadBlob(blob, match ? decodeURIComponent(match[1]) : fallbackName);
}

async function downloadGet(path: string, fallbackName: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'GET',
    headers: buildHeaders({ method: 'GET' }),
  });
  if (!response.ok) throw await parseError(response);
  const blob = await response.blob();
  const disposition = response.headers.get('content-disposition') ?? '';
  const match = disposition.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i);
  downloadBlob(blob, match ? decodeURIComponent(match[1]) : fallbackName);
}

async function fetchPdfBlob(path: string, body?: unknown): Promise<Blob> {
  const method = body === undefined ? 'GET' : 'POST';
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: buildHeaders({ body, method }),
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) throw await parseError(response);
  return response.blob();
}

/* ------------------------------------------------------------------ */
/* Endpoints                                                           */
/* ------------------------------------------------------------------ */

export const api = {
  config: () => request<PublicConfig>('/config', { auth: false }),

  demoLogin: (input: { email: string; name?: string; intent?: 'signin' | 'signup' }) =>
    request<{ token: string; user: UserProfile; config: PublicConfig; notice: string }>('/auth/demo', {
      method: 'POST',
      body: input,
      auth: false,
    }),

  me: () => request<MeResponse>('/me'),

  updateMe: (displayName: string) =>
    request<{ user: UserProfile }>('/me', { method: 'PATCH', body: { displayName } }),

  dashboard: () => request<DashboardResponse>('/dashboard'),

  seed: () =>
    request<{ created: number; jobDescriptions: number; resumes: number }>('/demo/seed', {
      method: 'POST',
    }),

  listPortfolio: () => request<{ records: PortfolioRecord[] }>('/portfolio'),

  createRecord: (input: PortfolioRecordInput) =>
    request<{ record: PortfolioRecord }>('/portfolio', { method: 'POST', body: input }),

  updateRecord: (
    id: string,
    patch: {
      title?: string;
      data?: Record<string, unknown>;
      tags?: string[];
      verificationStatus?: string;
    },
  ) => request<{ record: PortfolioRecord }>(`/portfolio/${id}`, { method: 'PATCH', body: patch }),

  deleteRecord: (id: string) =>
    request<{ id: string; deleted: boolean }>(`/portfolio/${id}`, { method: 'DELETE' }),

  structurePortfolioText: (text: string) =>
    request<{ records: StructuredRecordCandidate[]; notes: string; engine: string }>(
      '/portfolio/structure-text',
      { method: 'POST', body: { text } },
    ),

  importConfirmedRecords: (
    records: Array<{
      category: PortfolioCategory;
      title: string;
      data: Record<string, unknown>;
      tags?: string[];
    }>,
  ) =>
    request<{ created: PortfolioRecord[]; skipped: Array<{ title: string; reason: string }> }>(
      '/portfolio/import-confirm',
      { method: 'POST', body: { records } },
    ),

  listJobs: () => request<{ jobDescriptions: JobDescription[] }>('/job-descriptions'),
  getJob: (id: string) =>
    request<{ jobDescription: JobDescription }>(`/job-descriptions/${id}`),
  createJob: (input: JobDescriptionInput) =>
    request<{ jobDescription: JobDescription }>('/job-descriptions', { method: 'POST', body: input }),
  updateJob: (id: string, input: JobDescriptionInput) =>
    request<{ jobDescription: JobDescription }>(`/job-descriptions/${id}`, {
      method: 'PATCH',
      body: input,
    }),
  deleteJob: (id: string) =>
    request<{ id: string; deleted: boolean }>(`/job-descriptions/${id}`, { method: 'DELETE' }),
  analyzeJob: (id: string) =>
    request<{ job: JobDescription; warning?: string; analysis?: JDAnalysis }>(
      `/job-descriptions/${id}/analyze`,
      { method: 'POST' },
    ),

  match: (jobDescriptionId: string, useAi = true) =>
    request<MatchResponse>('/resumes/match', {
      method: 'POST',
      body: { jobDescriptionId, useAi },
    }),

  generateResume: (input: GenerateResumeRequest) =>
    request<GenerateResumeResponse>('/resumes/generate', { method: 'POST', body: input }),

  suggestions: (input: { jobDescriptionId: string; selectedRecordIds: string[]; summary?: string }) =>
    request<{ suggestions: ImprovementSuggestion[]; disclaimer: string }>('/resumes/suggestions', {
      method: 'POST',
      body: input,
    }),

  listResumes: () => request<{ resumes: SavedResume[] }>('/resumes'),
  getResume: (id: string) => request<{ resume: SavedResume }>(`/resumes/${id}`),
  saveResume: (input: {
    title: string;
    jobDescriptionId: string;
    selectedRecordIds: string[];
    settings: ResumeSettings;
    aiAssisted: boolean;
  }) => request<{ resume: SavedResume }>('/resumes', { method: 'POST', body: input }),
  renameResume: (id: string, title: string) =>
    request<{ resume: SavedResume }>(`/resumes/${id}`, { method: 'PATCH', body: { title } }),
  deleteResume: (id: string) =>
    request<{ id: string; deleted: boolean }>(`/resumes/${id}`, { method: 'DELETE' }),

  downloadPreviewPdf: (input: GenerateResumeRequest, filename = 'resume.pdf') =>
    download('/resumes/pdf', input, filename),
  downloadSavedPdf: (id: string, filename = 'resume.pdf') =>
    downloadGet(`/resumes/${id}/pdf`, filename),

  previewPdfBlob: (input: GenerateResumeRequest) => fetchPdfBlob('/resumes/pdf', input),
  savedPdfBlob: (id: string) => fetchPdfBlob(`/resumes/${id}/pdf`),

  sheetsStatus: () => request<{ status: IntegrationStatus }>('/integrations/google-sheets/status'),
  sheetsPreview: () =>
    request<{ preview: SheetPreview }>('/integrations/google-sheets/preview'),
  updateSheetsConfig: (input: { spreadsheetId?: string; autoSync?: boolean }) =>
    request<{ status: IntegrationStatus }>('/integrations/google-sheets/config', {
      method: 'PATCH',
      body: input,
    }),
  syncSheets: () =>
    request<{
      status: IntegrationStatus;
      tabs: Array<{ name: string; updated: number; appended: number; removed: number }>;
    }>('/integrations/google-sheets/sync', { method: 'POST' }),
  sheetsImportPreview: () =>
    request<{
      proposals: ImportProposal[];
      summary: Record<string, number>;
      spreadsheetIdMasked: string;
    }>('/integrations/google-sheets/import', { method: 'POST' }),
  sheetsImportConfirm: (recordIds: string[]) =>
    request<{
      applied: PortfolioRecord[];
      skipped: Array<{ recordId: string; reason: string }>;
    }>('/integrations/google-sheets/import/confirm', {
      method: 'POST',
      body: { recordIds },
    }),
};

export type { ImportProposal, IntegrationStatus, MatchResponse, ResumeSettings, SavedResume };
