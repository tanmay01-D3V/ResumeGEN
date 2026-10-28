import { jdAnalysisSchema, type JDAnalysis } from '../../../shared/schemas';
import { extractSkills, normalizeForCompare, splitSentences, STOPWORDS, titleCase, uniqueBy } from '../utils/text';
import { sanitizeSingleLine } from '../utils/sanitize';

const PREFERRED_CONTEXT =
  /preferred|nice[- ]to[- ]have|bonus|a plus|desired|good to have|familiarity with|exposure to/i;
const REQUIRED_CONTEXT =
  /required|must[- ]have|minimum|proficien|strong (?:knowledge|understanding|experience)|expertise|hands[- ]on|experience (?:in|with)|solid (?:understanding|experience)/i;
const EDUCATION_CONTEXT =
  /bachelor|master|b\.?tech|m\.?tech|b\.?sc|m\.?sc|bca|mca|degree|graduat|education|equivalent|diploma/i;
const EXPERIENCE_CONTEXT =
  /(\d+\s*(?:\+|to|-|–)?\s*\d*\s*\+?\s*years?)|entry[- ]level|fresh graduate|internship experience/i;
const RESPONSIBILITY_CONTEXT =
  /responsibilit|you will|design|develop|build|implement|maintain|analy[sz]e|collaborate|deploy|optimis|optimiz|create|manage|evaluate|research|test|automate|integrate|document|present/i;

const SOFT_SKILLS = new Set([
  'communication',
  'analytical skills',
  'problem solving',
  'teamwork',
  'leadership',
  'presentation skills',
]);

function cleanLine(value: string): string {
  return value
    .replace(/^[\s•●▪◦*\-–—\d.)]+/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function pushUnique(target: string[], value: string, max = 40): void {
  const cleaned = sanitizeSingleLine(value, 400);
  if (!cleaned || cleaned.length < 3) return;
  if (target.length >= max) return;
  if (!target.some((item) => normalizeForCompare(item) === normalizeForCompare(cleaned))) {
    target.push(cleaned);
  }
}

function looksLikeRequirementLine(line: string): boolean {
  return EDUCATION_CONTEXT.test(line) || REQUIRED_CONTEXT.test(line) || PREFERRED_CONTEXT.test(line);
}

/**
 * Deterministic, transparent JD extraction used when Gemini is not configured
 * (or fails). It only reports phrases and skills actually present in the text.
 * Section headings are tracked so preferred requirements stay separate.
 * The UI labels this result as "local heuristic analysis", never as Gemini.
 */
export function heuristicAnalyzeJobDescription(input: {
  rawText: string;
  jobTitle?: string;
  company?: string;
}): JDAnalysis {
  const text = input.rawText;
  const rawLines = text
    .split(/\n+/)
    .map(cleanLine)
    .filter((line) => line.length > 2);
  const units = rawLines.length >= 5 ? rawLines : splitSentences(text);
  const sentences = splitSentences(text);

  const requiredSkills: string[] = [];
  const preferredSkills: string[] = [];
  const technologies: string[] = [];

  let section: 'required' | 'preferred' | 'responsibilities' | 'qualifications' | 'neutral' = 'neutral';

  const isPreferredHeading = (line: string) =>
    /^(preferred|desired|nice[- ]to[- ]have|bonus)( qualifications| skills| requirements| experience)?\b/i.test(line) &&
    line.length < 90;
  const isRequiredHeading = (line: string) =>
    /^(required|minimum|basic|must[- ]have)( qualifications| skills| requirements| experience)?\b/i.test(line) &&
    line.length < 90;
  const isResponsibilityHeading = (line: string) =>
    /^(responsibilities|what you.ll do|the role|about the role|your role|key duties)\b/i.test(line) &&
    line.length < 90;

  for (const unit of units) {
    if (isPreferredHeading(unit)) section = 'preferred';
    else if (isRequiredHeading(unit)) section = 'required';
    else if (isResponsibilityHeading(unit)) section = 'responsibilities';

    for (const skill of extractSkills(unit)) {
      const preferred =
        section === 'preferred' ||
        (section !== 'required' &&
          section !== 'responsibilities' &&
          PREFERRED_CONTEXT.test(unit) &&
          !REQUIRED_CONTEXT.test(unit));
      if (preferred) pushUnique(preferredSkills, skill);
      else pushUnique(requiredSkills, skill);
      if (!SOFT_SKILLS.has(normalizeForCompare(skill))) pushUnique(technologies, skill);
    }
  }

  for (const skill of requiredSkills) {
    const index = preferredSkills.findIndex(
      (candidate) => normalizeForCompare(candidate) === normalizeForCompare(skill),
    );
    if (index >= 0) preferredSkills.splice(index, 1);
  }

  const qualifications: string[] = [];
  const preferredQualifications: string[] = [];
  const experienceRequirements: string[] = [];
  const requestedCertifications: string[] = [];

  section = 'neutral';
  for (const line of units) {
    if (isPreferredHeading(line)) {
      section = 'preferred';
      continue;
    }
    if (isRequiredHeading(line)) {
      section = 'required';
      continue;
    }
    if (isResponsibilityHeading(line)) {
      section = 'responsibilities';
      continue;
    }
    if (line.length > 400) continue;
    if (EXPERIENCE_CONTEXT.test(line)) pushUnique(experienceRequirements, line, 12);
    if (/certif/i.test(line)) pushUnique(requestedCertifications, line, 10);
    if (section === 'preferred' && (EDUCATION_CONTEXT.test(line) || PREFERRED_CONTEXT.test(line))) {
      pushUnique(preferredQualifications, line);
    } else if (section !== 'responsibilities' && EDUCATION_CONTEXT.test(line)) {
      if (PREFERRED_CONTEXT.test(line)) pushUnique(preferredQualifications, line);
      else pushUnique(qualifications, line);
    }
  }

  // Pull explicit years-of-experience fragments even when embedded mid-sentence.
  for (const sentence of sentences) {
    const match = sentence.match(/(?:\d+\+?\s*(?:to|-|–)\s*\d+\s*years?|\d+\+?\s*years?|\d+\s*years?)[^.]{0,120}/i);
    if (match) pushUnique(experienceRequirements, match[0], 12);
  }

  const responsibilities: string[] = [];
  section = 'neutral';
  for (const line of units) {
    if (isPreferredHeading(line) || isRequiredHeading(line)) {
      section = 'qualifications';
      continue;
    }
    if (isResponsibilityHeading(line)) {
      section = 'responsibilities';
      continue;
    }
    if (line.length < 15 || line.length > 400) continue;
    if (section !== 'responsibilities') continue;
    if (looksLikeRequirementLine(line)) continue;
    if (RESPONSIBILITY_CONTEXT.test(line)) pushUnique(responsibilities, line, 12);
  }

  const keywordCounts = new Map<string, number>();
  for (const token of normalizeForCompare(text).split(/\s+/)) {
    if (token.length < 3 || STOPWORDS.has(token) || /^\d+$/.test(token)) continue;
    keywordCounts.set(token, (keywordCounts.get(token) ?? 0) + 1);
  }
  const frequent = [...keywordCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 18)
    .map(([token]) => titleCase(token));
  const keywords = uniqueBy(
    [...requiredSkills, ...preferredSkills, ...frequent],
    (value) => normalizeForCompare(value),
  ).slice(0, 30);

  const relevantProjectTypes: string[] = [];
  const skillSet = new Set(technologies.map((skill) => normalizeForCompare(skill)));
  if (['machine learning', 'deep learning', 'scikit-learn', 'tensorflow', 'pytorch', 'pandas', 'numpy'].some((skill) => skillSet.has(skill))) {
    pushUnique(relevantProjectTypes, 'Machine learning model development');
    pushUnique(relevantProjectTypes, 'Data preprocessing and feature engineering');
    pushUnique(relevantProjectTypes, 'Model evaluation and experimentation');
  }
  if (['react', 'javascript', 'typescript', 'node.js', 'express.js', 'rest apis', 'html', 'css'].some((skill) => skillSet.has(skill))) {
    pushUnique(relevantProjectTypes, 'Full-stack web application development');
    pushUnique(relevantProjectTypes, 'REST API and database-backed applications');
  }
  if (['sql', 'postgresql', 'mysql', 'mongodb', 'power bi', 'tableau', 'data visualization'].some((skill) => skillSet.has(skill))) {
    pushUnique(relevantProjectTypes, 'Database design and data analysis');
  }
  if (['aws', 'google cloud', 'azure', 'docker', 'kubernetes', 'ci/cd'].some((skill) => skillSet.has(skill))) {
    pushUnique(relevantProjectTypes, 'Cloud deployment and containerised services');
  }

  return jdAnalysisSchema.parse({
    jobTitle: sanitizeSingleLine(input.jobTitle || 'Role', 200),
    company: sanitizeSingleLine(input.company || '', 200),
    requiredSkills,
    preferredSkills,
    technologies,
    qualifications,
    preferredQualifications,
    experienceRequirements,
    responsibilities,
    keywords,
    relevantProjectTypes,
    requestedCertifications,
  });
}
