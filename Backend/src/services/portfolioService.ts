import {
  normalizeRecordData,
  portfolioRecordInputSchema,
  validateRecordData,
  type PortfolioRecord,
  type PortfolioRecordInput,
  type StructuredRecordCandidate,
} from '../../../shared/schemas';
import { CATEGORY_META, type PortfolioCategory } from '../../../shared/categories';
import type { Repository } from '../repositories';
import { ApiError, zodDetails } from '../utils/errors';
import { newId, nowIso } from '../utils/ids';
import { sanitizeSingleLine, sanitizeText } from '../utils/sanitize';
import { errorSummary, logger } from '../utils/logger';
import { getGeminiService } from './geminiService';

export function deriveTitle(category: PortfolioCategory, data: Record<string, unknown>): string {
  const asString = (key: string) => (typeof data[key] === 'string' ? String(data[key]) : '');
  switch (category) {
    case 'personal_info':
      return asString('fullName') || 'Personal Information';
    case 'summary':
      return asString('headline') || 'Professional Summary';
    case 'education':
      return [asString('degree'), asString('institution')].filter(Boolean).join(' — ') || 'Education';
    case 'technical_skills':
    case 'soft_skills':
    case 'languages':
    case 'competencies':
      return asString('name') || CATEGORY_META[category].singular;
    case 'certifications':
      return asString('name') || 'Certification';
    case 'projects':
      return asString('name') || 'Project';
    case 'experience':
      return [asString('jobTitle'), asString('organization')].filter(Boolean).join(' at ') || 'Experience';
    case 'achievements':
      return asString('title') || 'Achievement';
    case 'publications':
      return asString('title') || 'Publication';
    case 'extracurriculars':
      return [asString('role'), asString('organization')].filter(Boolean).join(' — ') || 'Activity';
  }
  return 'Portfolio record';
}

function cleanTags(tags: string[] | undefined): string[] {
  return Array.from(
    new Set(
      (tags ?? [])
        .map((tag) => sanitizeSingleLine(tag, 60))
        .filter(Boolean),
    ),
  ).slice(0, 20);
}

export class PortfolioService {
  constructor(private readonly repo: Repository) {}

  async list(uid: string): Promise<PortfolioRecord[]> {
    return this.repo.listPortfolio(uid);
  }

  async get(uid: string, id: string): Promise<PortfolioRecord> {
    const record = await this.repo.getPortfolio(uid, id);
    if (!record) throw ApiError.notFound('Portfolio record not found.');
    return record;
  }

  async create(uid: string, input: PortfolioRecordInput): Promise<PortfolioRecord> {
    const parsed = portfolioRecordInputSchema.parse(input);
    const data = normalizeRecordData(parsed.category, parsed.data);
    const validation = validateRecordData(parsed.category, data);
    if (!validation.success) {
      throw ApiError.badRequest('Some fields are missing or invalid.', zodDetails(validation.error));
    }

    if (CATEGORY_META[parsed.category].singleton) {
      const existing = (await this.repo.listPortfolio(uid)).find(
        (record) => record.category === parsed.category,
      );
      if (existing) {
        throw ApiError.conflict(
          `${CATEGORY_META[parsed.category].label} already exists. Edit the existing entry instead of adding a second one.`,
        );
      }
    }

    const timestamp = nowIso();
    const record: PortfolioRecord = {
      id: newId('rec_'),
      category: parsed.category,
      title: sanitizeSingleLine(parsed.title || deriveTitle(parsed.category, data), 200),
      data: validation.data as Record<string, unknown>,
      tags: cleanTags(parsed.tags),
      sourceType: parsed.sourceType === 'ai_structured' ? 'ai_structured' : 'manual',
      verificationStatus:
        parsed.verificationStatus === 'needs_review' ? 'needs_review' : 'verified',
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    const saved = await this.repo.createPortfolio(uid, record);
    await this.markPending(uid);
    return saved;
  }

  async update(
    uid: string,
    id: string,
    patch: {
      title?: string;
      data?: Record<string, unknown>;
      tags?: string[];
      verificationStatus?: 'verified' | 'needs_review' | 'unverified';
    },
  ): Promise<PortfolioRecord> {
    const existing = await this.get(uid, id);
    const mergedData = normalizeRecordData(existing.category, {
      ...existing.data,
      ...(patch.data ?? {}),
    });
    const validation = validateRecordData(existing.category, mergedData);
    if (!validation.success) {
      throw ApiError.badRequest('Some fields are missing or invalid.', zodDetails(validation.error));
    }

    const updated: PortfolioRecord = {
      ...existing,
      title: patch.title
        ? sanitizeSingleLine(patch.title, 200)
        : deriveTitle(existing.category, mergedData),
      data: validation.data as Record<string, unknown>,
      tags: patch.tags ? cleanTags(patch.tags) : existing.tags,
      verificationStatus: patch.verificationStatus ?? existing.verificationStatus,
      updatedAt: nowIso(),
    };
    const saved = await this.repo.updatePortfolio(uid, id, updated);
    await this.markPending(uid);
    return saved;
  }

  async remove(uid: string, id: string): Promise<void> {
    await this.get(uid, id);
    await this.repo.deletePortfolio(uid, id);
    await this.markPending(uid);
  }

  async structureText(text: string): Promise<{
    records: StructuredRecordCandidate[];
    notes: string;
    engine: 'gemini';
  }> {
    const service = getGeminiService();
    const result = await service.structurePortfolioText(text);
    const records = result.records.map((candidate) => {
      const normalized = normalizeRecordData(candidate.category, candidate.data);
      const validation = validateRecordData(candidate.category, normalized);
      const issues = validation.success ? [] : zodDetails(validation.error).map((issue) => `${issue.path}: ${issue.message}`);
      return {
        ...candidate,
        title:
          sanitizeSingleLine(candidate.title, 200) ||
          deriveTitle(candidate.category, normalized),
        data: validation.success ? (validation.data as Record<string, unknown>) : normalized,
        sourceExcerpt: sanitizeText(candidate.sourceExcerpt, 1000),
        warnings: [...candidate.warnings, ...issues],
        validationIssues: issues,
      };
    });
    return { records, notes: sanitizeText(result.notes, 1000), engine: 'gemini' };
  }

  async confirmImport(
    uid: string,
    records: Array<{
      category: PortfolioCategory;
      title: string;
      data: Record<string, unknown>;
      tags: string[];
    }>,
  ): Promise<{ created: PortfolioRecord[]; skipped: Array<{ title: string; reason: string }> }> {
    const created: PortfolioRecord[] = [];
    const skipped: Array<{ title: string; reason: string }> = [];

    for (const candidate of records) {
      const data = normalizeRecordData(candidate.category, candidate.data);
      const validation = validateRecordData(candidate.category, data);
      if (!validation.success) {
        skipped.push({
          title: candidate.title || CATEGORY_META[candidate.category].singular,
          reason: `Invalid data: ${zodDetails(validation.error)
            .map((issue) => `${issue.path} ${issue.message}`)
            .join('; ')}`,
        });
        continue;
      }

      if (CATEGORY_META[candidate.category].singleton) {
        const existing = (await this.repo.listPortfolio(uid)).find(
          (record) => record.category === candidate.category,
        );
        if (existing) {
          skipped.push({
            title: candidate.title || CATEGORY_META[candidate.category].label,
            reason: 'This single-entry category already exists. Edit the existing entry to avoid overwriting data.',
          });
          continue;
        }
      }

      const timestamp = nowIso();
      const record: PortfolioRecord = {
        id: newId('rec_'),
        category: candidate.category,
        title: sanitizeSingleLine(candidate.title, 200) || deriveTitle(candidate.category, data),
        data: validation.data as Record<string, unknown>,
        tags: cleanTags(candidate.tags),
        sourceType: 'ai_structured',
        verificationStatus: 'verified',
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      created.push(await this.repo.createPortfolio(uid, record));
    }

    if (created.length > 0) await this.markPending(uid);
    return { created, skipped };
  }

  async markPending(uid: string): Promise<void> {
    try {
      await this.repo.markPortfolioChanged(uid);
    } catch (error) {
      // Never lose a portfolio write because the sync bookkeeping failed.
      logger.warn('Could not mark Google Sheets data as pending', { error: errorSummary(error) });
    }
  }
}
