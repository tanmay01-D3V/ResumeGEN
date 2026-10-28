/**
 * Canonical portfolio categories, display metadata and form field descriptors.
 * Shared by the API (validation + Google Sheets columns) and the React client.
 */

export const PORTFOLIO_CATEGORIES = [
  'personal_info',
  'summary',
  'education',
  'technical_skills',
  'soft_skills',
  'certifications',
  'projects',
  'experience',
  'achievements',
  'publications',
  'extracurriculars',
  'languages',
  'competencies',
] as const;

export type PortfolioCategory = (typeof PORTFOLIO_CATEGORIES)[number];

export type FieldType =
  | 'text'
  | 'textarea'
  | 'date'
  | 'url'
  | 'email'
  | 'tel'
  | 'list'
  | 'number'
  | 'boolean';

export interface CategoryField {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  placeholder?: string;
  help?: string;
  maxLength?: number;
}

export interface CategoryMeta {
  label: string;
  singular: string;
  description: string;
  /** Single-record categories render as one editable profile card. */
  singleton?: boolean;
  /** Section key used by the resume assembler. */
  resumeSection?:
    | 'summary'
    | 'skills'
    | 'experience'
    | 'projects'
    | 'education'
    | 'certifications'
    | 'achievements'
    | 'publications'
    | 'extracurriculars'
    | 'languages'
    | 'competencies';
  fields: CategoryField[];
}

const date = (key: string, label: string): CategoryField => ({
  key,
  label,
  type: 'date',
  placeholder: '2024-06 or May 2024',
});

export const CATEGORY_META: Record<PortfolioCategory, CategoryMeta> = {
  personal_info: {
    label: 'Personal Information',
    singular: 'Personal Information',
    description: 'Contact details used at the top of every resume.',
    singleton: true,
    fields: [
      { key: 'fullName', label: 'Full name', type: 'text', required: true, maxLength: 120 },
      { key: 'headline', label: 'Professional headline', type: 'text', placeholder: 'Machine Learning Engineer', maxLength: 160 },
      { key: 'email', label: 'Professional email', type: 'email', required: true, maxLength: 160 },
      { key: 'phone', label: 'Phone number', type: 'tel', maxLength: 40 },
      { key: 'location', label: 'Location', type: 'text', placeholder: 'Pune, India', maxLength: 120 },
      { key: 'linkedinUrl', label: 'LinkedIn URL', type: 'url', maxLength: 300 },
      { key: 'githubUrl', label: 'GitHub URL', type: 'url', maxLength: 300 },
      { key: 'portfolioUrl', label: 'Portfolio URL', type: 'url', maxLength: 300 },
    ],
  },
  summary: {
    label: 'Professional Summary',
    singular: 'Professional Summary',
    description: 'Your reusable headline, summary and preferred roles.',
    singleton: true,
    resumeSection: 'summary',
    fields: [
      { key: 'headline', label: 'Headline', type: 'text', required: true, maxLength: 160 },
      { key: 'summaryText', label: 'Summary', type: 'textarea', required: true, maxLength: 2000 },
      { key: 'careerObjective', label: 'Career objective', type: 'textarea', maxLength: 1000 },
      { key: 'preferredRoles', label: 'Preferred roles', type: 'list', placeholder: 'ML Engineer, Data Scientist' },
    ],
  },
  education: {
    label: 'Education',
    singular: 'Education entry',
    description: 'Degrees and academic credentials.',
    resumeSection: 'education',
    fields: [
      { key: 'institution', label: 'Institution', type: 'text', required: true, maxLength: 200 },
      { key: 'degree', label: 'Degree', type: 'text', required: true, maxLength: 160 },
      { key: 'fieldOfStudy', label: 'Field of study', type: 'text', maxLength: 160 },
      date('startDate', 'Start date'),
      date('endDate', 'End date'),
      { key: 'grade', label: 'Grade / CGPA', type: 'text', maxLength: 60 },
      { key: 'coursework', label: 'Relevant coursework', type: 'list', placeholder: 'Machine Learning, DBMS' },
      { key: 'description', label: 'Description', type: 'textarea', maxLength: 1200 },
    ],
  },
  technical_skills: {
    label: 'Technical Skills',
    singular: 'Technical skill',
    description: 'Verified tools, languages and frameworks.',
    resumeSection: 'skills',
    fields: [
      { key: 'name', label: 'Skill', type: 'text', required: true, maxLength: 100 },
      { key: 'category', label: 'Category', type: 'text', placeholder: 'Languages / ML / Web', maxLength: 80 },
      {
        key: 'proficiency',
        label: 'Proficiency',
        type: 'text',
        placeholder: 'Beginner / Intermediate / Advanced',
        help: 'Only state a level you can defend in an interview.',
        maxLength: 40,
      },
      { key: 'yearsExperience', label: 'Years of experience', type: 'number', maxLength: 20 },
      { key: 'evidence', label: 'Evidence', type: 'list', placeholder: 'Used in churn prediction project' },
      { key: 'relatedProjects', label: 'Related projects', type: 'list' },
    ],
  },
  soft_skills: {
    label: 'Soft Skills',
    singular: 'Soft skill',
    description: 'Communication, collaboration and other interpersonal strengths.',
    resumeSection: 'skills',
    fields: [
      { key: 'name', label: 'Skill', type: 'text', required: true, maxLength: 100 },
      { key: 'evidence', label: 'Evidence', type: 'textarea', maxLength: 600 },
    ],
  },
  certifications: {
    label: 'Certifications & Courses',
    singular: 'Certification',
    description: 'Completed courses and certifications with verifiable details.',
    resumeSection: 'certifications',
    fields: [
      { key: 'name', label: 'Certification name', type: 'text', required: true, maxLength: 200 },
      { key: 'issuer', label: 'Issuer', type: 'text', required: true, maxLength: 160 },
      date('issueDate', 'Issue date'),
      date('expiryDate', 'Expiry date'),
      { key: 'credentialId', label: 'Credential ID', type: 'text', maxLength: 120 },
      { key: 'credentialUrl', label: 'Credential URL', type: 'url', maxLength: 300 },
      { key: 'description', label: 'Description', type: 'textarea', maxLength: 800 },
    ],
  },
  projects: {
    label: 'Projects',
    singular: 'Project',
    description: 'Academic, personal and professional projects with evidence.',
    resumeSection: 'projects',
    fields: [
      { key: 'name', label: 'Project name', type: 'text', required: true, maxLength: 200 },
      { key: 'role', label: 'Your role', type: 'text', maxLength: 120 },
      { key: 'description', label: 'Description', type: 'textarea', required: true, maxLength: 2000 },
      { key: 'problemSolved', label: 'Problem solved', type: 'textarea', maxLength: 1000 },
      { key: 'technologies', label: 'Technologies', type: 'list', placeholder: 'Python, scikit-learn, pandas' },
      { key: 'responsibilities', label: 'Responsibilities', type: 'list' },
      { key: 'achievements', label: 'Achievements / results', type: 'list', placeholder: 'Improving accuracy from 81% to 89%' },
      { key: 'metrics', label: 'Metrics', type: 'list', placeholder: '89% accuracy on held-out test set' },
      date('startDate', 'Start date'),
      date('endDate', 'End date'),
      { key: 'repoUrl', label: 'Repository URL', type: 'url', maxLength: 300 },
      { key: 'demoUrl', label: 'Demo URL', type: 'url', maxLength: 300 },
    ],
  },
  experience: {
    label: 'Internships & Work Experience',
    singular: 'Experience',
    description: 'Employment and internships with verified responsibilities.',
    resumeSection: 'experience',
    fields: [
      { key: 'organization', label: 'Organization', type: 'text', required: true, maxLength: 200 },
      { key: 'jobTitle', label: 'Job title', type: 'text', required: true, maxLength: 160 },
      {
        key: 'employmentType',
        label: 'Employment type',
        type: 'text',
        placeholder: 'Internship / Full-time / Part-time',
        maxLength: 60,
      },
      { key: 'location', label: 'Location', type: 'text', maxLength: 120 },
      date('startDate', 'Start date'),
      date('endDate', 'End date'),
      { key: 'current', label: 'Current role?', type: 'boolean' },
      { key: 'responsibilities', label: 'Responsibilities', type: 'list' },
      { key: 'achievements', label: 'Verified achievements', type: 'list' },
      { key: 'technologies', label: 'Technologies', type: 'list' },
      { key: 'metrics', label: 'Metrics', type: 'list' },
    ],
  },
  achievements: {
    label: 'Achievements & Awards',
    singular: 'Achievement',
    description: 'Awards, recognitions and measurable accomplishments.',
    resumeSection: 'achievements',
    fields: [
      { key: 'title', label: 'Title', type: 'text', required: true, maxLength: 200 },
      { key: 'organization', label: 'Awarding body', type: 'text', maxLength: 160 },
      date('date', 'Date'),
      { key: 'description', label: 'Description', type: 'textarea', maxLength: 1000 },
      { key: 'metric', label: 'Verifiable metric', type: 'text', maxLength: 120 },
    ],
  },
  publications: {
    label: 'Research & Publications',
    singular: 'Publication',
    description: 'Papers, articles and research outputs.',
    resumeSection: 'publications',
    fields: [
      { key: 'title', label: 'Paper title', type: 'text', required: true, maxLength: 300 },
      { key: 'authors', label: 'Authors', type: 'list' },
      { key: 'venue', label: 'Venue / journal', type: 'text', maxLength: 200 },
      date('date', 'Publication date'),
      { key: 'doi', label: 'DOI', type: 'text', maxLength: 120 },
      { key: 'url', label: 'URL', type: 'url', maxLength: 300 },
      { key: 'description', label: 'Abstract / contribution', type: 'textarea', maxLength: 1200 },
    ],
  },
  extracurriculars: {
    label: 'Extracurricular Activities',
    singular: 'Activity',
    description: 'Leadership, volunteering and community involvement.',
    resumeSection: 'extracurriculars',
    fields: [
      { key: 'role', label: 'Role', type: 'text', required: true, maxLength: 160 },
      { key: 'organization', label: 'Organization', type: 'text', required: true, maxLength: 200 },
      date('startDate', 'Start date'),
      date('endDate', 'End date'),
      { key: 'description', label: 'Description', type: 'textarea', maxLength: 1000 },
    ],
  },
  languages: {
    label: 'Languages',
    singular: 'Language',
    description: 'Spoken and written languages.',
    resumeSection: 'languages',
    fields: [
      { key: 'name', label: 'Language', type: 'text', required: true, maxLength: 80 },
      { key: 'proficiency', label: 'Proficiency', type: 'text', placeholder: 'Native / Fluent / Intermediate', maxLength: 60 },
      { key: 'testScore', label: 'Test score', type: 'text', maxLength: 80 },
    ],
  },
  competencies: {
    label: 'Additional Competencies',
    singular: 'Competency',
    description: 'Other professional competencies worth surfacing.',
    resumeSection: 'competencies',
    fields: [
      { key: 'name', label: 'Competency', type: 'text', required: true, maxLength: 120 },
      { key: 'description', label: 'Description', type: 'textarea', maxLength: 600 },
      { key: 'level', label: 'Level', type: 'text', maxLength: 60 },
    ],
  },
};

export function isPortfolioCategory(value: unknown): value is PortfolioCategory {
  return typeof value === 'string' && (PORTFOLIO_CATEGORIES as readonly string[]).includes(value);
}

/** Tabs required by the assignment, mapped to their category sets. */
export const SHEET_TABS: Array<{ name: string; categories: PortfolioCategory[] }> = [
  { name: 'PersonalInfo', categories: ['personal_info'] },
  { name: 'Summary', categories: ['summary'] },
  { name: 'Education', categories: ['education'] },
  { name: 'Skills', categories: ['technical_skills', 'soft_skills', 'competencies'] },
  { name: 'Certifications', categories: ['certifications'] },
  { name: 'Projects', categories: ['projects'] },
  { name: 'Experience', categories: ['experience'] },
  { name: 'Achievements', categories: ['achievements'] },
  { name: 'Publications', categories: ['publications'] },
  { name: 'Activities', categories: ['extracurriculars'] },
  { name: 'Languages', categories: ['languages'] },
  { name: 'Metadata', categories: [] },
];
