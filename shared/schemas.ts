import { z } from 'zod';
import {
  CATEGORY_META,
  PORTFOLIO_CATEGORIES,
  type PortfolioCategory,
} from './categories';

/* ------------------------------------------------------------------ */
/* Shared primitives                                                   */
/* ------------------------------------------------------------------ */

const trimmed = (max: number) => z.string().trim().max(max);
const optionalText = (max: number) => z.string().trim().max(max).optional();
const optionalDate = () => z.string().trim().max(40).optional();
const stringList = (maxItems = 40, maxLength = 400) =>
  z.array(z.string().trim().max(maxLength)).max(maxItems).default([]);

/** Accepts absolute URLs and common protocol-less links such as linkedin.com/in/x. */
export const looseUrlSchema = z
  .string()
  .trim()
  .max(400)
  .refine(
    (value) =>
      /^https?:\/\/[^\s]+$/i.test(value) ||
      /^[\w.-]+\.[a-z]{2,}(\/[^\s]*)?$/i.test(value),
    'Enter a valid URL (https://example.com)',
  );

const optionalUrl = () => looseUrlSchema.optional();
const optionalNumber = () =>
  z
    .union([z.number(), z.string()])
    .optional()
    .transform((value) => {
      if (value === undefined || value === '') return undefined;
      const parsed = typeof value === 'number' ? value : Number(value);
      return Number.isFinite(parsed) ? parsed : undefined;
    })
    .pipe(z.number().min(0).max(60).optional());

export const sourceTypeSchema = z.enum(['manual', 'ai_structured', 'seed', 'sheets_import']);
export type SourceType = z.infer<typeof sourceTypeSchema>;

export const verificationStatusSchema = z.enum(['verified', 'needs_review', 'unverified']);
export type VerificationStatus = z.infer<typeof verificationStatusSchema>;

/* ------------------------------------------------------------------ */
/* Per-category portfolio data schemas                                 */
/* ------------------------------------------------------------------ */

export const personalInfoDataSchema = z.object({
  fullName: trimmed(120).min(2),
  headline: optionalText(160),
  email: z.string().trim().email().max(160),
  phone: optionalText(40),
  location: optionalText(120),
  linkedinUrl: optionalUrl(),
  githubUrl: optionalUrl(),
  portfolioUrl: optionalUrl(),
});

export const summaryDataSchema = z.object({
  headline: trimmed(160).min(2),
  summaryText: trimmed(2000).min(10),
  careerObjective: optionalText(1000),
  preferredRoles: stringList(20, 100),
});

export const educationDataSchema = z.object({
  institution: trimmed(200).min(1),
  degree: trimmed(160).min(1),
  fieldOfStudy: optionalText(160),
  startDate: optionalDate(),
  endDate: optionalDate(),
  grade: optionalText(60),
  coursework: stringList(30, 120),
  description: optionalText(1200),
});

export const technicalSkillDataSchema = z.object({
  name: trimmed(100).min(1),
  category: optionalText(80),
  proficiency: optionalText(40),
  yearsExperience: optionalNumber(),
  evidence: stringList(20, 300),
  relatedProjects: stringList(20, 160),
});

export const softSkillDataSchema = z.object({
  name: trimmed(100).min(1),
  evidence: optionalText(600),
});

export const certificationDataSchema = z.object({
  name: trimmed(200).min(1),
  issuer: trimmed(160).min(1),
  issueDate: optionalDate(),
  expiryDate: optionalDate(),
  credentialId: optionalText(120),
  credentialUrl: optionalUrl(),
  description: optionalText(800),
});

export const projectDataSchema = z.object({
  name: trimmed(200).min(1),
  role: optionalText(120),
  description: trimmed(2000).min(10),
  problemSolved: optionalText(1000),
  technologies: stringList(30, 80),
  responsibilities: stringList(20, 400),
  achievements: stringList(20, 400),
  metrics: stringList(20, 200),
  startDate: optionalDate(),
  endDate: optionalDate(),
  repoUrl: optionalUrl(),
  demoUrl: optionalUrl(),
});

export const experienceDataSchema = z.object({
  organization: trimmed(200).min(1),
  jobTitle: trimmed(160).min(1),
  employmentType: optionalText(60),
  location: optionalText(120),
  startDate: optionalDate(),
  endDate: optionalDate(),
  current: z
    .union([z.boolean(), z.enum(['yes', 'no', 'true', 'false'])])
    .optional()
    .transform((value) => value === true || value === 'yes' || value === 'true'),
  responsibilities: stringList(20, 400),
  achievements: stringList(20, 400),
  technologies: stringList(30, 80),
  metrics: stringList(20, 200),
});

export const achievementDataSchema = z.object({
  title: trimmed(200).min(1),
  organization: optionalText(160),
  date: optionalDate(),
  description: optionalText(1000),
  metric: optionalText(120),
});

export const publicationDataSchema = z.object({
  title: trimmed(300).min(1),
  authors: stringList(20, 160),
  venue: optionalText(200),
  date: optionalDate(),
  doi: optionalText(120),
  url: optionalUrl(),
  description: optionalText(1200),
});

export const extracurricularDataSchema = z.object({
  role: trimmed(160).min(1),
  organization: trimmed(200).min(1),
  startDate: optionalDate(),
  endDate: optionalDate(),
  description: optionalText(1000),
});

export const languageDataSchema = z.object({
  name: trimmed(80).min(1),
  proficiency: optionalText(60),
  testScore: optionalText(80),
});

export const competencyDataSchema = z.object({
  name: trimmed(120).min(1),
  description: optionalText(600),
  level: optionalText(60),
});

export const PORTFOLIO_DATA_SCHEMAS = {
  personal_info: personalInfoDataSchema,
  summary: summaryDataSchema,
  education: educationDataSchema,
  technical_skills: technicalSkillDataSchema,
  soft_skills: softSkillDataSchema,
  certifications: certificationDataSchema,
  projects: projectDataSchema,
  experience: experienceDataSchema,
  achievements: achievementDataSchema,
  publications: publicationDataSchema,
  extracurriculars: extracurricularDataSchema,
  languages: languageDataSchema,
  competencies: competencyDataSchema,
} satisfies Record<PortfolioCategory, z.ZodTypeAny>;

export type PersonalInfoData = z.infer<typeof personalInfoDataSchema>;
export type SummaryData = z.infer<typeof summaryDataSchema>;
export type EducationData = z.infer<typeof educationDataSchema>;
export type TechnicalSkillData = z.infer<typeof technicalSkillDataSchema>;
export type CertificationData = z.infer<typeof certificationDataSchema>;
export type ProjectData = z.infer<typeof projectDataSchema>;
export type ExperienceData = z.infer<typeof experienceDataSchema>;
export type AchievementData = z.infer<typeof achievementDataSchema>;
export type PublicationData = z.infer<typeof publicationDataSchema>;

/**
 * Converts free-form form/AI values into the canonical storage shape:
 * trims strings, drops empty values, splits comma/newline strings for list
 * fields, coerces numbers, and discards unknown keys.
 */
export function normalizeRecordData(
  category: PortfolioCategory,
  input: Record<string, unknown>,
): Record<string, unknown> {
  const fields = CATEGORY_META[category].fields;
  const output: Record<string, unknown> = {};

  for (const field of fields) {
    let value = input[field.key];
    if (value === undefined || value === null) continue;

    if (typeof value === 'string') {
      value = value.trim();
      if (value === '') continue;
    }

    if (field.type === 'list') {
      if (typeof value === 'string') {
        value = value
          .split(/[,;\n]/)
          .map((item) => item.trim())
          .filter(Boolean);
      }
      if (Array.isArray(value)) {
        const list = value
          .map((item) => (typeof item === 'string' ? item.trim() : String(item ?? '').trim()))
          .filter(Boolean);
        if (list.length === 0) continue;
        value = list;
      }
    }

    if (field.type === 'number' && typeof value === 'string') {
      const parsed = Number(value);
      if (!Number.isFinite(parsed)) continue;
      value = parsed;
    }

    if (field.type === 'boolean') {
      value = value === true || value === 'true' || value === 'yes';
    }

    output[field.key] = value;
  }

  return output;
}

export function validateRecordData(
  category: PortfolioCategory,
  data: Record<string, unknown>,
) {
  return PORTFOLIO_DATA_SCHEMAS[category].safeParse(normalizeRecordData(category, data));
}

/* ------------------------------------------------------------------ */
/* Portfolio records                                                   */
/* ------------------------------------------------------------------ */

export const portfolioRecordInputSchema = z.object({
  category: z.enum(PORTFOLIO_CATEGORIES),
  title: trimmed(200).min(1, 'A title is required'),
  data: z.record(z.string(), z.unknown()),
  tags: stringList(20, 60),
  sourceType: sourceTypeSchema.default('manual'),
  verificationStatus: verificationStatusSchema.default('verified'),
});
export type PortfolioRecordInput = z.infer<typeof portfolioRecordInputSchema>;

export const portfolioRecordSchema = portfolioRecordInputSchema.extend({
  id: z.string().min(1),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type PortfolioRecord = z.infer<typeof portfolioRecordSchema>;

export const portfolioRecordPatchSchema = z
  .object({
    title: trimmed(200).min(1).optional(),
    data: z.record(z.string(), z.unknown()).optional(),
    tags: z.array(z.string().trim().max(60)).max(20).optional(),
    verificationStatus: verificationStatusSchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, 'Nothing to update');

/* ------------------------------------------------------------------ */
/* Users                                                               */
/* ------------------------------------------------------------------ */

export const userProfileSchema = z.object({
  uid: z.string(),
  email: z.string().email(),
  displayName: z.string().max(160),
  createdAt: z.string(),
  lastLoginAt: z.string(),
  authMode: z.enum(['firebase', 'demo']),
});
export type UserProfile = z.infer<typeof userProfileSchema>;

/* ------------------------------------------------------------------ */
/* Job descriptions + AI analysis                                      */
/* ------------------------------------------------------------------ */

export const jobDescriptionInputSchema = z.object({
  jobTitle: trimmed(200).min(2, 'Job title is required'),
  company: optionalText(200),
  jobUrl: optionalUrl(),
  rawText: trimmed(30000).min(40, 'Paste at least a few sentences from the job description'),
});
export type JobDescriptionInput = z.infer<typeof jobDescriptionInputSchema>;

export const jdAnalysisSchema = z.object({
  jobTitle: trimmed(200).default(''),
  company: trimmed(200).default(''),
  requiredSkills: stringList(40, 120),
  preferredSkills: stringList(40, 120),
  technologies: stringList(40, 120),
  qualifications: stringList(40, 500),
  preferredQualifications: stringList(40, 500),
  experienceRequirements: stringList(20, 300),
  responsibilities: stringList(40, 500),
  keywords: stringList(60, 80),
  relevantProjectTypes: stringList(20, 200),
  requestedCertifications: stringList(20, 200),
});
export type JDAnalysis = z.infer<typeof jdAnalysisSchema>;

export const analysisEngineSchema = z.enum(['gemini', 'heuristic']);

export const jobDescriptionSchema = z.object({
  id: z.string(),
  jobTitle: z.string(),
  company: z.string(),
  jobUrl: z.string().optional(),
  rawText: z.string(),
  analysis: jdAnalysisSchema.optional(),
  analysisTimestamp: z.string().optional(),
  analysisEngine: analysisEngineSchema.optional(),
  schemaVersion: z.literal(1),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type JobDescription = z.infer<typeof jobDescriptionSchema>;

/* ------------------------------------------------------------------ */
/* Matching                                                            */
/* ------------------------------------------------------------------ */

export const requirementTypeSchema = z.enum([
  'required_skill',
  'preferred_skill',
  'qualification',
  'preferred_qualification',
  'responsibility',
  'experience',
  'keyword',
]);
export type RequirementType = z.infer<typeof requirementTypeSchema>;

export const matchStatusSchema = z.enum(['strong', 'partial', 'not_evidenced']);
export type MatchStatus = z.infer<typeof matchStatusSchema>;

export const matchKindSchema = z.enum(['exact', 'related', 'unsupported']);
export type MatchKind = z.infer<typeof matchKindSchema>;

export const matchItemSchema = z.object({
  requirement: z.string(),
  requirementType: requirementTypeSchema,
  status: matchStatusSchema,
  matchKind: matchKindSchema,
  recordIds: z.array(z.string()),
  evidence: z.array(
    z.object({
      recordId: z.string(),
      excerpt: z.string(),
    }),
  ),
  explanation: z.string(),
});
export type MatchItem = z.infer<typeof matchItemSchema>;

export const rankedRecordSchema = z.object({
  recordId: z.string(),
  relevance: z.number().min(0).max(100),
  reason: z.string(),
  matchedRequirements: z.array(z.string()).default([]),
});
export type RankedRecord = z.infer<typeof rankedRecordSchema>;

export const matchResponseSchema = z.object({
  jobDescriptionId: z.string(),
  matches: z.array(matchItemSchema),
  missingRequirements: z.array(z.string()),
  rankedRecords: z.array(rankedRecordSchema),
  engine: z.enum(['gemini+deterministic', 'deterministic']),
  notes: z.string(),
  generatedAt: z.string(),
});
export type MatchResponse = z.infer<typeof matchResponseSchema>;

/** Shape requested from Gemini; the backend intersects record IDs with portfolio ownership. */
export const geminiMatchSchema = z.object({
  matches: z
    .array(
      z.object({
        requirement: z.string().max(500),
        requirementType: requirementTypeSchema,
        recordIds: z.array(z.string()).max(10).default([]),
        status: matchStatusSchema,
        explanation: z.string().max(800).default(''),
      }),
    )
    .max(100)
    .default([]),
});
export type GeminiMatchResult = z.infer<typeof geminiMatchSchema>;

/* ------------------------------------------------------------------ */
/* AI structuring + suggestions                                        */
/* ------------------------------------------------------------------ */

export const structuredRecordCandidateSchema = z.object({
  category: z.enum(PORTFOLIO_CATEGORIES),
  title: z.string().max(200).default(''),
  data: z.record(z.string(), z.unknown()),
  sourceExcerpt: z.string().max(1000).default(''),
  confidence: z.number().min(0).max(1).default(0.5),
  missingInformation: z.array(z.string().max(200)).max(20).default([]),
  warnings: z.array(z.string().max(300)).max(20).default([]),
  validationIssues: z.array(z.string().max(300)).max(20).default([]),
});
export type StructuredRecordCandidate = z.infer<typeof structuredRecordCandidateSchema>;

export const structurePortfolioResponseSchema = z.object({
  records: z.array(structuredRecordCandidateSchema).max(60).default([]),
  notes: z.string().max(1000).default(''),
});
export type StructurePortfolioResponse = z.infer<typeof structurePortfolioResponseSchema>;

export const importPreviewRequestSchema = z.object({
  text: trimmed(20000).min(20, 'Paste some information to structure'),
});
export const importConfirmSchema = z.object({
  records: z
    .array(
      portfolioRecordInputSchema.pick({
        category: true,
        title: true,
        data: true,
        tags: true,
      }),
    )
    .min(1)
    .max(60),
});

export const aiSummaryResponseSchema = z.object({
  summary: z.string().min(40).max(1200),
  sourceRecordIds: z.array(z.string()).default([]),
});
export type AiSummaryResponse = z.infer<typeof aiSummaryResponseSchema>;

export const improvementSuggestionSchema = z.object({
  type: z.enum([
    'missing_skill',
    'weak_description',
    'missing_metric',
    'irrelevant_section',
    'unclear_wording',
    'missing_evidence',
  ]),
  message: z.string().max(600),
  relatedRecordIds: z.array(z.string()).default([]),
  relatedRequirement: z.string().max(300).optional(),
});
export const improvementSuggestionsSchema = z.object({
  suggestions: z.array(improvementSuggestionSchema).max(40).default([]),
  disclaimer: z.string().default(''),
});
export type ImprovementSuggestion = z.infer<typeof improvementSuggestionSchema>;
export type ImprovementSuggestions = z.infer<typeof improvementSuggestionsSchema>;

/* ------------------------------------------------------------------ */
/* Resume                                                              */
/* ------------------------------------------------------------------ */

export const resumeSectionKeySchema = z.enum([
  'summary',
  'skills',
  'experience',
  'projects',
  'education',
  'certifications',
  'achievements',
  'publications',
  'extracurriculars',
  'languages',
  'competencies',
]);
export type ResumeSectionKey = z.infer<typeof resumeSectionKeySchema>;

export const RESUME_SECTION_LABELS: Record<ResumeSectionKey, string> = {
  summary: 'Professional Summary',
  skills: 'Technical Skills',
  experience: 'Experience',
  projects: 'Projects',
  education: 'Education',
  certifications: 'Certifications',
  achievements: 'Achievements',
  publications: 'Publications',
  extracurriculars: 'Activities & Leadership',
  languages: 'Languages',
  competencies: 'Additional Competencies',
};

export const DEFAULT_SECTION_ORDER: ResumeSectionKey[] = [
  'summary',
  'skills',
  'experience',
  'projects',
  'education',
  'certifications',
  'achievements',
  'publications',
  'languages',
  'competencies',
  'extracurriculars',
];

export const resumeTemplateSchema = z.enum(['classic', 'modern', 'compact']);
export type ResumeTemplate = z.infer<typeof resumeTemplateSchema>;

export const resumeLayoutSchema = z.enum(['one_page', 'two_page']);
export type ResumeLayout = z.infer<typeof resumeLayoutSchema>;

export const contactOverridesSchema = z.object({
  fullName: optionalText(120),
  headline: optionalText(160),
  email: z.union([z.string().trim().email().max(160), z.literal('')]).optional(),
  phone: optionalText(40),
  location: optionalText(120),
  linkedinUrl: optionalText(400),
  githubUrl: optionalText(400),
  portfolioUrl: optionalText(400),
});
export type ContactOverrides = z.infer<typeof contactOverridesSchema>;

export const resumeSettingsSchema = z.object({
  summary: trimmed(1500).optional(),
  sectionOrder: z.array(resumeSectionKeySchema).min(1).max(11),
  template: resumeTemplateSchema.default('classic'),
  layout: resumeLayoutSchema.default('one_page'),
  contactOverrides: contactOverridesSchema.default({}),
});
export type ResumeSettings = z.infer<typeof resumeSettingsSchema>;

export const matchRequestSchema = z.object({
  jobDescriptionId: z.string().min(1),
  useAi: z.boolean().default(true),
});

export const generateResumeRequestSchema = z.object({
  jobDescriptionId: z.string().min(1),
  selectedRecordIds: z.array(z.string()).min(1).max(200),
  title: trimmed(200).optional(),
  settings: resumeSettingsSchema,
  useAiSummary: z.boolean().default(false),
});
export type GenerateResumeRequest = z.infer<typeof generateResumeRequestSchema>;

export const saveResumeRequestSchema = z.object({
  title: trimmed(200).min(1),
  jobDescriptionId: z.string().min(1),
  selectedRecordIds: z.array(z.string()).min(1).max(200),
  settings: resumeSettingsSchema,
  aiAssisted: z.boolean().default(false),
});

export const resumePdfRequestSchema = generateResumeRequestSchema;

export const suggestionsRequestSchema = z.object({
  jobDescriptionId: z.string().min(1),
  selectedRecordIds: z.array(z.string()).min(1).max(200),
  summary: trimmed(2000).optional(),
});

export const resumeLinkSchema = z.object({
  label: z.string().max(60),
  url: z.string().max(400),
});

export const resumeItemSchema = z.object({
  recordId: z.string(),
  heading: z.string().max(300).default(''),
  subheading: z.string().max(300).default(''),
  meta: z.string().max(300).default(''),
  bullets: z.array(z.string().max(800)).max(20).default([]),
  links: z.array(resumeLinkSchema).max(6).default([]),
});
export type ResumeItem = z.infer<typeof resumeItemSchema>;

export const resumeDocumentSchema = z.object({
  name: z.string().max(160),
  headline: z.string().max(200),
  contact: z.object({
    email: z.string().max(200).default(''),
    phone: z.string().max(60).default(''),
    location: z.string().max(160).default(''),
    links: z.array(resumeLinkSchema).max(8).default([]),
  }),
  summary: z.string().max(2000).default(''),
  sections: z
    .array(
      z.object({
        key: resumeSectionKeySchema,
        title: z.string().max(100),
        items: z.array(resumeItemSchema),
      }),
    )
    .max(11),
  template: resumeTemplateSchema,
  layout: resumeLayoutSchema,
  generatedAt: z.string(),
  engine: z.enum(['deterministic', 'gemini-assisted']),
  warnings: z.array(z.string().max(400)).max(20).default([]),
});
export type ResumeDocument = z.infer<typeof resumeDocumentSchema>;

export const generateResumeResponseSchema = z.object({
  document: resumeDocumentSchema,
  generationVersion: z.string(),
  portfolioFingerprint: z.string(),
});
export type GenerateResumeResponse = z.infer<typeof generateResumeResponseSchema>;

export const savedResumeSchema = z.object({
  id: z.string(),
  title: z.string(),
  jobDescriptionId: z.string(),
  jobTitle: z.string(),
  company: z.string().default(''),
  selectedRecordIds: z.array(z.string()),
  settings: resumeSettingsSchema,
  document: resumeDocumentSchema,
  generationVersion: z.string(),
  portfolioFingerprint: z.string(),
  aiAssisted: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
  /** Computed on read: portfolio (or JD) changed since this version was saved. */
  outdated: z.boolean().optional(),
});
export type SavedResume = z.infer<typeof savedResumeSchema>;

/* ------------------------------------------------------------------ */
/* Google Sheets                                                       */
/* ------------------------------------------------------------------ */

export const sheetCellSchema = z.union([z.string(), z.number(), z.boolean()]);

export const sheetPreviewSchema = z.object({
  tabs: z.array(
    z.object({
      name: z.string(),
      headers: z.array(z.string()),
      rows: z.array(z.array(sheetCellSchema)),
      recordIds: z.array(z.string()),
    }),
  ),
  generatedAt: z.string(),
  recordCount: z.number(),
});
export type SheetPreview = z.infer<typeof sheetPreviewSchema>;

export const integrationStatusSchema = z.object({
  configured: z.boolean(),
  spreadsheetId: z.string().optional(),
  spreadsheetIdMasked: z.string().optional(),
  spreadsheetUrl: z.string().optional(),
  autoSync: z.boolean(),
  status: z.enum(['never_synced', 'synced', 'pending', 'error']),
  lastSyncAt: z.string().optional(),
  lastError: z.string().optional(),
  pendingChanges: z.number().default(0),
  missingCredentials: z.array(z.string()).default([]),
});
export type IntegrationStatus = z.infer<typeof integrationStatusSchema>;

export const importProposalSchema = z.object({
  recordId: z.string(),
  category: z.enum(PORTFOLIO_CATEGORIES).optional(),
  title: z.string().default(''),
  action: z.enum(['new', 'update', 'conflict', 'unchanged', 'invalid']),
  sheetUpdatedAt: z.string().optional(),
  firestoreUpdatedAt: z.string().optional(),
  data: z.record(z.string(), z.unknown()),
  issues: z.array(z.string()).default([]),
});
export type ImportProposal = z.infer<typeof importProposalSchema>;

/* ------------------------------------------------------------------ */
/* API helpers                                                         */
/* ------------------------------------------------------------------ */

export const idParamSchema = z.object({ id: z.string().min(1) });

export const paginationSchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(50),
});

/** Strictness guard used before saving AI-generated resume text. */
export function containsUnsupportedNumericClaim(
  generatedText: string,
  sourceText: string,
): string[] {
  const numbers = generatedText.match(/\b\d+(?:\.\d+)?%?\b/g) ?? [];
  const source = sourceText.toLowerCase();
  return numbers.filter((value) => !source.includes(value.toLowerCase()));
}
