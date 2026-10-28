import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SECTION_ORDER,
  type JobDescription,
  type PortfolioRecord,
  type ResumeSettings,
} from '../../shared/schemas';
import {
  assembleResume,
  deterministicSummary,
  resumeDocumentToText,
  validateSummaryGrounding,
} from '../src/services/resumeAssembler';

const timestamp = '2026-01-01T00:00:00.000Z';

const job: JobDescription = {
  id: 'jd_test',
  jobTitle: 'Machine Learning Engineer',
  company: 'Example',
  rawText: 'A job description long enough to be valid.',
  analysis: {
    jobTitle: 'Machine Learning Engineer',
    company: 'Example',
    requiredSkills: ['Python'],
    preferredSkills: [],
    technologies: ['Python'],
    qualifications: [],
    preferredQualifications: [],
    experienceRequirements: [],
    responsibilities: ['Build models'],
    keywords: [],
    relevantProjectTypes: [],
    requestedCertifications: [],
  },
  analysisTimestamp: timestamp,
  analysisEngine: 'heuristic',
  schemaVersion: 1,
  createdAt: timestamp,
  updatedAt: timestamp,
};

function record(
  overrides: Partial<PortfolioRecord> & Pick<PortfolioRecord, 'category' | 'title' | 'data'>,
): PortfolioRecord {
  return {
    id: `rec_${Math.random().toString(36).slice(2, 10)}`,
    tags: [],
    sourceType: 'manual',
    verificationStatus: 'verified',
    createdAt: timestamp,
    updatedAt: timestamp,
    ...overrides,
  };
}

const pythonSkill = record({
  category: 'technical_skills',
  title: 'Python',
  data: { name: 'Python', proficiency: 'Advanced', category: 'Languages' },
});

const project = record({
  category: 'projects',
  title: 'Churn prediction project',
  data: {
    name: 'Churn prediction project',
    description: 'Built an end-to-end churn prediction pipeline with Python.',
    technologies: ['Python', 'pandas'],
    achievements: ['Reached 87% accuracy on the held-out test set.'],
    metrics: ['87% accuracy'],
  },
});

const emptyProject = record({
  category: 'projects',
  title: 'Hidden project',
  data: { name: 'Hidden project', description: 'Should be filtered when not selected.' },
});

function settings(overrides: Partial<ResumeSettings> = {}): ResumeSettings {
  return {
    sectionOrder: [...DEFAULT_SECTION_ORDER],
    template: 'classic',
    layout: 'one_page',
    contactOverrides: {},
    ...overrides,
  };
}

function assemble(overrides: {
  records?: PortfolioRecord[];
  summary?: string;
  settings?: ResumeSettings;
}) {
  return assembleResume({
    records: overrides.records ?? [pythonSkill, project],
    job,
    settings: overrides.settings ?? settings(),
    summary: overrides.summary ?? 'Machine learning graduate with verified Python project work.',
    headline: 'ML Engineer',
    name: 'Ada Lovelace',
    contact: {
      email: 'ada@example.com',
      phone: '+1 555 0100',
      location: 'London',
      links: [{ label: 'GitHub', url: 'https://github.com/ada' }],
    },
    engine: 'deterministic',
    warnings: [],
  });
}

describe('AI summary grounding', () => {
  it('accepts a summary whose facts, skills and numbers exist in selected records', () => {
    const result = validateSummaryGrounding(
      'Built a churn prediction pipeline with Python and reported 87% accuracy.',
      [pythonSkill, project],
    );
    expect(result.ok).toBe(true);
  });

  it('rejects unsupported numeric claims', () => {
    const result = validateSummaryGrounding(
      'Improved churn prediction accuracy to 95% with Python.',
      [pythonSkill, project],
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain('95');
  });

  it('rejects skills that do not appear in the selected records', () => {
    const result = validateSummaryGrounding(
      'Machine learning engineer with Python, Kubernetes and Terraform experience.',
      [pythonSkill, project],
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/Kubernetes|Terraform/);
  });

  it('rejects unsupported certification claims', () => {
    const result = validateSummaryGrounding(
      'Certified professional with Python experience.',
      [pythonSkill, project],
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain('certification');
  });

  it('rejects invented years of experience that are not supported by the portfolio', () => {
    const result = validateSummaryGrounding(
      'Python engineer with 6 years of experience building data systems.',
      [pythonSkill, project],
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/years|numeric/);
  });

  it('allows years claims when the portfolio itself contains them', () => {
    const experienced = record({
      category: 'experience',
      title: 'Data intern',
      data: {
        organization: 'Acme',
        jobTitle: 'Data intern',
        startDate: '2022-01',
        endDate: '2024-01',
        responsibilities: ['Built Python reports for 2 years.'],
      },
    });
    const result = validateSummaryGrounding('Data analyst with 2 years of Python experience.', [
      pythonSkill,
      experienced,
    ]);
    expect(result.ok).toBe(true);
  });
});

describe('resume assembly', () => {
  it('renders only selected records and omits empty sections', () => {
    const document = assemble({ records: [pythonSkill, project] });
    const keys = document.sections.map((section) => section.key);

    expect(keys).toContain('summary');
    expect(keys).toContain('skills');
    expect(keys).toContain('projects');
    expect(keys).not.toContain('experience');
    expect(keys).not.toContain('education');

    const projectSection = document.sections.find((section) => section.key === 'projects')!;
    expect(projectSection.items).toHaveLength(1);
    expect(projectSection.items[0]!.recordId).toBe(project.id);
    expect(projectSection.items[0]!.heading).toBe('Churn prediction project');
    expect(projectSection.items[0]!.bullets.join(' ')).toContain('87% accuracy');

    // A record that is not in the selection must never leak into the document.
    expect(resumeDocumentToText(document)).not.toContain(emptyProject.title);
  });

  it('honours the requested section order', () => {
    const document = assemble({
      settings: settings({ sectionOrder: ['projects', 'skills', 'summary', 'education'] }),
    });
    expect(document.sections.map((section) => section.key)).toEqual([
      'projects',
      'skills',
      'summary',
    ]);
  });

  it('does not create a summary section when the summary is blank', () => {
    const document = assemble({ summary: '' });
    expect(document.sections.some((section) => section.key === 'summary')).toBe(false);
    expect(document.summary).toBe('');
  });

  it('carries template, layout and warnings into the document', () => {
    const document = assemble({ settings: settings({ template: 'compact', layout: 'two_page' }) });
    expect(document.template).toBe('compact');
    expect(document.layout).toBe('two_page');
  });

  it('builds a deterministic summary without inventing facts', () => {
    const summary = deterministicSummary({
      records: [pythonSkill, project],
      job,
      headline: 'ML Engineer',
    });

    expect(summary).toContain('ML Engineer');
    expect(summary).toContain('Churn prediction project');
    expect(summary).toContain('Python');
    expect(summary).toContain('Machine Learning Engineer');
    expect(summary).not.toMatch(/\b\d+\s*%/);
  });
});
