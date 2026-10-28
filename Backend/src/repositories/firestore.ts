import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import type { JobDescription, PortfolioRecord, SavedResume, UserProfile } from '../../../shared/schemas';
import { emptyIntegration, type IntegrationRecord, type Repository } from './types';
import { nowIso } from '../utils/ids';
import { ApiError } from '../utils/errors';

/**
 * Firestore adapter. All reads/writes happen through the Admin SDK, which
 * bypasses client security rules — therefore every method requires the
 * authenticated uid supplied by the auth middleware, never a request body.
 */
export class FirestoreRepository implements Repository {
  readonly kind = 'firestore' as const;

  constructor(private readonly db: Firestore) {}

  private userDoc(uid: string) {
    return this.db.collection('users').doc(uid);
  }

  private collection(uid: string, name: string) {
    return this.userDoc(uid).collection(name);
  }

  async getUser(uid: string): Promise<UserProfile | null> {
    const snapshot = await this.userDoc(uid).get();
    if (!snapshot.exists) return null;
    const data = snapshot.data();
    if (!data) return null;
    return {
      uid,
      email: String(data.email ?? ''),
      displayName: String(data.displayName ?? ''),
      createdAt: String(data.createdAt ?? nowIso()),
      lastLoginAt: String(data.lastLoginAt ?? nowIso()),
      authMode: (data.authMode as UserProfile['authMode']) ?? 'firebase',
    };
  }

  async upsertUser(profile: UserProfile): Promise<UserProfile> {
    await this.userDoc(profile.uid).set(profile, { merge: true });
    return profile;
  }

  async listPortfolio(uid: string): Promise<PortfolioRecord[]> {
    const snapshot = await this.collection(uid, 'portfolio').orderBy('updatedAt', 'desc').get();
    return snapshot.docs.map((doc) => doc.data() as PortfolioRecord);
  }

  async getPortfolio(uid: string, id: string): Promise<PortfolioRecord | null> {
    const snapshot = await this.collection(uid, 'portfolio').doc(id).get();
    return snapshot.exists ? (snapshot.data() as PortfolioRecord) : null;
  }

  async createPortfolio(uid: string, record: PortfolioRecord): Promise<PortfolioRecord> {
    if (await this.getPortfolio(uid, record.id)) {
      throw ApiError.conflict('A portfolio record with this id already exists.');
    }
    await this.collection(uid, 'portfolio').doc(record.id).create(record);
    return record;
  }

  async updatePortfolio(uid: string, id: string, record: PortfolioRecord): Promise<PortfolioRecord> {
    const reference = this.collection(uid, 'portfolio').doc(id);
    const snapshot = await reference.get();
    if (!snapshot.exists) throw ApiError.notFound('Portfolio record not found.');
    await reference.set(record);
    return record;
  }

  async deletePortfolio(uid: string, id: string): Promise<void> {
    await this.collection(uid, 'portfolio').doc(id).delete();
  }

  async listJobDescriptions(uid: string): Promise<JobDescription[]> {
    const snapshot = await this.collection(uid, 'jobDescriptions').orderBy('updatedAt', 'desc').get();
    return snapshot.docs.map((doc) => doc.data() as JobDescription);
  }

  async getJobDescription(uid: string, id: string): Promise<JobDescription | null> {
    const snapshot = await this.collection(uid, 'jobDescriptions').doc(id).get();
    return snapshot.exists ? (snapshot.data() as JobDescription) : null;
  }

  async createJobDescription(uid: string, job: JobDescription): Promise<JobDescription> {
    await this.collection(uid, 'jobDescriptions').doc(job.id).create(job);
    return job;
  }

  async updateJobDescription(uid: string, id: string, job: JobDescription): Promise<JobDescription> {
    const reference = this.collection(uid, 'jobDescriptions').doc(id);
    const snapshot = await reference.get();
    if (!snapshot.exists) throw ApiError.notFound('Job description not found.');
    await reference.set(job);
    return job;
  }

  async deleteJobDescription(uid: string, id: string): Promise<void> {
    await this.collection(uid, 'jobDescriptions').doc(id).delete();
  }

  async listResumes(uid: string): Promise<SavedResume[]> {
    const snapshot = await this.collection(uid, 'resumes').orderBy('updatedAt', 'desc').get();
    return snapshot.docs.map((doc) => doc.data() as SavedResume);
  }

  async getResume(uid: string, id: string): Promise<SavedResume | null> {
    const snapshot = await this.collection(uid, 'resumes').doc(id).get();
    return snapshot.exists ? (snapshot.data() as SavedResume) : null;
  }

  async createResume(uid: string, resume: SavedResume): Promise<SavedResume> {
    await this.collection(uid, 'resumes').doc(resume.id).create(resume);
    return resume;
  }

  async updateResume(uid: string, id: string, resume: SavedResume): Promise<SavedResume> {
    const reference = this.collection(uid, 'resumes').doc(id);
    const snapshot = await reference.get();
    if (!snapshot.exists) throw ApiError.notFound('Saved resume not found.');
    await reference.set(resume);
    return resume;
  }

  async deleteResume(uid: string, id: string): Promise<void> {
    await this.collection(uid, 'resumes').doc(id).delete();
  }

  async getIntegration(uid: string): Promise<IntegrationRecord | null> {
    const snapshot = await this.collection(uid, 'integrations').doc('google_sheets').get();
    if (!snapshot.exists) return null;
    return {
      ...emptyIntegration(),
      ...(snapshot.data() as Partial<IntegrationRecord>),
    };
  }

  async saveIntegration(uid: string, integration: IntegrationRecord): Promise<IntegrationRecord> {
    await this.collection(uid, 'integrations').doc('google_sheets').set(integration, { merge: true });
    return integration;
  }

  async markPortfolioChanged(uid: string): Promise<void> {
    await this.collection(uid, 'integrations')
      .doc('google_sheets')
      .set(
        {
          status: 'pending',
          pendingChanges: FieldValue.increment(1),
          updatedAt: nowIso(),
        },
        { merge: true },
      );
  }
}
