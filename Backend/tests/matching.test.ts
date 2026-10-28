import { describe, expect, it } from 'vitest';
import {
  jdAnalysisSchema,
  type JDAnalysis,
  type PortfolioRecord,
} from '../../shared/schemas';
import { matchDeterministic, mergeGeminiMatches } from '../src/services/matchingService';

const timestamp = '2026-01-01T00:00:00.000Z';

function analysis(overrides: Partial<JDAnalysis> = {}): JDAnalysis {
  return jdAnalysisSchema.parse({
    jobTitle: 'Test Role',
    company: 'Test Co',
    ...overrides,
  });
}

function record(overrides: Partial<PortfolioRecord> & Pick<PortfolioRecord, 'category' | 'title' | 'data'>): PortfolioRecord {
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

function skillRecord(name: string, verified = true) {
  return record({
    category: 'technical_skills',
    title: name,
    verificationStatus: verified ? 'verified' : 'needs_review',
    data: { name, proficiency: 'Advanced', evidence: [`Used ${name} in a project`] },
  });
}

function projectRecord(title: string, data: Record<string, unknown>, verified = true) {
  return record({
    category: 'projects',
    title,
    verificationStatus: verified ? 'verified' : 'needs_review',
    data: {
      name: title,
      description: 'A verified project used to demonstrate matching behaviour.',
      ...data,
    },
  });
}

describe('deterministic matching', () => {
  it('classifies strong, partial and missing requirements from real records only', () => {
    const python = skillRecord('Python');
    const rustProject = projectRecord('Embedded controller', { technologies: ['Rust'] }, false);
    const records = [python, rustProject];

    const result = matchDeterministic(
      'jd_1',
      analysis({
        requiredSkills: ['Python', 'Rust', 'Kubernetes'],
        preferredSkills: ['Docker'],
      }),
      records,
    );

    const byRequirement = new Map(result.matches.map((match) => [match.requirement, match]));
    expect(byRequirement.get('Python')?.status).toBe('strong');
    expect(byRequirement.get('Python')?.recordIds).toEqual([python.id]);
    expect(byRequirement.get('Python')?.matchKind).toBe('exact');

    // The only Rust record is unverified, so it must not count as evidence.
    expect(byRequirement.get('Rust')?.status).toBe('not_evidenced');
    expect(byRequirement.get('Rust')?.recordIds).toEqual([]);

    // A job keyword is never proof of a skill.
    expect(byRequirement.get('Kubernetes')?.status).toBe('not_evidenced');
    expect(byRequirement.get('Docker')?.status).toBe('not_evidenced');

    expect(result.missingRequirements).toEqual(
      expect.arrayContaining(['Rust', 'Kubernetes', 'Docker']),
    );
    expect(result.engine).toBe('deterministic');
  });

  it('handles skill aliases and partial evidence without upgrading it', () => {
    const react = skillRecord('React');
    const partial = projectRecord('Frontend work', {
      description: 'Some experience maintaining a React dashboard during a course.',
    });
    const other = skillRecord('Python');

    const result = matchDeterministic(
      'jd_2',
      analysis({ requiredSkills: ['React.js', 'Python'] }),
      [react, partial, other],
    );

    const reactMatch = result.matches.find((match) => match.requirement === 'React.js');
    expect(reactMatch?.status).toBe('strong');
    expect(reactMatch?.recordIds).toContain(react.id);
    expect(reactMatch?.matchKind).toBe('exact');

    // "React" in a project description is related evidence, not a verified skill entry.
    expect(reactMatch?.recordIds).toContain(partial.id);
  });

  it('scores narrative requirements against projects and experience', () => {
    const project = projectRecord('Reporting API', {
      description: 'Built REST APIs with PostgreSQL for a reporting dashboard.',
      technologies: ['Node.js', 'PostgreSQL'],
    });

    const result = matchDeterministic(
      'jd_3',
      analysis({
        responsibilities: ['Build REST APIs with PostgreSQL'],
        qualifications: [],
      }),
      [project],
    );

    const match = result.matches[0]!;
    expect(match.requirementType).toBe('responsibility');
    expect(match.status).toBe('strong');
    expect(match.recordIds).toContain(project.id);
    expect(match.evidence[0]!.excerpt).toContain('Reporting API');

    expect(result.rankedRecords[0]!.recordId).toBe(project.id);
    expect(result.rankedRecords[0]!.relevance).toBeGreaterThan(0);
  });

  it('excludes personal information and summary records from matching', () => {
    const personal = record({
      category: 'personal_info',
      title: 'Ada Lovelace',
      data: { fullName: 'Ada Lovelace', email: 'ada@example.com', headline: 'Python developer' },
    });
    const summary = record({
      category: 'summary',
      title: 'Summary',
      data: { headline: 'Engineer', summaryText: 'Python and PostgreSQL developer.', preferredRoles: [] },
    });

    const result = matchDeterministic('jd_4', analysis({ requiredSkills: ['Python'] }), [
      personal,
      summary,
    ]);

    expect(result.matches[0]!.status).toBe('not_evidenced');
    expect(result.rankedRecords).toEqual([]);
  });

  it('caps evidence lists and keeps matches bounded', () => {
    const records = Array.from({ length: 10 }, (_, index) =>
      record({
        category: 'technical_skills',
        title: `Python ${index}`,
        data: { name: 'Python', proficiency: 'Advanced' },
      }),
    );

    const result = matchDeterministic('jd_5', analysis({ requiredSkills: ['Python'] }), records);
    expect(result.matches[0]!.recordIds.length).toBeLessThanOrEqual(4);
    expect(result.matches[0]!.evidence.length).toBeLessThanOrEqual(4);
  });
});

describe('Gemini match merging guardrails', () => {
  const project = projectRecord('Analytics pipeline', {
    description: 'Built preprocessing pipelines for messy customer datasets.',
    technologies: ['Python', 'pandas'],
  });

  function deterministicFor(requirement: string) {
    return matchDeterministic('jd_ai', analysis({ requiredSkills: [requirement] }), [project]);
  }

  it('ignores fabricated record IDs', () => {
    const deterministic = deterministicFor('Python');
    const merged = mergeGeminiMatches(
      deterministic,
      {
        matches: [
          {
            requirement: 'Python',
            requirementType: 'required_skill',
            recordIds: ['rec_does_not_exist'],
            status: 'strong',
            explanation: 'Trust me.',
          },
        ],
      },
      [project],
    );

    expect(merged.matches[0]).toEqual(deterministic.matches[0]);
    expect(merged.engine).toBe('gemini+deterministic');
  });

  it('cannot upgrade a partial match to strong without verified explicit evidence', () => {
    const deterministic = deterministicFor('Python');
    expect(deterministic.matches[0]!.status).toBe('strong');

    const merged = mergeGeminiMatches(
      deterministic,
      {
        matches: [
          {
            requirement: 'Python',
            requirementType: 'required_skill',
            recordIds: [project.id],
            status: 'partial',
            explanation: 'Semantic similarity.',
          },
        ],
      },
      [project],
    );

    // A downgrade from the AI is never applied.
    expect(merged.matches[0]!.status).toBe('strong');
  });

  it('adds semantic evidence only as partial, never as a new strong claim', () => {
    const deterministic = deterministicFor('Data Preprocessing');
    expect(deterministic.matches[0]!.status).toBe('not_evidenced');

    const merged = mergeGeminiMatches(
      deterministic,
      {
        matches: [
          {
            requirement: 'Data Preprocessing',
            requirementType: 'required_skill',
            recordIds: [project.id],
            status: 'strong',
            explanation: 'The project mentions preprocessing pipelines.',
          },
        ],
      },
      [project],
    );

    expect(merged.matches[0]!.status).toBe('partial');
    expect(merged.matches[0]!.recordIds).toContain(project.id);
    expect(merged.matches[0]!.matchKind).toBe('related');
    expect(merged.matches[0]!.explanation).toContain('re-verified');
    expect(merged.missingRequirements).not.toContain('Data Preprocessing');
  });

  it('drops AI evidence when the record has no textual overlap with the requirement', () => {
    const deterministic = deterministicFor('Kubernetes');
    const merged = mergeGeminiMatches(
      deterministic,
      {
        matches: [
          {
            requirement: 'Kubernetes',
            requirementType: 'required_skill',
            recordIds: [project.id],
            status: 'partial',
            explanation: 'Probably relevant.',
          },
        ],
      },
      [project],
    );

    expect(merged.matches[0]!.status).toBe('not_evidenced');
    expect(merged.matches[0]!.recordIds).toEqual([]);
  });
});
