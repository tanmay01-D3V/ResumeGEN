import type {
  JobDescription,
  PortfolioRecord,
  SavedResume,
  UserProfile,
} from '../../../shared/schemas';

export type AuthKind = 'firebase' | 'demo';

export interface Repository {
  readonly kind: 'firestore' | 'local';
  getUser(uid: string): Promise<UserProfile | null>;
  upsertUser(profile: UserProfile): Promise<UserProfile>;

  listPortfolio(uid: string): Promise<PortfolioRecord[]>;
  getPortfolio(uid: string, id: string): Promise<PortfolioRecord | null>;
  createPortfolio(uid: string, record: PortfolioRecord): Promise<PortfolioRecord>;
  updatePortfolio(uid: string, id: string, record: PortfolioRecord): Promise<PortfolioRecord>;
  deletePortfolio(uid: string, id: string): Promise<void>;

  listJobDescriptions(uid: string): Promise<JobDescription[]>;
  getJobDescription(uid: string, id: string): Promise<JobDescription | null>;
  createJobDescription(uid: string, job: JobDescription): Promise<JobDescription>;
  updateJobDescription(uid: string, id: string, job: JobDescription): Promise<JobDescription>;
  deleteJobDescription(uid: string, id: string): Promise<void>;

  listResumes(uid: string): Promise<SavedResume[]>;
  getResume(uid: string, id: string): Promise<SavedResume | null>;
  createResume(uid: string, resume: SavedResume): Promise<SavedResume>;
  updateResume(uid: string, id: string, resume: SavedResume): Promise<SavedResume>;
  deleteResume(uid: string, id: string): Promise<void>;

  getIntegration(uid: string): Promise<IntegrationRecord | null>;
  saveIntegration(uid: string, integration: IntegrationRecord): Promise<IntegrationRecord>;
  markPortfolioChanged(uid: string): Promise<void>;
}

export interface IntegrationRecord {
  spreadsheetId: string;
  autoSync: boolean;
  status: 'never_synced' | 'synced' | 'pending' | 'error';
  lastSyncAt?: string;
  lastError?: string;
  pendingChanges: number;
  updatedAt: string;
}

export function emptyIntegration(): IntegrationRecord {
  return {
    spreadsheetId: '',
    autoSync: false,
    status: 'never_synced',
    pendingChanges: 0,
    updatedAt: new Date().toISOString(),
  };
}
