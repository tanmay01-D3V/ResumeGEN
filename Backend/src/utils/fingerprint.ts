import crypto from 'node:crypto';
import type { JobDescription, PortfolioRecord, ResumeSettings } from '../../../shared/schemas';

/**
 * Deterministic fingerprint of every input that affects resume content.
 * Used to detect stale previews and outdated saved versions.
 */
export function resumeFingerprint(input: {
  records: PortfolioRecord[];
  job: JobDescription;
  settings: ResumeSettings;
  selectedRecordIds: string[];
}): string {
  const records = input.records
    .map((record) => ({
      id: record.id,
      updatedAt: record.updatedAt,
      verificationStatus: record.verificationStatus,
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
  const payload = {
    records,
    selectedRecordIds: [...input.selectedRecordIds].sort(),
    job: {
      id: input.job.id,
      updatedAt: input.job.updatedAt,
      analysisTimestamp: input.job.analysisTimestamp ?? '',
    },
    settings: {
      summary: input.settings.summary ?? '',
      sectionOrder: input.settings.sectionOrder,
      template: input.settings.template,
      layout: input.settings.layout,
      contactOverrides: input.settings.contactOverrides,
    },
  };
  return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex').slice(0, 32);
}
