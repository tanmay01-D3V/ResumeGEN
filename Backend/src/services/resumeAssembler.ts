import {
  DEFAULT_SECTION_ORDER,
  RESUME_SECTION_LABELS,
  containsUnsupportedNumericClaim,
  type JDAnalysis,
  type JobDescription,
  type PortfolioRecord,
  type ResumeDocument,
  type ResumeItem,
  type ResumeSectionKey,
  type ResumeSettings,
} from '../../../shared/schemas';
import { CATEGORY_META } from '../../../shared/categories';
import { ensureHttpUrl, sanitizeSingleLine, sanitizeText } from '../utils/sanitize';
import { canonicalSkill, extractSkills, normalizeForCompare, skillLabel, textHasSkill, tokenOverlap, uniqueBy } from '../utils/text';

type Data = Record<string, unknown>;

function str(data: Data, key: string): string {
  const value = data[key];
  return typeof value === 'string' ? sanitizeSingleLine(value, 600) : '';
}

function list(data: Data, key: string): string[] {
  const value = data[key];
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => sanitizeSingleLine(item, 500))
    .filter(Boolean);
}

function bool(data: Data, key: string): boolean {
  return data[key] === true;
}

function formatRange(start: string, end: string, current = false): string {
  if (current) return [start, 'Present'].filter(Boolean).join(' – ');
  if (start && end && normalizeForCompare(start) !== normalizeForCompare(end)) {
    return `${start} – ${end}`;
  }
  return start || end;
}

function itemLinks(record: PortfolioRecord): ResumeItem['links'] {
  const data = record.data as Data;
  const links: ResumeItem['links'] = [];
  const definitions: Array<[string, string]> = [
    ['repoUrl', 'Repository'],
    ['demoUrl', 'Live demo'],
    ['credentialUrl', 'Credential'],
    ['url', 'Link'],
  ];
  for (const [key, label] of definitions) {
    const value = str(data, key);
    if (!value) continue;
    links.push({ label, url: ensureHttpUrl(value).slice(0, 400) });
  }
  return links;
}

function categoryRecords(records: PortfolioRecord[], categories: string[]): PortfolioRecord[] {
  return records.filter((record) => categories.includes(record.category));
}

function relevanceToJob(record: PortfolioRecord, analysis?: JDAnalysis): number {
  if (!analysis) return 0;
  const text = [record.title, record.tags.join(' '), JSON.stringify(record.data)].join(' ');
  const skills = [...analysis.requiredSkills, ...analysis.preferredSkills, ...analysis.technologies];
  const skillHits = skills.filter((skill) => textHasSkill(text, skill)).length;
  const responsibilityOverlap = analysis.responsibilities.reduce(
    (sum, responsibility) => sum + tokenOverlap(responsibility, text),
    0,
  );
  return skillHits * 4 + responsibilityOverlap * 3;
}

function buildSkillsSection(records: PortfolioRecord[], sectionKey: ResumeSectionKey, title: string): ResumeItem[] {
  const groups = new Map<string, PortfolioRecord[]>();
  for (const record of records) {
    const data = record.data as Data;
    const group =
      sectionKey === 'skills'
        ? record.category === 'technical_skills'
          ? str(data, 'category') || 'Technical'
          : record.category === 'soft_skills'
            ? 'Soft skills'
            : 'Additional competencies'
        : title;
    const key = sanitizeSingleLine(group, 80) || title;
    const current = groups.get(key) ?? [];
    current.push(record);
    groups.set(key, current);
  }

  return [...groups.entries()].map(([group, groupRecords]) => {
    const bullets = groupRecords.map((record) => {
      const data = record.data as Data;
      const name = str(data, 'name') || record.title;
      const proficiency = str(data, 'proficiency');
      return sanitizeSingleLine(proficiency ? `${name} — ${proficiency}` : name, 200);
    });
    return {
      recordId: groupRecords[0]!.id,
      heading: group,
      subheading: '',
      meta: '',
      bullets: uniqueBy(bullets, (value) => normalizeForCompare(value)),
      links: [],
    };
  });
}

function projectOrExperienceItem(record: PortfolioRecord, analysis?: JDAnalysis): ResumeItem {
  const data = record.data as Data;
  if (record.category === 'experience') {
    const bullets = uniqueBy(
      [
        ...list(data, 'responsibilities'),
        ...list(data, 'achievements'),
        ...list(data, 'metrics').map((metric) => `Metric: ${metric}`),
      ],
      (value) => normalizeForCompare(value),
    ).slice(0, 10);
    const range = formatRange(str(data, 'startDate'), str(data, 'endDate'), bool(data, 'current'));
    const meta = [range, str(data, 'location'), str(data, 'employmentType')].filter(Boolean).join(' · ');
    return {
      recordId: record.id,
      heading: str(data, 'jobTitle') || record.title,
      subheading: str(data, 'organization'),
      meta: sanitizeSingleLine(meta, 300),
      bullets,
      links: [],
    };
  }

  const bullets: string[] = [];
  const description = sanitizeText(str(data, 'description'), 2000);
  if (description) bullets.push(description);
  const problem = sanitizeText(str(data, 'problemSolved'), 1000);
  if (problem) bullets.push(`Problem addressed: ${problem}`);
  bullets.push(...list(data, 'responsibilities'), ...list(data, 'achievements'));
  bullets.push(...list(data, 'metrics').map((metric) => `Result: ${metric}`));
  const range = formatRange(str(data, 'startDate'), str(data, 'endDate'));
  const tech = list(data, 'technologies');
  return {
    recordId: record.id,
    heading: str(data, 'name') || record.title,
    subheading: tech.slice(0, 10).join(', '),
    meta: sanitizeSingleLine([str(data, 'role'), range].filter(Boolean).join(' · '), 300),
    bullets: uniqueBy(bullets, (value) => normalizeForCompare(value)).slice(0, 10),
    links: itemLinks(record),
  };
}

function educationItem(record: PortfolioRecord): ResumeItem {
  const data = record.data as Data;
  const range = formatRange(str(data, 'startDate'), str(data, 'endDate'));
  const bullets: string[] = [];
  const grade = str(data, 'grade');
  if (grade) bullets.push(`Grade: ${grade}`);
  const coursework = list(data, 'coursework');
  if (coursework.length) bullets.push(`Relevant coursework: ${coursework.join(', ')}`);
  const description = sanitizeText(str(data, 'description'), 1200);
  if (description) bullets.push(description);
  return {
    recordId: record.id,
    heading: [str(data, 'degree'), str(data, 'fieldOfStudy')].filter(Boolean).join(', ') || record.title,
    subheading: str(data, 'institution'),
    meta: range,
    bullets,
    links: [],
  };
}

function certificationItem(record: PortfolioRecord): ResumeItem {
  const data = record.data as Data;
  const range = formatRange(str(data, 'issueDate'), str(data, 'expiryDate'));
  const credentialId = str(data, 'credentialId');
  const bullets: string[] = [];
  if (credentialId) bullets.push(`Credential ID: ${credentialId}`);
  const description = sanitizeText(str(data, 'description'), 800);
  if (description) bullets.push(description);
  return {
    recordId: record.id,
    heading: str(data, 'name') || record.title,
    subheading: str(data, 'issuer'),
    meta: range,
    bullets,
    links: itemLinks(record),
  };
}

function achievementItem(record: PortfolioRecord): ResumeItem {
  const data = record.data as Data;
  const bullets: string[] = [];
  const description = sanitizeText(str(data, 'description'), 1000);
  if (description) bullets.push(description);
  const metric = str(data, 'metric');
  if (metric) bullets.push(`Metric: ${metric}`);
  return {
    recordId: record.id,
    heading: str(data, 'title') || record.title,
    subheading: str(data, 'organization'),
    meta: str(data, 'date'),
    bullets,
    links: [],
  };
}

function publicationItem(record: PortfolioRecord): ResumeItem {
  const data = record.data as Data;
  const bullets: string[] = [];
  const authors = list(data, 'authors');
  if (authors.length) bullets.push(`Authors: ${authors.join(', ')}`);
  const description = sanitizeText(str(data, 'description'), 1200);
  if (description) bullets.push(description);
  const doi = str(data, 'doi');
  if (doi) bullets.push(`DOI: ${doi}`);
  return {
    recordId: record.id,
    heading: str(data, 'title') || record.title,
    subheading: str(data, 'venue'),
    meta: str(data, 'date'),
    bullets,
    links: itemLinks(record),
  };
}

function extracurricularItem(record: PortfolioRecord): ResumeItem {
  const data = record.data as Data;
  const range = formatRange(str(data, 'startDate'), str(data, 'endDate'));
  const description = sanitizeText(str(data, 'description'), 1000);
  return {
    recordId: record.id,
    heading: str(data, 'role') || record.title,
    subheading: str(data, 'organization'),
    meta: range,
    bullets: description ? [description] : [],
    links: [],
  };
}

function languageItems(records: PortfolioRecord[]): ResumeItem[] {
  if (records.length === 0) return [];
  const bullets = records.map((record) => {
    const data = record.data as Data;
    const name = str(data, 'name') || record.title;
    const proficiency = str(data, 'proficiency');
    const score = str(data, 'testScore');
    return sanitizeSingleLine(
      [name, proficiency, score ? `(${score})` : ''].filter(Boolean).join(' — '),
      200,
    );
  });
  return [
    {
      recordId: records[0]!.id,
      heading: 'Languages',
      subheading: '',
      meta: '',
      bullets,
      links: [],
    },
  ];
}

function competencyItems(records: PortfolioRecord[]): ResumeItem[] {
  if (records.length === 0) return [];
  const bullets = records.map((record) => {
    const data = record.data as Data;
    const name = str(data, 'name') || record.title;
    const description = str(data, 'description');
    return sanitizeSingleLine(description ? `${name} — ${description}` : name, 400);
  });
  return [
    {
      recordId: records[0]!.id,
      heading: 'Additional Competencies',
      subheading: '',
      meta: '',
      bullets,
      links: [],
    },
  ];
}

function buildSectionItems(
  key: ResumeSectionKey,
  records: PortfolioRecord[],
  analysis?: JDAnalysis,
): ResumeItem[] {
  switch (key) {
    case 'skills':
      return buildSkillsSection(
        categoryRecords(records, ['technical_skills', 'soft_skills']),
        'skills',
        RESUME_SECTION_LABELS.skills,
      );
    case 'languages':
      return languageItems(categoryRecords(records, ['languages']));
    case 'competencies':
      return competencyItems(categoryRecords(records, ['competencies']));
    case 'projects':
      return categoryRecords(records, ['projects'])
        .sort((a, b) => relevanceToJob(b, analysis) - relevanceToJob(a, analysis))
        .map((record) => projectOrExperienceItem(record, analysis));
    case 'experience':
      return categoryRecords(records, ['experience'])
        .sort((a, b) => relevanceToJob(b, analysis) - relevanceToJob(a, analysis))
        .map((record) => projectOrExperienceItem(record, analysis));
    case 'education':
      return categoryRecords(records, ['education']).map(educationItem);
    case 'certifications':
      return categoryRecords(records, ['certifications']).map(certificationItem);
    case 'achievements':
      return categoryRecords(records, ['achievements']).map(achievementItem);
    case 'publications':
      return categoryRecords(records, ['publications']).map(publicationItem);
    case 'extracurriculars':
      return categoryRecords(records, ['extracurriculars']).map(extracurricularItem);
    case 'summary':
      return [];
    default:
      return [];
  }
}

function asData(record: PortfolioRecord | undefined): Data {
  return (record?.data as Data | undefined) ?? {};
}

export function deterministicSummary(input: {
  records: PortfolioRecord[];
  job: JobDescription;
  headline: string;
}): string {
  const skills = categoryRecords(input.records, ['technical_skills'])
    .map((record) => asData(record).name)
    .filter((value): value is string => typeof value === 'string' && value.length > 0)
    .slice(0, 5);
  const projects = categoryRecords(input.records, ['projects']);
  const experiences = categoryRecords(input.records, ['experience']);
  const anchor = projects[0] ?? experiences[0];
  const anchorData = asData(anchor);
  const anchorTitle =
    typeof anchorData.name === 'string'
      ? anchorData.name
      : typeof anchorData.jobTitle === 'string'
        ? `${anchorData.jobTitle}${typeof anchorData.organization === 'string' ? ` at ${anchorData.organization}` : ''}`
        : '';
  const anchorTech = Array.isArray(anchorData.technologies)
    ? anchorData.technologies.filter((value): value is string => typeof value === 'string').slice(0, 3)
    : [];

  const parts: string[] = [];
  if (input.headline) parts.push(input.headline.replace(/\.$/, ''));
  if (anchorTitle) {
    parts.push(
      `Verified portfolio work includes ${anchorTitle}${anchorTech.length ? ` using ${anchorTech.join(', ')}` : ''}`,
    );
  }
  if (skills.length) {
    parts.push(`Verified strengths include ${skills.join(', ')}`);
  }
  if (input.job.jobTitle) {
    parts.push(`Targeting ${input.job.jobTitle} opportunities`);
  }
  const text = parts.join('. ').replace(/\.\./g, '.');
  return sanitizeText(text ? `${text}.` : 'Verified portfolio information is available in the sections below.', 900);
}

/**
 * Reject AI summaries containing unsupported numeric claims, new technologies
 * or certification claims. Returns the reason when grounding fails.
 */
export function validateSummaryGrounding(
  summary: string,
  records: PortfolioRecord[],
): { ok: true } | { ok: false; reason: string } {
  const source = records
    .map((record) => `${record.title} ${JSON.stringify(record.data)}`)
    .join(' ');

  const unsupportedNumbers = containsUnsupportedNumericClaim(summary, source);
  if (unsupportedNumbers.length > 0) {
    return {
      ok: false,
      reason: `The AI summary introduced unsupported numeric claims: ${unsupportedNumbers.slice(0, 4).join(', ')}.`,
    };
  }

  const mentionedSkills = extractSkills(summary);
  const unsupportedSkills = mentionedSkills.filter((skill) => !textHasSkill(source, skill));
  if (unsupportedSkills.length > 0) {
    return {
      ok: false,
      reason: `The AI summary mentioned skills without portfolio evidence: ${unsupportedSkills.slice(0, 4).join(', ')}.`,
    };
  }

  if (/certif/i.test(summary) && !records.some((record) => record.category === 'certifications')) {
    return {
      ok: false,
      reason: 'The AI summary mentioned certification without a selected certification record.',
    };
  }

  if (/\b\d+\+?\s*years?\b/i.test(summary) && !/\b\d+\+?\s*years?\b/i.test(source)) {
    return { ok: false, reason: 'The AI summary introduced a years-of-experience claim.' };
  }

  return { ok: true };
}

export function assembleResume(input: {
  records: PortfolioRecord[];
  job: JobDescription;
  settings: ResumeSettings;
  summary: string;
  headline: string;
  name: string;
  contact: ResumeDocument['contact'];
  engine: 'deterministic' | 'gemini-assisted';
  warnings: string[];
}): ResumeDocument {
  const analysis = input.job.analysis;
  const order = uniqueBy(input.settings.sectionOrder, (key) => key) as ResumeSectionKey[];

  const sections: ResumeDocument['sections'] = [];
  for (const key of order) {
    if (key === 'summary') {
      if (input.summary.trim()) {
        sections.push({ key, title: RESUME_SECTION_LABELS.summary, items: [] });
      }
      continue;
    }
    const items = buildSectionItems(key, input.records, analysis).filter(
      (item) => item.heading || item.subheading || item.bullets.length > 0 || item.links.length > 0,
    );
    if (items.length === 0) continue;
    sections.push({ key, title: RESUME_SECTION_LABELS[key], items });
  }

  return {
    name: sanitizeSingleLine(input.name, 160),
    headline: sanitizeSingleLine(input.headline, 200),
    contact: input.contact,
    summary: sanitizeText(input.summary, 2000),
    sections,
    template: input.settings.template,
    layout: input.settings.layout,
    generatedAt: new Date().toISOString(),
    engine: input.engine,
    warnings: input.warnings.map((warning) => sanitizeSingleLine(warning, 400)).slice(0, 20),
  };
}

export function resumeDocumentToText(document: ResumeDocument): string {
  const parts: string[] = [document.name, document.headline, document.summary];
  for (const section of document.sections) {
    parts.push(section.title);
    for (const item of section.items) {
      parts.push(item.heading, item.subheading, item.meta, ...item.bullets);
    }
  }
  return parts.filter(Boolean).join('\n');
}

/** Used by the builder to preselect records with the strongest evidence. */
export function suggestedRecordIds(
  records: PortfolioRecord[],
  analysis: JDAnalysis,
): string[] {
  return records
    .filter(
      (record) =>
        record.verificationStatus === 'verified' &&
        !['personal_info'].includes(record.category),
    )
    .map((record) => ({ id: record.id, score: relevanceToJob(record, analysis) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.id);
}

export { CATEGORY_META };

export function skillMatchSummary(record: PortfolioRecord, analysis: JDAnalysis): string[] {
  const text = JSON.stringify(record.data);
  return [...analysis.requiredSkills, ...analysis.preferredSkills]
    .filter((skill) => textHasSkill(text, skill))
    .map((skill) => skillLabel(canonicalSkill(skill)));
}
