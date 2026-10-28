import {
  jobDescriptionInputSchema,
  type JDAnalysis,
  type JobDescription,
  type JobDescriptionInput,
} from '../../../shared/schemas';
import type { Repository } from '../repositories';
import { ApiError } from '../utils/errors';
import { newId, nowIso } from '../utils/ids';
import { sanitizeSingleLine, sanitizeText } from '../utils/sanitize';
import { errorSummary, logger } from '../utils/logger';
import { getGeminiService } from './geminiService';
import { heuristicAnalyzeJobDescription } from './heuristicJd';

export class JobDescriptionService {
  constructor(private readonly repo: Repository) {}

  async list(uid: string): Promise<JobDescription[]> {
    return this.repo.listJobDescriptions(uid);
  }

  async get(uid: string, id: string): Promise<JobDescription> {
    const job = await this.repo.getJobDescription(uid, id);
    if (!job) throw ApiError.notFound('Job description not found.');
    return job;
  }

  async create(uid: string, input: JobDescriptionInput): Promise<JobDescription> {
    const parsed = jobDescriptionInputSchema.parse(input);
    const timestamp = nowIso();
    const job: JobDescription = {
      id: newId('jd_'),
      jobTitle: sanitizeSingleLine(parsed.jobTitle, 200),
      company: sanitizeSingleLine(parsed.company ?? '', 200),
      ...(parsed.jobUrl ? { jobUrl: sanitizeSingleLine(parsed.jobUrl, 400) } : {}),
      rawText: sanitizeText(parsed.rawText, 30000),
      schemaVersion: 1,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    return this.repo.createJobDescription(uid, job);
  }

  async update(uid: string, id: string, input: JobDescriptionInput): Promise<JobDescription> {
    const existing = await this.get(uid, id);
    const parsed = jobDescriptionInputSchema.parse(input);
    const textChanged = sanitizeText(parsed.rawText, 30000) !== existing.rawText;
    const updated: JobDescription = {
      ...existing,
      jobTitle: sanitizeSingleLine(parsed.jobTitle, 200),
      company: sanitizeSingleLine(parsed.company ?? '', 200),
      ...(parsed.jobUrl ? { jobUrl: sanitizeSingleLine(parsed.jobUrl, 400) } : { jobUrl: undefined }),
      rawText: sanitizeText(parsed.rawText, 30000),
      // Editing the raw text invalidates the previous extraction.
      ...(textChanged
        ? { analysis: undefined, analysisTimestamp: undefined, analysisEngine: undefined }
        : {}),
      updatedAt: nowIso(),
    };
    return this.repo.updateJobDescription(uid, id, updated);
  }

  async remove(uid: string, id: string): Promise<void> {
    await this.get(uid, id);
    await this.repo.deleteJobDescription(uid, id);
  }

  /**
   * Gemini analysis with a transparent deterministic fallback. The returned
   * warning makes it explicit when AI was unavailable so the UI never pretends
   * a heuristic result came from Gemini.
   */
  async analyze(
    uid: string,
    id: string,
  ): Promise<{ job: JobDescription; warning?: string }> {
    const existing = await this.get(uid, id);
    const gemini = getGeminiService();
    let analysis: JDAnalysis;
    let engine: 'gemini' | 'heuristic';
    let warning: string | undefined;

    if (gemini.configured) {
      try {
        analysis = await gemini.analyzeJobDescription({
          rawText: existing.rawText,
          jobTitle: existing.jobTitle,
          company: existing.company,
        });
        engine = 'gemini';
      } catch (error) {
        logger.warn('Gemini JD analysis failed; using deterministic extractor', {
          jobDescriptionId: id,
          error: errorSummary(error),
        });
        analysis = heuristicAnalyzeJobDescription({
          rawText: existing.rawText,
          jobTitle: existing.jobTitle,
          company: existing.company,
        });
        engine = 'heuristic';
        warning =
          'Gemini analysis was unavailable, so this result was produced by the local deterministic extractor. Re-run the analysis when the AI service is available.';
      }
    } else {
      analysis = heuristicAnalyzeJobDescription({
        rawText: existing.rawText,
        jobTitle: existing.jobTitle,
        company: existing.company,
      });
      engine = 'heuristic';
      warning =
        'Gemini is not configured. This analysis was produced locally from the job description text using deterministic keyword and context rules.';
    }

    const updated: JobDescription = {
      ...existing,
      analysis,
      analysisTimestamp: nowIso(),
      analysisEngine: engine,
      updatedAt: nowIso(),
    };
    const job = await this.repo.updateJobDescription(uid, id, updated);
    return { job, ...(warning ? { warning } : {}) };
  }
}
