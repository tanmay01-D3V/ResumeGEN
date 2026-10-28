import type { DashboardResponse } from '../../../shared/types';
import type { Services } from './index';
import type { UserProfile } from '../../../shared/schemas';
import { nowIso } from '../utils/ids';

export async function buildDashboard(services: Services, uid: string): Promise<DashboardResponse> {
  const [records, resumes, jobs, sheets] = await Promise.all([
    services.repo.listPortfolio(uid),
    services.repo.listResumes(uid),
    services.repo.listJobDescriptions(uid),
    services.sheets.getStatus(uid),
  ]);

  const categoryCounts: Record<string, number> = {};
  for (const record of records) {
    categoryCounts[record.category] = (categoryCounts[record.category] ?? 0) + 1;
  }

  return {
    counts: {
      portfolioEntries: records.length,
      projects: categoryCounts.projects ?? 0,
      technicalSkills: categoryCounts.technical_skills ?? 0,
      certifications: categoryCounts.certifications ?? 0,
      experiences: categoryCounts.experience ?? 0,
      savedResumes: resumes.length,
      jobDescriptions: jobs.length,
    },
    categoryCounts,
    recentRecords: records.slice(0, 6).map((record) => ({
      id: record.id,
      title: record.title,
      category: record.category,
      updatedAt: record.updatedAt,
    })),
    recentResumes: resumes.slice(0, 5).map((resume) => ({
      id: resume.id,
      title: resume.title,
      jobTitle: resume.jobTitle,
      company: resume.company,
      updatedAt: resume.updatedAt,
    })),
    sheets,
    hasPersonalInfo: Boolean(categoryCounts.personal_info),
    hasSummary: Boolean(categoryCounts.summary),
  };
}

export function buildUserProfile(input: {
  uid: string;
  email: string;
  name: string;
  authMode: 'firebase' | 'demo';
  existing?: UserProfile | null;
}): UserProfile {
  const timestamp = nowIso();
  return {
    uid: input.uid,
    email: input.email,
    displayName: input.name || input.existing?.displayName || input.email || 'User',
    createdAt: input.existing?.createdAt ?? timestamp,
    lastLoginAt: timestamp,
    authMode: input.authMode,
  };
}
