import fs from 'node:fs';
import path from 'node:path';
import type { JobDescription, PortfolioRecord, SavedResume, UserProfile } from '../../../shared/schemas';
import { nowIso } from '../utils/ids';
import { ApiError } from '../utils/errors';
import { emptyIntegration, type IntegrationRecord, type Repository } from './types';

interface LocalUser {
  profile: UserProfile;
  portfolio: PortfolioRecord[];
  jobDescriptions: JobDescription[];
  resumes: SavedResume[];
  integration: IntegrationRecord | null;
}

interface LocalDb {
  schemaVersion: number;
  users: Record<string, LocalUser>;
}

/**
 * File-backed repository for zero-configuration local demos. It mirrors the
 * Firestore adapter's contract and keeps every record scoped by uid. It is
 * only selected when Firebase Admin credentials are absent (or DEMO_MODE=true)
 * and is clearly surfaced in the UI as "local demo store".
 */
export class LocalRepository implements Repository {
  readonly kind = 'local' as const;
  private data: LocalDb = { schemaVersion: 1, users: {} };
  private readonly file: string;
  private queue: Promise<void> = Promise.resolve();

  constructor(file: string) {
    this.file = file;
    if (file === ':memory:') return;
    fs.mkdirSync(path.dirname(file), { recursive: true });
    if (fs.existsSync(file)) {
      try {
        const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as LocalDb;
        if (parsed && typeof parsed === 'object' && parsed.users) {
          this.data = { schemaVersion: 1, users: parsed.users };
        }
      } catch {
        // Corrupt demo data should not prevent the API from booting.
        this.data = { schemaVersion: 1, users: {} };
      }
    }
  }

  private user(uid: string, create = false): LocalUser | null {
    let user = this.data.users[uid];
    if (!user && create) {
      const timestamp = nowIso();
      user = {
        profile: {
          uid,
          email: 'unknown@example.com',
          displayName: 'Demo user',
          createdAt: timestamp,
          lastLoginAt: timestamp,
          authMode: 'demo',
        },
        portfolio: [],
        jobDescriptions: [],
        resumes: [],
        integration: null,
      };
      this.data.users[uid] = user;
    }
    return user ?? null;
  }

  private async persist(): Promise<void> {
    if (this.file === ':memory:') return;
    const snapshot = JSON.stringify(this.data, null, 2);
    this.queue = this.queue.then(async () => {
      const dir = path.dirname(this.file);
      await fs.promises.mkdir(dir, { recursive: true });
      const temp = path.join(dir, `.db-${process.pid}-${Date.now()}.tmp`);
      await fs.promises.writeFile(temp, snapshot, 'utf8');
      await fs.promises.rename(temp, this.file);
    });
    await this.queue;
  }

  async getUser(uid: string): Promise<UserProfile | null> {
    return this.user(uid)?.profile ?? null;
  }

  async upsertUser(profile: UserProfile): Promise<UserProfile> {
    const user = this.user(profile.uid, true)!;
    user.profile = profile;
    await this.persist();
    return profile;
  }

  async listPortfolio(uid: string): Promise<PortfolioRecord[]> {
    return [...(this.user(uid)?.portfolio ?? [])].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async getPortfolio(uid: string, id: string): Promise<PortfolioRecord | null> {
    return this.user(uid)?.portfolio.find((record) => record.id === id) ?? null;
  }

  async createPortfolio(uid: string, record: PortfolioRecord): Promise<PortfolioRecord> {
    const user = this.user(uid, true)!;
    user.portfolio.push(record);
    await this.persist();
    return record;
  }

  async updatePortfolio(uid: string, id: string, record: PortfolioRecord): Promise<PortfolioRecord> {
    const user = this.user(uid, true)!;
    const index = user.portfolio.findIndex((item) => item.id === id);
    if (index === -1) throw ApiError.notFound('Portfolio record not found.');
    user.portfolio[index] = record;
    await this.persist();
    return record;
  }

  async deletePortfolio(uid: string, id: string): Promise<void> {
    const user = this.user(uid);
    if (!user) return;
    user.portfolio = user.portfolio.filter((item) => item.id !== id);
    await this.persist();
  }

  async listJobDescriptions(uid: string): Promise<JobDescription[]> {
    return [...(this.user(uid)?.jobDescriptions ?? [])].sort((a, b) =>
      b.updatedAt.localeCompare(a.updatedAt),
    );
  }

  async getJobDescription(uid: string, id: string): Promise<JobDescription | null> {
    return this.user(uid)?.jobDescriptions.find((item) => item.id === id) ?? null;
  }

  async createJobDescription(uid: string, job: JobDescription): Promise<JobDescription> {
    this.user(uid, true)!.jobDescriptions.push(job);
    await this.persist();
    return job;
  }

  async updateJobDescription(uid: string, id: string, job: JobDescription): Promise<JobDescription> {
    const user = this.user(uid, true)!;
    const index = user.jobDescriptions.findIndex((item) => item.id === id);
    if (index === -1) throw ApiError.notFound('Job description not found.');
    user.jobDescriptions[index] = job;
    await this.persist();
    return job;
  }

  async deleteJobDescription(uid: string, id: string): Promise<void> {
    const user = this.user(uid);
    if (!user) return;
    user.jobDescriptions = user.jobDescriptions.filter((item) => item.id !== id);
    await this.persist();
  }

  async listResumes(uid: string): Promise<SavedResume[]> {
    return [...(this.user(uid)?.resumes ?? [])].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async getResume(uid: string, id: string): Promise<SavedResume | null> {
    return this.user(uid)?.resumes.find((item) => item.id === id) ?? null;
  }

  async createResume(uid: string, resume: SavedResume): Promise<SavedResume> {
    this.user(uid, true)!.resumes.push(resume);
    await this.persist();
    return resume;
  }

  async updateResume(uid: string, id: string, resume: SavedResume): Promise<SavedResume> {
    const user = this.user(uid, true)!;
    const index = user.resumes.findIndex((item) => item.id === id);
    if (index === -1) throw ApiError.notFound('Saved resume not found.');
    user.resumes[index] = resume;
    await this.persist();
    return resume;
  }

  async deleteResume(uid: string, id: string): Promise<void> {
    const user = this.user(uid);
    if (!user) return;
    user.resumes = user.resumes.filter((item) => item.id !== id);
    await this.persist();
  }

  async getIntegration(uid: string): Promise<IntegrationRecord | null> {
    return this.user(uid)?.integration ?? null;
  }

  async saveIntegration(uid: string, integration: IntegrationRecord): Promise<IntegrationRecord> {
    this.user(uid, true)!.integration = integration;
    await this.persist();
    return integration;
  }

  async markPortfolioChanged(uid: string): Promise<void> {
    const user = this.user(uid, true)!;
    const current = user.integration ?? emptyIntegration();
    user.integration = {
      ...current,
      pendingChanges: current.pendingChanges + 1,
      status: 'pending',
      updatedAt: nowIso(),
    };
    await this.persist();
  }
}
