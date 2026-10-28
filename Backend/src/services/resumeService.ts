import {
  DEFAULT_SECTION_ORDER,
  type GenerateResumeRequest,
  type ImprovementSuggestion,
  type JobDescription,
  type PortfolioRecord,
  type ResumeDocument,
  type ResumeSettings,
  type SavedResume,
  type UserProfile,
} from '../../../shared/schemas';
import { z } from 'zod';
import type { Repository } from '../repositories';
import { ApiError } from '../utils/errors';
import { newId, nowIso } from '../utils/ids';
import { ensureHttpUrl, isSafeHttpUrl, sanitizeSingleLine, sanitizeText } from '../utils/sanitize';
import { errorSummary, logger } from '../utils/logger';
import { resumeFingerprint } from '../utils/fingerprint';
import { getGeminiService } from './geminiService';
import { JobDescriptionService } from './jobDescriptionService';
import { MatchingService } from './matchingService';
import {
  assembleResume,
  deterministicSummary,
  resumeDocumentToText,
  validateSummaryGrounding,
} from './resumeAssembler';
import { renderResumePdf, resumeFilename } from './pdfService';

type Data = Record<string, unknown>;

function dataString(record: PortfolioRecord | undefined, key: string): string {
  if (!record) return '';
  const value = (record.data as Data)[key];
  return typeof value === 'string' ? sanitizeSingleLine(value, 400) : '';
}

function summaryRecord(records: PortfolioRecord[]): PortfolioRecord | undefined {
  return records.find((record) => record.category === 'summary');
}

export class ResumeService {
  private readonly matching: MatchingService;

  constructor(
    private readonly repo: Repository,
    private readonly jobs: JobDescriptionService,
  ) {
    this.matching = new MatchingService(repo, jobs);
  }

  async match(uid: string, jobDescriptionId: string, useAi: boolean) {
    return this.matching.match(uid, jobDescriptionId, useAi);
  }

  private async loadContext(
    uid: string,
    jobDescriptionId: string,
    selectedRecordIds: string[],
    options: { requireAnalysis: boolean },
  ): Promise<{ job: JobDescription; all: PortfolioRecord[]; selected: PortfolioRecord[] }> {
    const job = await this.jobs.get(uid, jobDescriptionId);
    if (options.requireAnalysis && !job.analysis) {
      throw ApiError.badRequest('Analyse this job description before generating a resume.');
    }

    const all = await this.repo.listPortfolio(uid);
    const byId = new Map(all.map((record) => [record.id, record]));
    const uniqueIds = Array.from(new Set(selectedRecordIds));
    const missing = uniqueIds.filter((id) => !byId.has(id));
    if (missing.length > 0) {
      throw ApiError.badRequest(
        `${missing.length} selected portfolio record(s) no longer exist. Refresh your selection.`,
      );
    }
    const selected = uniqueIds.map((id) => byId.get(id)!);
    const unverified = selected.filter((record) => record.verificationStatus !== 'verified');
    if (unverified.length > 0) {
      throw ApiError.badRequest(
        `Only verified records can appear in a resume. Mark these records as verified first: ${unverified
          .map((record) => record.title)
          .slice(0, 5)
          .join(', ')}.`,
      );
    }
    if (selected.length === 0) {
      throw ApiError.badRequest('Select at least one verified portfolio record.');
    }
    return { job, all, selected };
  }

  private buildContact(
    personal: PortfolioRecord | undefined,
    settings: ResumeSettings,
  ): { name: string; headline: string; contact: ResumeDocument['contact'] } {
    const overrides = settings.contactOverrides;
    const name = sanitizeSingleLine(
      overrides.fullName || dataString(personal, 'fullName'),
      160,
    );
    const headline = sanitizeSingleLine(
      overrides.headline || dataString(personal, 'headline'),
      200,
    );
    const email = sanitizeSingleLine(overrides.email || dataString(personal, 'email'), 200);
    const phone = sanitizeSingleLine(overrides.phone || dataString(personal, 'phone'), 60);
    const location = sanitizeSingleLine(
      overrides.location || dataString(personal, 'location'),
      160,
    );

    const links: ResumeDocument['contact']['links'] = [];
    const linkFields: Array<[string, string]> = [
      ['linkedinUrl', 'LinkedIn'],
      ['githubUrl', 'GitHub'],
      ['portfolioUrl', 'Portfolio'],
    ];
    for (const [key, label] of linkFields) {
      const raw =
        (overrides as Record<string, string | undefined>)[key] || dataString(personal, key);
      if (!raw) continue;
      const url = ensureHttpUrl(raw);
      if (isSafeHttpUrl(url)) links.push({ label, url: url.slice(0, 400) });
    }

    return { name, headline, contact: { email, phone, location, links } };
  }

  private async resolveSummary(input: {
    settings: ResumeSettings;
    selected: PortfolioRecord[];
    job: JobDescription;
    headline: string;
    useAiSummary: boolean;
  }): Promise<{ summary: string; engine: 'deterministic' | 'gemini-assisted'; warnings: string[] }> {
    const warnings: string[] = [];
    let summary = sanitizeText(input.settings.summary ?? '', 1500);
    const summarySource = summaryRecord(input.selected);
    if (!summary && summarySource) {
      summary = sanitizeText(String((summarySource.data as Data).summaryText ?? ''), 1500);
    }

    if (!input.useAiSummary) {
      if (!summary) {
        summary = deterministicSummary({
          records: input.selected,
          job: input.job,
          headline: input.headline,
        });
      }
      return { summary, engine: 'deterministic', warnings };
    }

    const gemini = getGeminiService();
    if (!gemini.configured) {
      warnings.push('AI summary was requested but Gemini is not configured. A deterministic summary was used.');
    } else {
      try {
        const ai = await gemini.generateProfessionalSummary({
          jobTitle: input.job.jobTitle,
          analysis: input.job.analysis!,
          records: input.selected.filter((record) => record.category !== 'personal_info'),
          currentSummary: summary,
        });
        const grounding = validateSummaryGrounding(ai.summary, input.selected);
        if (grounding.ok) {
          const invalidIds = ai.sourceRecordIds.filter(
            (id) => !input.selected.some((record) => record.id === id),
          );
          if (invalidIds.length > 0) {
            warnings.push('AI summary referenced records outside your selection, so it was discarded.');
          } else {
            summary = sanitizeText(ai.summary, 1500);
            return { summary, engine: 'gemini-assisted', warnings };
          }
        } else {
          warnings.push(`${grounding.reason} The deterministic summary was used instead.`);
        }
      } catch (error) {
        logger.warn('AI summary generation failed', { error: errorSummary(error) });
        warnings.push('AI summary generation was unavailable. A deterministic summary was used.');
      }
    }

    if (!summary) {
      summary = deterministicSummary({
        records: input.selected,
        job: input.job,
        headline: input.headline,
      });
    }
    return { summary, engine: 'deterministic', warnings };
  }

  async generate(
    uid: string,
    input: GenerateResumeRequest,
  ): Promise<{
    document: ResumeDocument;
    generationVersion: string;
    portfolioFingerprint: string;
    jobTitle: string;
    company: string;
  }> {
    const { job, all, selected } = await this.loadContext(
      uid,
      input.jobDescriptionId,
      input.selectedRecordIds,
      { requireAnalysis: true },
    );

    const personal = all.find((record) => record.category === 'personal_info');
    const contact = this.buildContact(personal, input.settings);
    if (!contact.name) {
      throw ApiError.badRequest('Add your full name in Personal Information (or a contact override) before generating a resume.');
    }
    if (!contact.contact.email) {
      throw ApiError.badRequest('A professional email is required on the resume. Add it in Personal Information.');
    }

    const summaryResult = await this.resolveSummary({
      settings: input.settings,
      selected,
      job,
      headline: contact.headline,
      useAiSummary: input.useAiSummary,
    });

    const document = assembleResume({
      records: selected,
      job,
      settings: input.settings,
      summary: summaryResult.summary,
      headline: contact.headline,
      name: contact.name,
      contact: contact.contact,
      engine: summaryResult.engine,
      warnings: summaryResult.warnings,
    });

    const fingerprint = resumeFingerprint({
      records: selected,
      job,
      settings: input.settings,
      selectedRecordIds: input.selectedRecordIds,
    });

    return {
      document,
      generationVersion: newId('gen_'),
      portfolioFingerprint: fingerprint,
      jobTitle: job.jobTitle,
      company: job.company,
    };
  }

  async renderPreviewPdf(uid: string, input: GenerateResumeRequest): Promise<{ buffer: Buffer; filename: string }> {
    // AI rewriting is not invoked for PDF rendering: the approved summary is
    // supplied in settings.summary, and assembly is deterministic.
    const result = await this.generate(uid, { ...input, useAiSummary: false });
    const buffer = await renderResumePdf(result.document);
    return { buffer, filename: resumeFilename(result.document, result.jobTitle) };
  }

  async save(
    uid: string,
    input: {
      title: string;
      jobDescriptionId: string;
      selectedRecordIds: string[];
      settings: ResumeSettings;
      aiAssisted: boolean;
    },
  ): Promise<SavedResume> {
    const generated = await this.generate(uid, {
      jobDescriptionId: input.jobDescriptionId,
      selectedRecordIds: input.selectedRecordIds,
      settings: input.settings,
      useAiSummary: false,
    });
    const timestamp = nowIso();
    const resume: SavedResume = {
      id: newId('resume_'),
      title: sanitizeSingleLine(input.title, 200),
      jobDescriptionId: input.jobDescriptionId,
      jobTitle: generated.jobTitle,
      company: generated.company,
      selectedRecordIds: Array.from(new Set(input.selectedRecordIds)),
      settings: input.settings,
      document: generated.document,
      generationVersion: generated.generationVersion,
      portfolioFingerprint: generated.portfolioFingerprint,
      aiAssisted: input.aiAssisted,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    return this.repo.createResume(uid, resume);
  }

  async list(uid: string): Promise<SavedResume[]> {
    const [resumes, records, jobs] = await Promise.all([
      this.repo.listResumes(uid),
      this.repo.listPortfolio(uid),
      this.repo.listJobDescriptions(uid),
    ]);
    const recordById = new Map(records.map((record) => [record.id, record]));
    const jobById = new Map(jobs.map((job) => [job.id, job]));
    return resumes.map((resume) => ({
      ...resume,
      outdated: this.isOutdated(resume, recordById, jobById),
    }));
  }

  async get(uid: string, id: string): Promise<SavedResume> {
    const resume = await this.repo.getResume(uid, id);
    if (!resume) throw ApiError.notFound('Saved resume not found.');
    const [records, jobs] = await Promise.all([
      this.repo.listPortfolio(uid),
      this.repo.listJobDescriptions(uid),
    ]);
    const recordById = new Map(records.map((record) => [record.id, record]));
    const jobById = new Map(jobs.map((job) => [job.id, job]));
    return { ...resume, outdated: this.isOutdated(resume, recordById, jobById) };
  }

  private isOutdated(
    resume: SavedResume,
    recordById: Map<string, PortfolioRecord>,
    jobById: Map<string, JobDescription>,
  ): boolean {
    const job = jobById.get(resume.jobDescriptionId);
    if (!job) return true;
    const selectedRecords = resume.selectedRecordIds
      .map((id) => recordById.get(id))
      .filter((record): record is PortfolioRecord => Boolean(record));
    if (selectedRecords.length !== resume.selectedRecordIds.length) return true;
    const fingerprint = resumeFingerprint({
      records: selectedRecords,
      job,
      settings: resume.settings,
      selectedRecordIds: resume.selectedRecordIds,
    });
    return fingerprint !== resume.portfolioFingerprint;
  }

  async rename(uid: string, id: string, title: string): Promise<SavedResume> {
    const existing = await this.get(uid, id);
    const updated: SavedResume = {
      ...existing,
      title: sanitizeSingleLine(title, 200),
      updatedAt: nowIso(),
    };
    return this.repo.updateResume(uid, id, updated);
  }

  async remove(uid: string, id: string): Promise<void> {
    await this.get(uid, id);
    await this.repo.deleteResume(uid, id);
  }

  async renderSavedPdf(uid: string, id: string): Promise<{ buffer: Buffer; filename: string }> {
    const resume = await this.get(uid, id);
    const buffer = await renderResumePdf(resume.document);
    return { buffer, filename: resumeFilename(resume.document, resume.jobTitle) };
  }

  async suggest(uid: string, input: { jobDescriptionId: string; selectedRecordIds: string[]; summary?: string }) {
    const { job, selected } = await this.loadContext(uid, input.jobDescriptionId, input.selectedRecordIds, {
      requireAnalysis: true,
    });
    const match = await this.matching.match(uid, input.jobDescriptionId, false);
    const suggestions: ImprovementSuggestion[] = [];
    const seen = new Set<string>();

    const add = (suggestion: ImprovementSuggestion) => {
      const key = `${suggestion.type}:${suggestion.message.slice(0, 80)}`;
      if (seen.has(key)) return;
      seen.add(key);
      suggestions.push(suggestion);
    };

    for (const missing of match.missingRequirements.slice(0, 10)) {
      add({
        type: 'missing_skill',
        message: `No verified evidence supports "${missing}". Add it only if you can verify it; do not add it just because the employer asks.`,
        relatedRecordIds: [],
        relatedRequirement: missing,
      });
    }

    for (const record of selected) {
      const data = record.data as Data;
      if (record.category === 'projects') {
        const description = String(data.description ?? '');
        const achievements = Array.isArray(data.achievements) ? data.achievements : [];
        const metrics = Array.isArray(data.metrics) ? data.metrics : [];
        if (description.length > 0 && description.length < 90) {
          add({
            type: 'weak_description',
            message: `The description for "${record.title}" is very short. Add context about the problem, your role and the outcome — using facts you can verify.`,
            relatedRecordIds: [record.id],
          });
        }
        if (achievements.length === 0 && metrics.length === 0) {
          add({
            type: 'missing_metric',
            message: `"${record.title}" has no recorded result or metric. If a measurable outcome exists (accuracy, latency, users), add it to the portfolio; do not invent one.`,
            relatedRecordIds: [record.id],
          });
        }
      }
      if (record.category === 'experience' && !Array.isArray(data.metrics)) {
        add({
          type: 'missing_metric',
          message: `The experience at "${dataString(record, 'organization') || record.title}" has no verified metrics. Add measured outcomes only if you can support them.`,
          relatedRecordIds: [record.id],
        });
      }
    }

    const matchedRecordIds = new Set(match.matches.flatMap((item) => item.recordIds));
    for (const record of selected) {
      if (
        ['certifications', 'publications', 'extracurriculars'].includes(record.category) &&
        !matchedRecordIds.has(record.id)
      ) {
        add({
          type: 'irrelevant_section',
          message: `"${record.title}" is not connected to any analysed requirement. Consider whether it adds value for this specific role.`,
          relatedRecordIds: [record.id],
        });
      }
    }

    for (const item of match.matches) {
      if (item.requirementType === 'required_skill' && item.status === 'partial') {
        add({
          type: 'missing_evidence',
          message: `"${item.requirement}" is only partially evidenced. Strengthen the relevant project or experience entry with concrete, verifiable detail.`,
          relatedRecordIds: item.recordIds,
          relatedRequirement: item.requirement,
        });
      }
    }

    let disclaimer =
      'These are suggestions only. They are not verified facts and adding them to your portfolio requires your explicit review.';

    const gemini = getGeminiService();
    if (gemini.configured) {
      try {
        const resumeText = resumeDocumentToText(
          assembleResume({
            records: selected,
            job,
            settings: {
              summary: input.summary,
              sectionOrder: DEFAULT_SECTION_ORDER,
              template: 'classic',
              layout: 'one_page',
              contactOverrides: {},
            },
            summary: input.summary ?? '',
            headline: '',
            name: '',
            contact: { email: '', phone: '', location: '', links: [] },
            engine: 'deterministic',
            warnings: [],
          }),
        );
        const ai = await gemini.suggestResumeImprovements({
          analysis: job.analysis!,
          missingRequirements: match.missingRequirements,
          selectedRecords: selected,
          resumeText,
        });
        for (const suggestion of ai.suggestions) add(suggestion);
        disclaimer = ai.disclaimer || disclaimer;
      } catch (error) {
        logger.warn('AI suggestions unavailable', { error: errorSummary(error) });
      }
    }

    return { suggestions: suggestions.slice(0, 30), disclaimer, engine: gemini.configured ? 'gemini+heuristic' : 'heuristic' };
  }
}

export const resumeTitleSchema = z.object({ title: z.string().trim().min(1).max(200) });
