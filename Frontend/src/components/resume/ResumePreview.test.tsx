import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ResumePreview } from '@/components/resume/ResumePreview';
import type { ResumeDocument } from '@shared/types';

const baseDocument: ResumeDocument = {
  name: 'Ada Lovelace',
  headline: 'Staff Software Engineer',
  contact: {
    email: 'ada@example.com',
    phone: '+1 555 0100',
    location: 'London, UK',
    links: [{ label: 'github.com/ada', url: 'https://github.com/ada' }],
  },
  summary: 'Engineer with a record of shipping reliable systems.',
  sections: [
    {
      key: 'summary',
      title: 'Professional Summary',
      items: [],
    },
    {
      key: 'experience',
      title: 'Experience',
      items: [
        {
          recordId: 'exp_1',
          heading: 'Analytical Engines Ltd',
          subheading: 'Staff Engineer',
          meta: '2021 – Present',
          bullets: ['Cut batch runtime by 40% through scheduling changes.'],
          links: [],
        },
      ],
    },
    {
      key: 'projects',
      title: 'Projects',
      items: [
        {
          recordId: 'proj_1',
          heading: 'Difference Engine',
          subheading: '',
          meta: '',
          bullets: ['Designed a verified computation pipeline.'],
          links: [{ label: 'Demo', url: 'https://example.com/demo' }],
        },
      ],
    },
    {
      key: 'skills',
      title: 'Skills',
      items: [
        {
          recordId: '',
          heading: '',
          subheading: '',
          meta: '',
          bullets: [],
          links: [],
        },
      ],
    },
  ],
  template: 'classic',
  layout: 'one_page',
  generatedAt: '2026-01-01T00:00:00.000Z',
  engine: 'deterministic',
  warnings: [],
};

describe('ResumePreview', () => {
  it('renders the candidate header, contact details and summary', () => {
    render(<ResumePreview document={baseDocument} />);

    expect(screen.getByRole('heading', { level: 1, name: 'Ada Lovelace' })).toBeInTheDocument();
    expect(screen.getByText('Staff Software Engineer')).toBeInTheDocument();
    expect(screen.getByText(/London, UK/)).toBeInTheDocument();
    expect(screen.getByText(/ada@example\.com/)).toBeInTheDocument();
    expect(screen.getAllByText('Professional Summary').length).toBeGreaterThan(0);
    expect(
      screen.getByText('Engineer with a record of shipping reliable systems.'),
    ).toBeInTheDocument();
  });

  it('renders section items with bullets and skips empty sections', () => {
    render(<ResumePreview document={baseDocument} />);

    expect(screen.getByText('Experience')).toBeInTheDocument();
    expect(screen.getByText('Analytical Engines Ltd')).toBeInTheDocument();
    expect(screen.getByText('2021 – Present')).toBeInTheDocument();
    expect(
      screen.getByText('Cut batch runtime by 40% through scheduling changes.'),
    ).toBeInTheDocument();

    expect(screen.getByText('Projects')).toBeInTheDocument();
    expect(screen.queryByText('Skills')).not.toBeInTheDocument();
  });

  it('renders safe links for the candidate and section items', () => {
    render(<ResumePreview document={baseDocument} />);

    const contactLink = screen.getByRole('link', { name: 'github.com/ada' });
    expect(contactLink).toHaveAttribute('href', 'https://github.com/ada');
    expect(contactLink).toHaveAttribute('rel', 'noreferrer');

    const projectLink = screen.getByRole('link', { name: 'Demo' });
    expect(projectLink).toHaveAttribute('href', 'https://example.com/demo');
  });

  it('applies the compact template spacing without dropping content', () => {
    render(<ResumePreview document={{ ...baseDocument, template: 'compact' }} />);

    const sheet = screen.getByTestId('resume-preview');
    expect(sheet).toHaveClass('font-sans');
    expect(sheet).toHaveClass('px-[48px]');
    expect(within(sheet).getByText('Analytical Engines Ltd')).toBeInTheDocument();
  });

  it('falls back to a placeholder name when the document has none', () => {
    render(<ResumePreview document={{ ...baseDocument, name: '' }} />);

    expect(screen.getByRole('heading', { level: 1, name: 'Candidate' })).toBeInTheDocument();
  });
});
