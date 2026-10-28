import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SECTION_ORDER,
  containsUnsupportedNumericClaim,
  normalizeRecordData,
  portfolioRecordInputSchema,
  resumeSettingsSchema,
  validateRecordData,
} from '../../shared/schemas';

describe('portfolio schemas and normalisation', () => {
  it('normalises loosely typed form input into the canonical shape', () => {
    const normalised = normalizeRecordData('projects', {
      name: '  Churn predictor  ',
      description: '  Built a churn prediction pipeline with measurable results.  ',
      technologies: 'Python, scikit-learn; pandas\nNumPy',
      achievements: ['  Reduced churn by 12%  ', '', 'Published evaluation notebook'],
      startDate: '',
      unknown: 'ignored',
    });

    expect(normalised).toEqual({
      name: 'Churn predictor',
      description: 'Built a churn prediction pipeline with measurable results.',
      technologies: ['Python', 'scikit-learn', 'pandas', 'NumPy'],
      achievements: ['Reduced churn by 12%', 'Published evaluation notebook'],
    });
    expect(normalised.unknown).toBeUndefined();
  });

  it('rejects missing required fields and invalid emails', () => {
    const missing = validateRecordData('projects', { name: 'Only a name' });
    expect(missing.success).toBe(false);

    const badEmail = validateRecordData('personal_info', {
      fullName: 'Ada Lovelace',
      email: 'not-an-email',
    });
    expect(badEmail.success).toBe(false);

    const good = validateRecordData('personal_info', {
      fullName: 'Ada Lovelace',
      email: 'ada@example.com',
      linkedinUrl: 'linkedin.com/in/ada',
    });
    expect(good.success).toBe(true);
  });

  it('accepts protocol-less profile URLs but rejects javascript: URLs', () => {
    const base = {
      category: 'personal_info' as const,
      title: 'Ada Lovelace',
      data: { fullName: 'Ada Lovelace', email: 'ada@example.com' },
      tags: [],
    };

    expect(
      portfolioRecordInputSchema.safeParse({
        ...base,
        data: { ...base.data, githubUrl: 'github.com/ada' },
      }).success,
    ).toBe(true);

    expect(
      portfolioRecordInputSchema.safeParse({
        ...base,
        data: { ...base.data, portfolioUrl: 'javascript:alert(1)' },
      }).success,
    ).toBe(false);
  });

  it('coerces numeric and boolean fields without accepting impossible values', () => {
    const normalised = normalizeRecordData('experience', {
      organization: 'Acme',
      jobTitle: 'Engineer',
      current: 'yes',
      responsibilities: 'Built APIs',
    });
    expect(normalised.current).toBe(true);

    const invalidYears = validateRecordData('technical_skills', {
      name: 'Python',
      yearsExperience: '99',
    });
    expect(invalidYears.success).toBe(false);
  });
});

describe('resume settings', () => {
  it('applies safe defaults for template and layout', () => {
    const parsed = resumeSettingsSchema.parse({
      sectionOrder: DEFAULT_SECTION_ORDER,
      contactOverrides: {},
    });
    expect(parsed.template).toBe('classic');
    expect(parsed.layout).toBe('one_page');
  });

  it('requires at least one section and rejects unknown section keys', () => {
    expect(resumeSettingsSchema.safeParse({ sectionOrder: [], contactOverrides: {} }).success).toBe(false);
    expect(
      resumeSettingsSchema.safeParse({
        sectionOrder: ['summary', 'made_up_section'],
        contactOverrides: {},
      }).success,
    ).toBe(false);
  });
});

describe('unsupported numeric claim detection', () => {
  it('flags numbers that are absent from the source evidence', () => {
    const source = 'Built a churn model with 87% accuracy for a university project.';
    expect(containsUnsupportedNumericClaim('Improved accuracy to 95%.', source)).toEqual(['95']);
    expect(containsUnsupportedNumericClaim('Reached 87% accuracy.', source)).toEqual([]);
  });

  it('allows exact numbers present in source evidence, including percentages', () => {
    expect(containsUnsupportedNumericClaim('Served 1,200 users in 2024.', 'Grew to 1,200 users in 2024')).toEqual([]);
  });
});
