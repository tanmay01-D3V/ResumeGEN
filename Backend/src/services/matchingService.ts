import {
  type JDAnalysis,
  type GeminiMatchResult,
  type MatchItem,
  type MatchKind,
  type MatchResponse,
  type MatchStatus,
  type PortfolioRecord,
  type RankedRecord,
  type RequirementType,
} from '../../../shared/schemas';
import type { Repository } from '../repositories';
import { ApiError } from '../utils/errors';
import {
  canonicalSkill,
  normalizeForCompare,
  skillLabel,
  textHasSkill,
  tokenOverlap,
  uniqueBy,
} from '../utils/text';
import { sanitizeSingleLine } from '../utils/sanitize';
import { errorSummary, logger } from '../utils/logger';
import { nowIso } from '../utils/ids';
import { getGeminiService } from './geminiService';
import { JobDescriptionService } from './jobDescriptionService';

interface Requirement {
  text: string;
  type: RequirementType;
}

const EVIDENCE_STATUS_RANK: Record<MatchStatus, number> = {
  not_evidenced: 0,
  partial: 1,
  strong: 2,
};

export function recordText(record: PortfolioRecord): string {
  return [record.title, record.tags.join(' '), JSON.stringify(record.data)].join(' ');
}

export function recordSkillNames(record: PortfolioRecord): string[] {
  const data = record.data as Record<string, unknown>;
  const names: string[] = [];
  if (['technical_skills', 'soft_skills', 'languages', 'competencies'].includes(record.category)) {
    if (typeof data.name === 'string') names.push(data.name);
  }
  for (const key of ['technologies', 'coursework']) {
    const value = data[key];
    if (Array.isArray(value)) {
      for (const entry of value) if (typeof entry === 'string') names.push(entry);
    }
  }
  if (typeof data.name === 'string') names.push(data.name);
  if (typeof data.title === 'string') names.push(data.title);
  if (typeof data.degree === 'string') names.push(data.degree);
  return uniqueBy(names, (value) => normalizeForCompare(value));
}

function excerptFor(record: PortfolioRecord, requirement: string): string {
  const data = record.data as Record<string, unknown>;
  if (['technical_skills', 'soft_skills', 'competencies', 'languages'].includes(record.category)) {
    const name = typeof data.name === 'string' ? data.name : record.title;
    const level = typeof data.proficiency === 'string' ? ` (${data.proficiency})` : '';
    const evidence = Array.isArray(data.evidence) && data.evidence.length > 0
      ? `; evidence: ${String(data.evidence[0])}`
      : typeof data.evidence === 'string' && data.evidence
        ? `; evidence: ${data.evidence}`
        : '';
    return sanitizeSingleLine(`${name}${level}${evidence}`, 300);
  }

  if (record.category === 'projects' || record.category === 'experience') {
    const technologies = Array.isArray(data.technologies) ? data.technologies.map(String) : [];
    const matchedTech = technologies.filter((tech) => textHasSkill(requirement, tech) || textHasSkill(tech, requirement));
    const description = typeof data.description === 'string' ? data.description : '';
    const responsibilities = Array.isArray(data.responsibilities) ? data.responsibilities.map(String) : [];
    const achievements = Array.isArray(data.achievements) ? data.achievements.map(String) : [];
    const lines = [...responsibilities, ...achievements];
    const relevantLine = lines.find((line) => tokenOverlap(requirement, line) >= 0.2) || '';
    const base =
      record.category === 'projects'
        ? `Project: ${record.title}`
        : `${typeof data.jobTitle === 'string' ? data.jobTitle : record.title} at ${
            typeof data.organization === 'string' ? data.organization : 'organization'
          }`;
    const techPart = matchedTech.length > 0 ? `; technologies: ${matchedTech.join(', ')}` : '';
    const linePart = relevantLine ? `; ${relevantLine}` : '';
    const descPart = !linePart && description ? `; ${description}` : '';
    return sanitizeSingleLine(`${base}${techPart}${linePart || descPart}`, 300);
  }

  if (record.category === 'education') {
    const degree = typeof data.degree === 'string' ? data.degree : '';
    const institution = typeof data.institution === 'string' ? data.institution : '';
    const coursework = Array.isArray(data.coursework) ? data.coursework.join(', ') : '';
    return sanitizeSingleLine(
      `${degree}${institution ? `, ${institution}` : ''}${coursework ? `; coursework: ${coursework}` : ''}`,
      300,
    );
  }

  return sanitizeSingleLine(`${record.title}: ${JSON.stringify(record.data)}`, 300);
}

function explicitSkillMatch(
  record: PortfolioRecord,
  skill: string,
): { strength: 'strong' | 'partial'; kind: MatchKind; reason: string } | null {
  const data = record.data as Record<string, unknown>;
  const skillKey = canonicalSkill(skill);

  if (['technical_skills', 'soft_skills', 'competencies', 'languages'].includes(record.category)) {
    if (typeof data.name === 'string' && canonicalSkill(data.name) === skillKey) {
      return { strength: 'strong', kind: 'exact', reason: 'Listed as a verified skill' };
    }
  }

  for (const key of ['technologies', 'coursework']) {
    const value = data[key];
    if (
      Array.isArray(value) &&
      value.some((entry) => typeof entry === 'string' && canonicalSkill(entry) === skillKey)
    ) {
      return {
        strength: 'strong',
        kind: 'exact',
        reason:
          key === 'coursework'
            ? 'Covered in verified coursework'
            : record.category === 'experience'
              ? 'Used in a verified work/internship entry'
              : 'Used in a verified project',
      };
    }
  }

  if (typeof data.name === 'string' && textHasSkill(String(data.name), skill)) {
    return { strength: 'partial', kind: 'related', reason: 'Mentioned in a verified record title' };
  }
  if (typeof data.title === 'string' && textHasSkill(String(data.title), skill)) {
    return { strength: 'partial', kind: 'related', reason: 'Mentioned in a verified record title' };
  }
  if (typeof data.description === 'string' && textHasSkill(String(data.description), skill)) {
    return { strength: 'partial', kind: 'related', reason: 'Mentioned in a verified description' };
  }
  const evidence = data.evidence;
  if (Array.isArray(evidence) && evidence.some((item) => typeof item === 'string' && textHasSkill(item, skill))) {
    return { strength: 'partial', kind: 'related', reason: 'Supported by recorded evidence' };
  }
  if (typeof evidence === 'string' && textHasSkill(evidence, skill)) {
    return { strength: 'partial', kind: 'related', reason: 'Supported by recorded evidence' };
  }
  return null;
}

function buildRequirements(analysis: JDAnalysis): Requirement[] {
  const requirements: Requirement[] = [];
  for (const skill of analysis.requiredSkills) {
    if (skill.trim()) requirements.push({ text: skill.trim(), type: 'required_skill' });
  }
  for (const skill of analysis.preferredSkills) {
    if (skill.trim()) requirements.push({ text: skill.trim(), type: 'preferred_skill' });
  }
  for (const qualification of analysis.qualifications) {
    if (qualification.trim()) requirements.push({ text: qualification.trim(), type: 'qualification' });
  }
  for (const qualification of analysis.preferredQualifications) {
    if (qualification.trim()) {
      requirements.push({ text: qualification.trim(), type: 'preferred_qualification' });
    }
  }
  for (const experience of analysis.experienceRequirements) {
    if (experience.trim()) requirements.push({ text: experience.trim(), type: 'experience' });
  }
  for (const responsibility of analysis.responsibilities) {
    if (responsibility.trim()) requirements.push({ text: responsibility.trim(), type: 'responsibility' });
  }

  const deduped = uniqueBy(
    requirements,
    (item) => `${item.type}:${normalizeForCompare(item.text)}`,
  );

  // Surface a bounded set of extra keywords as informational matches.
  const covered = new Set(deduped.map((item) => normalizeForCompare(item.text)));
  let keywordCount = 0;
  for (const keyword of analysis.keywords) {
    if (keywordCount >= 8) break;
    const normalized = normalizeForCompare(keyword);
    if (!normalized || covered.has(normalized)) continue;
    deduped.push({ text: keyword, type: 'keyword' });
    covered.add(normalized);
    keywordCount += 1;
  }

  return deduped.slice(0, 80);
}

function matchSkillRequirement(
  requirement: Requirement,
  records: PortfolioRecord[],
): MatchItem {
  const byStatus: Record<MatchStatus, Array<{ record: PortfolioRecord; kind: MatchKind; reason: string }>> = {
    strong: [],
    partial: [],
    not_evidenced: [],
  };

  for (const record of records) {
    const match = explicitSkillMatch(record, requirement.text);
    if (!match) continue;
    byStatus[match.strength].push({ record, kind: match.kind, reason: match.reason });
  }

  const matched = [...byStatus.strong, ...byStatus.partial].slice(0, 4);
  const status: MatchStatus =
    byStatus.strong.length > 0 ? 'strong' : byStatus.partial.length > 0 ? 'partial' : 'not_evidenced';
  const kind: MatchKind =
    status === 'strong' ? 'exact' : status === 'partial' ? 'related' : 'unsupported';

  const explanation =
    status === 'strong'
      ? `Verified portfolio evidence explicitly includes ${skillLabel(requirement.text)}.`
      : status === 'partial'
        ? `${skillLabel(requirement.text)} appears in related evidence, but not as a verified skill entry.`
        : `No verified portfolio record evidences ${skillLabel(requirement.text)}. The job description alone is not proof.`;

  return {
    requirement: requirement.text,
    requirementType: requirement.type,
    status,
    matchKind: kind,
    recordIds: matched.map((entry) => entry.record.id),
    evidence: matched.map((entry) => ({
      recordId: entry.record.id,
      excerpt: excerptFor(entry.record, requirement.text),
    })),
    explanation,
  };
}

function matchNarrativeRequirement(
  requirement: Requirement,
  records: PortfolioRecord[],
): MatchItem {
  const requirementSkills = buildRequirementSkillList(requirement.text);
  const scored = records
    .map((record) => {
      const text = recordText(record);
      const overlap = tokenOverlap(requirement.text, text);
      const skillHits = requirementSkills.filter((skill) => textHasSkill(text, skill)).length;
      const categoryWeight = ['projects', 'experience', 'education'].includes(record.category) ? 1 : 0.85;
      const score = (overlap * 0.65 + Math.min(0.35, skillHits * 0.18)) * categoryWeight;
      const isDegreeRequirement = /bachelor|master|degree|b\.?tech|m\.?tech|graduat/i.test(requirement.text);
      const degreeBonus =
        isDegreeRequirement && record.category === 'education'
          ? 0.25 + tokenOverlap(requirement.text, recordText(record)) * 0.25
          : 0;
      const isExperienceRequirement = /years?|experience|internship/i.test(requirement.text);
      const experienceBonus =
        isExperienceRequirement && record.category === 'experience' ? 0.2 : 0;
      return { record, score: Math.min(1, score + degreeBonus + experienceBonus), overlap, skillHits };
    })
    .filter((entry) => entry.score >= 0.18 && (entry.overlap >= 0.2 || entry.skillHits > 0 || entry.score >= 0.4))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  if (scored.length === 0) {
    return {
      requirement: requirement.text,
      requirementType: requirement.type,
      status: 'not_evidenced',
      matchKind: 'unsupported',
      recordIds: [],
      evidence: [],
      explanation: 'No verified portfolio record provides evidence for this requirement.',
    };
  }

  const best = scored[0];
  const strong =
    best.score >= 0.62 &&
    (requirement.type === 'qualification' || requirement.type === 'preferred_qualification'
      ? best.record.category === 'education'
      : ['projects', 'experience'].includes(best.record.category));
  const status: MatchStatus = strong ? 'strong' : 'partial';
  const kind: MatchKind = best.overlap >= 0.5 ? 'exact' : 'related';

  return {
    requirement: requirement.text,
    requirementType: requirement.type,
    status,
    matchKind: kind,
    recordIds: scored.map((entry) => entry.record.id),
    evidence: scored.map((entry) => ({
      recordId: entry.record.id,
      excerpt: excerptFor(entry.record, requirement.text),
    })),
    explanation: strong
      ? 'A verified record directly demonstrates this requirement.'
      : 'Related verified evidence exists, but it does not fully demonstrate this requirement. Treat it as partial, not confirmed.',
  };
}

function buildRequirementSkillList(text: string): string[] {
  const candidates = [
    'Python',
    'JavaScript',
    'TypeScript',
    'React',
    'Node.js',
    'Express.js',
    'SQL',
    'PostgreSQL',
    'MongoDB',
    'REST APIs',
    'Git',
    'Docker',
    'AWS',
    'Machine Learning',
    'scikit-learn',
    'pandas',
    'NumPy',
    'TensorFlow',
    'PyTorch',
    'Data Preprocessing',
    'Model Evaluation',
    'Communication',
    'Analytical Skills',
    'Problem Solving',
    'Teamwork',
    'Database Design',
    'Data Structures',
    'Algorithms',
  ];
  return candidates.filter((skill) => textHasSkill(text, skill));
}

export function matchDeterministic(
  jobDescriptionId: string,
  analysis: JDAnalysis,
  allRecords: PortfolioRecord[],
): MatchResponse {
  const records = allRecords.filter(
    (record) =>
      record.verificationStatus === 'verified' &&
      !['personal_info', 'summary'].includes(record.category),
  );

  const matches = buildRequirements(analysis).map((requirement) =>
    ['required_skill', 'preferred_skill'].includes(requirement.type) &&
    analyzeSkillLike(requirement.text)
      ? matchSkillRequirement(requirement, records)
      : matchNarrativeRequirement(requirement, records),
  );

  const rankedRecords = rankRecords(matches, records, analysis);
  const missingRequirements = matches
    .filter((match) => match.status === 'not_evidenced')
    .map((match) => match.requirement);

  return {
    jobDescriptionId,
    matches,
    missingRequirements,
    rankedRecords,
    engine: 'deterministic',
    notes:
      'Matches reference actual verified portfolio records. Statuses are evidence indicators, not statistically calibrated scores. A job keyword is never treated as proof of a skill.',
    generatedAt: nowIso(),
  };
}

/** A requirement is skill-like when it is short and maps to a known skill name. */
function analyzeSkillLike(text: string): boolean {
  const normalized = normalizeForCompare(text);
  if (normalized.split(' ').length > 5) return false;
  return [
    'python', 'javascript', 'typescript', 'react', 'node js', 'express js', 'sql', 'postgresql',
    'mongodb', 'rest apis', 'git', 'docker', 'aws', 'machine learning', 'scikit learn', 'pandas',
    'numpy', 'tensorflow', 'pytorch', 'data preprocessing', 'model evaluation', 'communication',
    'analytical skills', 'problem solving', 'teamwork', 'database design', 'data structures',
    'algorithms', 'java', 'c + +', 'c #', 'go', 'linux', 'agile', 'scrum', 'jira', 'figma',
    'power bi', 'tableau', 'excel', 'nlp', 'deep learning', 'computer vision', 'mlops', 'llm',
  ].includes(normalized);
}

function rankRecords(
  matches: MatchItem[],
  records: PortfolioRecord[],
  analysis: JDAnalysis,
): RankedRecord[] {
  const selectedSkills = [...analysis.requiredSkills, ...analysis.preferredSkills];
  const weights: Record<RequirementType, number> = {
    required_skill: 4,
    preferred_skill: 2.5,
    qualification: 2,
    preferred_qualification: 1.2,
    experience: 2.5,
    responsibility: 1.5,
    keyword: 0.6,
  };

  const scores = new Map<string, { score: number; requirements: string[] }>();
  for (const match of matches) {
    if (match.status === 'not_evidenced') continue;
    for (const recordId of match.recordIds) {
      const entry = scores.get(recordId) ?? { score: 0, requirements: [] };
      entry.score += weights[match.requirementType] * (match.status === 'strong' ? 1 : 0.5);
      if (!entry.requirements.includes(match.requirement)) entry.requirements.push(match.requirement);
      scores.set(recordId, entry);
    }
  }

  const ranked: RankedRecord[] = [];
  for (const record of records) {
    if (!['projects', 'experience', 'certifications', 'education'].includes(record.category)) continue;
    const base = scores.get(record.id);
    if (!base) continue;
    const text = recordText(record);
    const skillHits = selectedSkills.filter((skill) => textHasSkill(text, skill));
    const rawScore = base.score + skillHits.length * 3;
    const relevance = Math.min(98, Math.round(rawScore * 4));
    if (relevance <= 0) continue;
    const reasonParts = base.requirements.slice(0, 3).map((requirement) => `"${sanitizeSingleLine(requirement, 80)}"`);
    ranked.push({
      recordId: record.id,
      relevance,
      reason:
        reasonParts.length > 0
          ? `Supports ${reasonParts.join(', ')}${skillHits.length ? `; uses ${skillHits.slice(0, 3).join(', ')}` : ''}.`
          : `Shares verified skills with the role: ${skillHits.slice(0, 4).join(', ')}.`,
      matchedRequirements: base.requirements.slice(0, 8),
    });
  }

  return ranked.sort((a, b) => b.relevance - a.relevance).slice(0, 40);
}

export function mergeGeminiMatches(
  deterministic: MatchResponse,
  gemini: GeminiMatchResult,
  records: PortfolioRecord[],
): MatchResponse {
  const recordById = new Map(records.map((record) => [record.id, record]));
  const matches = deterministic.matches.map((existing) => {
    const candidate = gemini.matches.find(
      (item) => normalizeForCompare(item.requirement) === normalizeForCompare(existing.requirement),
    );
    if (!candidate) return existing;

    const validIds = candidate.recordIds.filter((id) => recordById.has(id));
    if (validIds.length === 0) return existing;

    // Verify the AI's evidence claim against the actual record content.
    const verifiedIds = validIds.filter((id) => {
      const record = recordById.get(id)!;
      const text = recordText(record);
      return (
        tokenOverlap(existing.requirement, text) >= 0.15 ||
        buildRequirementSkillList(existing.requirement).some((skill) => textHasSkill(text, skill)) ||
        existing.recordIds.includes(id)
      );
    });
    if (verifiedIds.length === 0) return existing;

    const candidateStatus =
      candidate.status === 'strong' && existing.status !== 'strong' && verifiedIds.length > 0
        ? // Do not let semantic similarity alone create a "strong" match.
          'partial'
        : candidate.status;
    if (EVIDENCE_STATUS_RANK[candidateStatus] <= EVIDENCE_STATUS_RANK[existing.status]) {
      return existing;
    }

    const evidence = verifiedIds.map((id) => ({
      recordId: id,
      excerpt: excerptFor(recordById.get(id)!, existing.requirement),
    }));

    return {
      ...existing,
      status: candidateStatus,
      matchKind: candidateStatus === 'strong' ? 'exact' : 'related',
      recordIds: uniqueBy([...existing.recordIds, ...verifiedIds], (id) => id).slice(0, 6),
      evidence: uniqueBy([...existing.evidence, ...evidence], (item) => item.recordId).slice(0, 6),
      explanation: existing.explanation.includes('Semantic')
        ? existing.explanation
        : `${existing.explanation} Semantic AI assistance found additional related evidence; record IDs were re-verified against the portfolio.`,
    } as MatchItem;
  });

  const missingRequirements = matches
    .filter((match) => match.status === 'not_evidenced')
    .map((match) => match.requirement);

  return {
    ...deterministic,
    matches,
    missingRequirements,
    engine: 'gemini+deterministic',
    notes:
      'Statuses combine deterministic, alias-aware matching with Gemini semantic suggestions. Every accepted AI suggestion was checked against an existing verified record. These are evidence indicators, not calibrated scores.',
  };
}

export class MatchingService {
  constructor(
    private readonly repo: Repository,
    private readonly jobs: JobDescriptionService,
  ) {}

  async match(uid: string, jobDescriptionId: string, useAi: boolean): Promise<MatchResponse> {
    const job = await this.jobs.get(uid, jobDescriptionId);
    if (!job.analysis) {
      throw ApiError.badRequest('Analyse this job description before matching portfolio records.');
    }
    const records = await this.repo.listPortfolio(uid);
    const deterministic = matchDeterministic(job.id, job.analysis, records);

    const gemini = getGeminiService();
    if (!useAi || !gemini.configured) {
      return {
        ...deterministic,
        notes: gemini.configured
          ? deterministic.notes
          : `${deterministic.notes} Gemini is not configured, so semantic assistance was skipped.`,
      };
    }

    const verified = records.filter(
      (record) =>
        record.verificationStatus === 'verified' &&
        !['personal_info', 'summary'].includes(record.category),
    );
    try {
      const ai = await gemini.matchPortfolioToJob({
        jobDescriptionId,
        analysis: job.analysis,
        records: verified,
        requirements: deterministic.matches.map((match) => match.requirement),
      });
      return mergeGeminiMatches(deterministic, ai, verified);
    } catch (error) {
      logger.warn('Gemini matching failed; returning deterministic results', {
        error: errorSummary(error),
      });
      return {
        ...deterministic,
        notes: `${deterministic.notes} Semantic AI assistance was unavailable for this request, so deterministic matching is shown.`,
      };
    }
  }
}
