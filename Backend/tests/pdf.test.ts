import { describe, expect, it } from 'vitest';
import type { ResumeDocument } from '../../shared/schemas';
import { renderResumePdf, resumeFilename } from '../src/services/pdfService';

function document(overrides: Partial<ResumeDocument> = {}): ResumeDocument {
  return {
    name: 'Ada Lovelace',
    headline: 'Machine Learning Engineer',
    contact: {
      email: 'ada@example.com',
      phone: '+1 555 0100',
      location: 'London, UK',
      links: [{ label: 'GitHub', url: 'https://github.com/ada' }],
    },
    summary:
      'Machine learning engineer with verified project experience in Python, model evaluation and data preprocessing.',
    sections: [
      {
        key: 'skills',
        title: 'Technical Skills',
        items: [
          {
            recordId: 'rec_skill',
            heading: 'Languages',
            subheading: '',
            meta: '',
            bullets: ['Python — Advanced', 'TypeScript — Intermediate'],
            links: [],
          },
        ],
      },
      {
        key: 'projects',
        title: 'Projects',
        items: [
          {
            recordId: 'rec_project',
            heading: 'Churn prediction project',
            subheading: 'Python, pandas',
            meta: '2024',
            bullets: ['Built an end-to-end pipeline.', 'Reached 87% accuracy on the test set.'],
            links: [{ label: 'Repository', url: 'https://github.com/ada/churn' }],
          },
        ],
      },
    ],
    template: 'classic',
    layout: 'one_page',
    generatedAt: '2026-01-01T00:00:00.000Z',
    engine: 'deterministic',
    warnings: [],
    ...overrides,
  };
}

function countPages(buffer: Buffer): number {
  const text = buffer.toString('latin1');
  return [...text.matchAll(/\/Type\s*\/Page\b/g)].length;
}

describe('PDF rendering', () => {
  it('renders a valid PDF from the approved document snapshot', async () => {
    const buffer = await renderResumePdf(document());

    expect(buffer.subarray(0, 5).toString()).toBe('%PDF-');
    expect(buffer.subarray(-6).toString()).toContain('%%EOF');
    expect(buffer.length).toBeGreaterThan(1500);
    expect(countPages(buffer)).toBe(1);
  });

  it('flows long resumes onto multiple pages instead of clipping content', async () => {
    const longSections: ResumeDocument['sections'] = Array.from({ length: 3 }, (_, index) => ({
      key: 'experience' as const,
      title: 'Experience',
      items: [
        {
          recordId: `rec_exp_${index}`,
          heading: `Software Engineer ${index + 1}`,
          subheading: 'Example Organisation',
          meta: '2022 – 2024',
          bullets: Array.from(
            { length: 14 },
            (_, bulletIndex) =>
              `Delivered a measurable improvement to a production service with careful documentation and review ${bulletIndex + 1}.`,
          ),
          links: [],
        },
      ],
    }));

    const buffer = await renderResumePdf(document({ sections: longSections, layout: 'two_page' }));
    expect(countPages(buffer)).toBeGreaterThan(1);
  });

  it('supports every template without throwing', async () => {
    for (const template of ['classic', 'modern', 'compact'] as const) {
      const buffer = await renderResumePdf(document({ template }));
      expect(buffer.subarray(0, 5).toString()).toBe('%PDF-');
    }
  });

  it('ignores unsafe links rather than rendering them as clickable targets', async () => {
    const buffer = await renderResumePdf(
      document({
        contact: {
          ...document().contact,
          links: [{ label: 'Bad', url: 'javascript:alert(1)' }],
        },
        sections: [
          {
            key: 'projects',
            title: 'Projects',
            items: [
              {
                recordId: 'rec_bad',
                heading: 'Project',
                subheading: '',
                meta: '',
                bullets: ['Safe content only.'],
                links: [{ label: 'Bad', url: 'javascript:alert(1)' }],
              },
            ],
          },
        ],
      }),
    );

    expect(buffer.subarray(0, 5).toString()).toBe('%PDF-');
    expect(buffer.toString('latin1')).not.toContain('javascript:alert');
  });
});

describe('PDF filename safety', () => {
  it('builds a readable filename with no path or header-breaking characters', () => {
    const filename = resumeFilename(
      document({ name: 'José "Álvarez"/QA' }),
      'Senior ML Engineer / Platform',
    );

    expect(filename.endsWith('.pdf')).toBe(true);
    expect(filename).not.toContain('/');
    expect(filename).not.toContain('\\');
    expect(filename).not.toContain('"');
    expect(filename).toContain('Jos');
    expect(filename).toContain('Resume');
  });

  it('falls back to a safe name for blank input', () => {
    expect(resumeFilename(document({ name: '', headline: '' }), '')).toBe('Candidate_Resume_Resume.pdf');
  });
});
