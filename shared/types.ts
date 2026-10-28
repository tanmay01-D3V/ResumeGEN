export * from './categories';
export * from './schemas';

export type AuthMode = 'firebase' | 'demo';

export interface PublicConfig {
  authMode: AuthMode;
  aiConfigured: boolean;
  aiModel: string;
  sheetsConfigured: boolean;
  spreadsheetConfigured: boolean;
  firebaseProjectId?: string;
  demoModeReason?: string;
}

export interface MeResponse {
  user: {
    uid: string;
    email: string;
    displayName: string;
    authMode: AuthMode;
    createdAt?: string;
  };
  config: PublicConfig;
}

export interface DashboardResponse {
  counts: {
    portfolioEntries: number;
    projects: number;
    technicalSkills: number;
    certifications: number;
    experiences: number;
    savedResumes: number;
    jobDescriptions: number;
  };
  categoryCounts: Record<string, number>;
  recentRecords: Array<{
    id: string;
    title: string;
    category: string;
    updatedAt: string;
  }>;
  recentResumes: Array<{
    id: string;
    title: string;
    jobTitle: string;
    company: string;
    updatedAt: string;
  }>;
  sheets: import('./schemas').IntegrationStatus;
  hasPersonalInfo: boolean;
  hasSummary: boolean;
}

export interface ApiErrorShape {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}
