/**
 * Deterministic text normalisation and skill alias handling.
 * Used by the matching engine, the offline JD extractor and resume grounding.
 */

interface SkillDefinition {
  label: string;
  aliases: string[];
}

const SKILLS: SkillDefinition[] = [
  { label: 'Python', aliases: ['python3', 'py'] },
  { label: 'JavaScript', aliases: ['js', 'ecmascript', 'es6'] },
  { label: 'TypeScript', aliases: ['ts'] },
  { label: 'React', aliases: ['react.js', 'reactjs', 'react js'] },
  { label: 'Node.js', aliases: ['nodejs', 'node js', 'node'] },
  { label: 'Express.js', aliases: ['expressjs', 'express js', 'express'] },
  { label: 'MongoDB', aliases: ['mongo', 'mongo db'] },
  { label: 'PostgreSQL', aliases: ['postgres', 'psql'] },
  { label: 'MySQL', aliases: [] },
  { label: 'SQLite', aliases: ['sqlite3'] },
  { label: 'SQL', aliases: ['structured query language'] },
  { label: 'HTML', aliases: ['html5'] },
  { label: 'CSS', aliases: ['css3'] },
  { label: 'Tailwind CSS', aliases: ['tailwind', 'tailwindcss'] },
  { label: 'Git', aliases: ['git scm'] },
  { label: 'GitHub', aliases: ['github actions'] },
  { label: 'Docker', aliases: ['containerization'] },
  { label: 'Kubernetes', aliases: ['k8s'] },
  { label: 'AWS', aliases: ['amazon web services'] },
  { label: 'Google Cloud', aliases: ['gcp', 'google cloud platform'] },
  { label: 'Azure', aliases: ['microsoft azure'] },
  { label: 'Firebase', aliases: [] },
  { label: 'Firestore', aliases: ['cloud firestore'] },
  { label: 'REST APIs', aliases: ['rest api', 'restful api', 'restful apis', 'restful services'] },
  { label: 'GraphQL', aliases: [] },
  { label: 'Machine Learning', aliases: ['ml'] },
  { label: 'Deep Learning', aliases: ['dl', 'neural networks'] },
  { label: 'scikit-learn', aliases: ['scikit learn', 'sklearn', 'scikit'] },
  { label: 'pandas', aliases: ['pandas library'] },
  { label: 'NumPy', aliases: ['numpy'] },
  { label: 'TensorFlow', aliases: ['tensor flow'] },
  { label: 'PyTorch', aliases: ['torch'] },
  { label: 'Keras', aliases: [] },
  { label: 'OpenCV', aliases: ['open cv'] },
  { label: 'NLP', aliases: ['natural language processing'] },
  { label: 'Data Preprocessing', aliases: ['data cleaning', 'data preparation', 'feature engineering'] },
  { label: 'Model Evaluation', aliases: ['model validation', 'model assessment', 'cross validation'] },
  { label: 'Statistics', aliases: ['statistical analysis', 'probability'] },
  { label: 'Java', aliases: [] },
  { label: 'C++', aliases: ['cpp', 'c plus plus'] },
  { label: 'C#', aliases: ['csharp', 'c sharp'] },
  { label: 'Go', aliases: ['golang', 'go lang'] },
  { label: 'Rust', aliases: [] },
  { label: 'PHP', aliases: [] },
  { label: 'Django', aliases: [] },
  { label: 'Flask', aliases: [] },
  { label: 'FastAPI', aliases: ['fast api'] },
  { label: 'Spring Boot', aliases: ['springboot'] },
  { label: 'Redis', aliases: [] },
  { label: 'Jira', aliases: [] },
  { label: 'Figma', aliases: [] },
  { label: 'Microsoft Excel', aliases: ['excel', 'advanced excel'] },
  { label: 'Power BI', aliases: ['powerbi'] },
  { label: 'Tableau', aliases: [] },
  { label: 'Apache Spark', aliases: ['spark', 'pyspark'] },
  { label: 'Hadoop', aliases: [] },
  { label: 'Airflow', aliases: ['apache airflow'] },
  { label: 'MLOps', aliases: ['ml ops'] },
  { label: 'LLM', aliases: ['large language models', 'large language model'] },
  { label: 'Generative AI', aliases: ['genai', 'gen ai'] },
  { label: 'Computer Vision', aliases: ['cv'] },
  { label: 'Data Visualization', aliases: ['data visualisation'] },
  { label: 'Matplotlib', aliases: [] },
  { label: 'Seaborn', aliases: [] },
  { label: 'Jupyter', aliases: ['jupyter notebook'] },
  { label: 'Linux', aliases: ['unix'] },
  { label: 'Agile', aliases: ['agile methodology', 'agile methodologies'] },
  { label: 'Scrum', aliases: [] },
  { label: 'Communication', aliases: ['communication skills', 'written communication', 'verbal communication'] },
  { label: 'Analytical Skills', aliases: ['analytical thinking', 'analytical', 'analysis skills'] },
  { label: 'Problem Solving', aliases: ['problem-solving', 'problem solving skills'] },
  { label: 'Teamwork', aliases: ['team work', 'collaboration', 'collaborative'] },
  { label: 'Leadership', aliases: ['team leadership'] },
  { label: 'Presentation Skills', aliases: ['presentation', 'public speaking'] },
  { label: 'Data Structures', aliases: [] },
  { label: 'Algorithms', aliases: ['algorithm design'] },
  { label: 'Database Design', aliases: ['database modeling', 'data modeling', 'schema design'] },
  { label: 'Object-Oriented Programming', aliases: ['oop', 'object oriented programming', 'object-oriented design'] },
  { label: 'Unit Testing', aliases: ['unit tests', 'testing'] },
  { label: 'CI/CD', aliases: ['cicd', 'continuous integration', 'continuous deployment'] },
  { label: 'Jest', aliases: [] },
  { label: 'Vitest', aliases: [] },
  { label: 'pytest', aliases: [] },
];

export function normalizeForCompare(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/([+#])/g, ' $1 ')
    .replace(/[^\p{L}\p{N}+#]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const ALIAS_TO_LABEL = new Map<string, string>();
const LABEL_BY_KEY = new Map<string, string>();
const ALIASES_BY_KEY = new Map<string, Set<string>>();

for (const skill of SKILLS) {
  const key = normalizeForCompare(skill.label);
  LABEL_BY_KEY.set(key, skill.label);
  ALIAS_TO_LABEL.set(key, skill.label);
  const set = new Set<string>([key]);
  for (const alias of skill.aliases) {
    const normalized = normalizeForCompare(alias);
    ALIAS_TO_LABEL.set(normalized, skill.label);
    set.add(normalized);
  }
  ALIASES_BY_KEY.set(key, set);
}

export function skillLabel(value: string): string {
  const normalized = normalizeForCompare(value);
  return ALIAS_TO_LABEL.get(normalized) ?? titleCase(value);
}

/** Returns a stable canonical key, e.g. "react.js" -> "react". */
export function canonicalSkill(value: string): string {
  const normalized = normalizeForCompare(value);
  const label = ALIAS_TO_LABEL.get(normalized);
  return label ? normalizeForCompare(label) : normalized;
}

export function titleCase(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, ' ')
    .split(' ')
    .map((word) => {
      if (/^[A-Z0-9+#.]{2,}$/.test(word)) return word;
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
}

/** True when the given text mentions the skill or one of its aliases. */
export function textHasSkill(text: string, skill: string): boolean {
  const key = canonicalSkill(skill);
  const aliases = ALIASES_BY_KEY.get(key);
  const normalizedText = ` ${normalizeForCompare(text)} `;
  if (!aliases) return normalizedText.includes(` ${normalizeForCompare(skill)} `);
  for (const alias of aliases) {
    if (!alias) continue;
    if (alias.length <= 2 && alias !== 'go' && alias !== 'ml' && alias !== 'dl' && alias !== 'js' && alias !== 'ts') {
      continue;
    }
    if (normalizedText.includes(` ${alias} `)) return true;
  }
  return false;
}

export function extractSkills(text: string): string[] {
  const found: string[] = [];
  for (const [key, label] of LABEL_BY_KEY) {
    if (textHasSkill(text, key)) found.push(label);
  }
  return Array.from(new Set(found));
}

export const STOPWORDS = new Set(
  `a about above after again against all am an and any are aren't as at be because been before being below between both but by can cannot could couldn't did didn't do does doesn't doing don't down during each few for from further had hadn't has hasn't have haven't having he her here hers herself him himself his how i if in into is isn't it its itself let's me more most mustn't my myself no nor not of off on once only or other ought our ours ourselves out over own same shan't she should shouldn't so some such than that the their theirs them themselves then there these they this those through to too under until up very was wasn't we were weren't what when where which while who whom why will with won't would wouldn't you your yours yourself yourselves role job work working team teams company candidate ideal looking join help using use used able strong good excellent experience experienced year years required requirements preferred plus etc across also within well new including include includes ensure ensuring provide provided support supporting develop developing developed build building built design designing create creating maintain maintaining collaborate collaborating contribute contributions understanding knowledge familiarity proficient proficiency ability abilities skills skill technologies technology tools tool environment opportunity opportunities benefits salary apply application applicants position`
    .split(/\s+/)
    .filter(Boolean),
);

const GENERIC_MATCH_WORDS = new Set([
  ...STOPWORDS,
  'using',
  'build',
  'built',
  'develop',
  'developed',
  'design',
  'designed',
  'work',
  'worked',
  'project',
  'projects',
  'experience',
  'skills',
  'knowledge',
  'understanding',
  'familiarity',
  'ability',
  'strong',
  'good',
  'excellent',
  'able',
  'plus',
  'preferred',
  'required',
  'responsibilities',
  'requirements',
  'qualifications',
  'candidate',
  'role',
  'team',
  'company',
]);

export function tokenize(value: string): string[] {
  return normalizeForCompare(value)
    .split(' ')
    .map((token) => token.replace(/^[+#]+|[+#]+$/g, ''))
    .filter((token) => token.length >= 2 && !GENERIC_MATCH_WORDS.has(token));
}

/** Overlap of meaningful tokens, 0..1. Used as a relevance signal, not proof. */
export function tokenOverlap(requirement: string, corpus: string): number {
  const requirementTokens = new Set(tokenize(requirement));
  if (requirementTokens.size === 0) return 0;
  const corpusTokens = new Set(tokenize(corpus));
  let hits = 0;
  for (const token of requirementTokens) {
    if (corpusTokens.has(token)) hits += 1;
  }
  return hits / requirementTokens.size;
}

export function splitSentences(text: string): string[] {
  return text
    .split(/\n+|(?<=[.!?])\s+(?=[A-Z0-9])/g)
    .map((line) => stripListMarker(line))
    .filter((line) => line.length > 2);
}

/**
 * Removes bullet/numbering markers without destroying leading values such as
 * "0-2 years of experience". Only separators that look like list syntax are
 * removed, so ranges at the start of a line survive extraction.
 */
export function stripListMarker(value: string): string {
  return value
    .replace(/^[\s\u2022\u25CF\u25AA\u25E6*]+/u, '')
    .replace(/^[-\u2013\u2014]\s+/u, '')
    .replace(/^\d{1,2}[.)]\s+/u, '')
    .trim();
}

export function splitList(value: string): string[] {
  return value
    .split(/[,;\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function uniqueBy<T>(items: T[], key: (item: T) => string): T[] {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const item of items) {
    const value = key(item);
    if (seen.has(value)) continue;
    seen.add(value);
    result.push(item);
  }
  return result;
}

export function containsAny(text: string, needles: string[]): boolean {
  const haystack = normalizeForCompare(text);
  return needles.some((needle) => haystack.includes(normalizeForCompare(needle)));
}

/** Text similarity for ranking records against requirements. */
export function relevanceScore(requirement: string, text: string, skills: string[]): number {
  let score = 0;
  const overlap = tokenOverlap(requirement, text);
  score += overlap * 50;
  const matchedSkills = skills.filter((skill) => textHasSkill(requirement, skill));
  score += matchedSkills.length * 35;
  return Math.min(100, Math.round(score));
}
