import { describe, expect, it } from 'vitest';
import {
  buildBuilderSignature,
  filterRecords,
  isPreviewStale,
  selectableRecords,
  suggestedSelection,
  toggleSelection,
  uniqueIds,
} from '@/lib/builder';
import type { MatchResponse, PortfolioRecord, ResumeSettings } from '@shared/types';

const timestamp = '2026-01-01T00:00:00.000Z';

function record(
  id: string,
  overrides: Partial<PortfolioRecord> = {},
): PortfolioRecord {
  return {
    id,
    category: 'projects',
    title: `Project ${id}`,
    data: { name: `Project ${id}`, description: 'A verified project.', technologies: ['Python'] },
    tags: [],
    sourceType: 'manual',
    verificationStatus: 'verified',
    createdAt: timestamp,
    updatedAt: timestamp,
    ...overrides,
  };
}

function match(overrides: Partial<MatchResponse> = {}): MatchResponse {
  return {
    jobDescriptionId: 'jd_1',
    matches: [],
    missingRequirements: [],
    rankedRecords: [],
    engine: 'deterministic',
    notes: '',
    generatedAt: timestamp,
    ...overrides,
  };
}

const settings: ResumeSettings = {
  sectionOrder: ['summary', 'skills', 'projects', 'education'],
  template: 'classic',
  layout: 'one_page',
  contactOverrides: {},
};

describe('builder selection rules', () => {
  it('deduplicates IDs without reordering', () => {
    expect(uniqueIds(['b', 'a', 'b', 'c', 'a'])).toEqual(['b', 'a', 'c']);
  });

  it('excludes personal information and summary from selectable evidence', () => {
    const records = [
      record('p', { category: 'projects' }),
      record('pi', { category: 'personal_info' }),
      record('s', { category: 'summary' }),
      record('e', { category: 'experience' }),
    ];

    expect(selectableRecords(records).map((item) => item.id)).toEqual(['p', 'e']);
  });

  it('preselects strong verified evidence and never unverified records', () => {
    const verified = record('verified');
    const unverified = record('unverified', { verificationStatus: 'needs_review' });
    const other = record('other');

    const selection = suggestedSelection(
      match({
        matches: [
          {
            requirement: 'Python',
            requirementType: 'required_skill',
            status: 'strong',
            matchKind: 'exact',
            recordIds: ['verified', 'unverified', 'verified'],
            evidence: [],
            explanation: '',
          },
          {
            requirement: 'React',
            requirementType: 'preferred_skill',
            status: 'strong',
            matchKind: 'exact',
            recordIds: ['other', 'unverified'],
            evidence: [],
            explanation: '',
          },
        ],
      }),
      [verified, unverified, other],
    );

    expect(selection).toEqual(['verified', 'other']);
  });

  it('falls back to ranked records when no strong match exists', () => {
    const selection = suggestedSelection(
      match({
        rankedRecords: [
          { recordId: 'a', relevance: 90, reason: '', matchedRequirements: [] },
          { recordId: 'missing', relevance: 80, reason: '', matchedRequirements: [] },
          { recordId: 'unverified', relevance: 70, reason: '', matchedRequirements: [] },
          { recordId: 'b', relevance: 60, reason: '', matchedRequirements: [] },
        ],
      }),
      [record('a'), record('unverified', { verificationStatus: 'needs_review' }), record('b')],
    );

    expect(selection).toEqual(['a', 'b']);
  });

  it('caps preselection at 24 strong records', () => {
    const records = Array.from({ length: 30 }, (_, index) => record(`r${index}`));
    const selection = suggestedSelection(
      match({
        matches: [
          {
            requirement: 'Python',
            requirementType: 'required_skill',
            status: 'strong',
            matchKind: 'exact',
            recordIds: records.map((item) => item.id),
            evidence: [],
            explanation: '',
          },
        ],
      }),
      records,
    );

    expect(selection).toHaveLength(24);
  });

  it('toggles selection on and off', () => {
    const first = toggleSelection([], 'a');
    const second = toggleSelection(first, 'b');
    const removed = toggleSelection(second, 'a');

    expect(first).toEqual(['a']);
    expect(second).toEqual(['a', 'b']);
    expect(removed).toEqual(['b']);
  });
});

describe('builder filtering', () => {
  const records = [
    record('alpha', { title: 'Alpha dashboard', category: 'projects', data: { name: 'Alpha dashboard', description: 'React interface' } }),
    record('beta', { title: 'Beta pipeline', category: 'projects', data: { name: 'Beta pipeline', description: 'Python ETL' } }),
    record('gamma', { title: 'Gamma internship', category: 'experience', data: { organization: 'Acme', jobTitle: 'Engineer' } }),
  ];

  it('searches title, category and stored values case-insensitively', () => {
    expect(filterRecords(records, { query: 'react' }).map((item) => item.id)).toEqual(['alpha']);
    expect(filterRecords(records, { query: 'python' }).map((item) => item.id)).toEqual(['beta']);
    expect(filterRecords(records, { query: 'experience' }).map((item) => item.id)).toEqual(['gamma']);
    expect(filterRecords(records, { query: 'acme' }).map((item) => item.id)).toEqual(['gamma']);
  });

  it('applies category filters and returns everything for an empty query', () => {
    expect(filterRecords(records, { query: '', category: 'projects' }).map((item) => item.id)).toEqual([
      'alpha',
      'beta',
    ]);
    expect(filterRecords(records, { query: '', category: 'all' })).toHaveLength(3);
    expect(filterRecords(records, { query: 'nothing-matches', category: 'all' })).toEqual([]);
  });
});

describe('preview invalidation', () => {
  it('treats selection order as irrelevant', () => {
    const a = buildBuilderSignature({ selectedIds: ['b', 'a'], settings, useAiSummary: false });
    const b = buildBuilderSignature({ selectedIds: ['a', 'b'], settings, useAiSummary: false });
    expect(a).toBe(b);
  });

  it('changes when the selection, settings or AI summary option changes', () => {
    const base = buildBuilderSignature({ selectedIds: ['a'], settings, useAiSummary: false });
    const selection = buildBuilderSignature({ selectedIds: ['a', 'b'], settings, useAiSummary: false });
    const template = buildBuilderSignature({
      selectedIds: ['a'],
      settings: { ...settings, template: 'modern' },
      useAiSummary: false,
    });
    const ai = buildBuilderSignature({ selectedIds: ['a'], settings, useAiSummary: true });

    expect(new Set([base, selection, template, ai]).size).toBe(4);
  });

  it('flags a preview as stale only after it has been generated', () => {
    expect(isPreviewStale(null, 'sig')).toBe(false);
    expect(isPreviewStale('sig', 'sig')).toBe(false);
    expect(isPreviewStale('sig', 'other')).toBe(true);
  });
});
