import { describe, expect, it } from 'vitest';
import type { PortfolioRecord } from '../../shared/schemas';
import { normalizeRecordData, validateRecordData } from '../../shared/schemas';
import {
  buildTab,
  buildWorkbook,
  parseSheetRow,
  upsertRows,
} from '../src/services/sheetsWorkbook';

const timestamp = '2026-01-01T00:00:00.000Z';

function record(overrides: Partial<PortfolioRecord> & Pick<PortfolioRecord, 'id' | 'category' | 'title' | 'data'>): PortfolioRecord {
  return {
    tags: [],
    sourceType: 'manual',
    verificationStatus: 'verified',
    createdAt: timestamp,
    updatedAt: timestamp,
    ...overrides,
  };
}

const alpha = record({
  id: 'rec_alpha',
  category: 'projects',
  title: 'Alpha project',
  tags: ['React', 'TypeScript'],
  data: {
    name: 'Alpha project',
    description: 'Built a TypeScript dashboard for operations teams.',
    technologies: ['React', 'TypeScript'],
    achievements: ['Reduced reporting time'],
  },
});

const beta = record({
  id: 'rec_beta',
  category: 'projects',
  title: 'Beta project',
  tags: [],
  data: {
    name: 'Beta project',
    description: 'Automated a data quality workflow.',
    technologies: ['Python'],
  },
});

describe('Google Sheets workbook export', () => {
  it('exports one tab per category group with stable record IDs and a metadata tab', () => {
    const workbook = buildWorkbook([alpha, beta], timestamp);

    expect(workbook.recordCount).toBe(2);
    expect(workbook.generatedAt).toBe(timestamp);
    const metadata = workbook.tabs.find((tab) => tab.name === 'Metadata');
    expect(metadata?.rows).toContainEqual(['sourceOfTruth', 'Firestore']);

    const projects = workbook.tabs.find((tab) => tab.name === 'Projects');
    expect(projects?.recordIds).toEqual(['rec_alpha', 'rec_beta']);
    expect(projects?.headers).toContain('Record ID');

    const idIndex = projects!.headers.indexOf('Record ID');
    expect(projects!.rows[0]![idIndex]).toBe('rec_alpha');
    expect(projects!.rows[1]![idIndex]).toBe('rec_beta');
  });

  it('serialises list values and booleans in a spreadsheet-friendly form', () => {
    const experience = record({
      id: 'rec_exp',
      category: 'experience',
      title: 'Engineer at Acme',
      data: {
        organization: 'Acme',
        jobTitle: 'Engineer',
        current: true,
        responsibilities: ['Built APIs', 'Reviewed pull requests'],
      },
    });

    const tab = buildTab('Experience', ['experience'], [experience]);
    const row = tab.rows[0]!;
    const value = (header: string) => row[tab.headers.indexOf(header)];

    expect(value('Responsibilities')).toBe('Built APIs; Reviewed pull requests');
    expect(value('Current')).toBe('Yes');
  });
});

describe('Google Sheets upsert behaviour', () => {
  it('updates by stable ID, preserves user rows, removes deleted records and appends new rows', () => {
    const tab = buildTab('Projects', ['projects'], [alpha, beta]);
    const existingHeaders = tab.headers;
    const idIndex = existingHeaders.indexOf('Record ID');

    const staleRow = [...tab.rows[0]!];
    staleRow[idIndex] = 'rec_deleted';
    const oldAlphaRow = [...tab.rows[0]!];
    oldAlphaRow[idIndex] = 'rec_alpha';
    oldAlphaRow[existingHeaders.indexOf('Title')] = 'Old alpha title';
    const userNote = Array(existingHeaders.length).fill('');
    userNote[0] = '';
    userNote[2] = 'My own note — keep me';

    const result = upsertRows(
      existingHeaders,
      [staleRow, userNote, oldAlphaRow],
      tab.headers,
      tab.rows,
    );

    expect(result.updated).toBe(1);
    expect(result.appended).toBe(1);
    expect(result.removed).toBe(1);
    expect(result.preserved).toBe(1);

    expect(result.values).toHaveLength(3);
    expect(result.values[0]![2]).toBe('My own note — keep me');
    expect(result.values[1]![idIndex]).toBe('rec_alpha');
    expect(result.values[1]![existingHeaders.indexOf('Title')]).toBe('Alpha project');
    expect(result.values[2]![idIndex]).toBe('rec_beta');
    expect(result.values.some((row) => row[idIndex] === 'rec_deleted')).toBe(false);
  });

  it('does not duplicate rows when the sheet is already in sync', () => {
    const tab = buildTab('Projects', ['projects'], [alpha, beta]);
    const first = upsertRows(tab.headers, [], tab.headers, tab.rows);
    const second = upsertRows(tab.headers, first.values, tab.headers, tab.rows);

    expect(second.values).toHaveLength(2);
    expect(second.updated).toBe(2);
    expect(second.appended).toBe(0);
    expect(second.removed).toBe(0);
  });

  it('preserves column order differences by matching on headers', () => {
    const tab = buildTab('Projects', ['projects'], [alpha]);
    const reorderedHeaders = [...tab.headers].reverse();
    const reorderedRow = [...tab.rows[0]!].reverse();

    const result = upsertRows(
      reorderedHeaders,
      [reorderedRow],
      tab.headers,
      tab.rows,
    );

    expect(result.updated).toBe(1);
    expect(result.appended).toBe(0);
    expect(result.values[0]![tab.headers.indexOf('Record ID')]).toBe('rec_alpha');
  });
});

describe('Google Sheets row import parsing', () => {
  it('round-trips a project row back into validated portfolio data', () => {
    const tab = buildTab('Projects', ['projects'], [alpha]);
    const parsed = parseSheetRow(tab.headers, tab.rows[0]!, tab.fieldMaps);

    expect(parsed.recordId).toBe('rec_alpha');
    expect(parsed.category).toBe('projects');
    expect(parsed.title).toBe('Alpha project');
    expect(parsed.tags).toEqual(['React', 'TypeScript']);
    expect(parsed.updatedAt).toBe(timestamp);

    const normalized = normalizeRecordData('projects', parsed.values);
    const validated = validateRecordData('projects', normalized);
    expect(validated.success).toBe(true);
    expect(normalized.technologies).toEqual(['React', 'TypeScript']);
    expect(normalized.achievements).toEqual(['Reduced reporting time']);
  });

  it('parses booleans and numbers from sheet cells', () => {
    const experience = record({
      id: 'rec_exp',
      category: 'experience',
      title: 'Engineer',
      data: {
        organization: 'Acme',
        jobTitle: 'Engineer',
        current: 'yes',
        responsibilities: ['Built APIs'],
      },
    });
    const expTab = buildTab('Experience', ['experience'], [experience]);
    const parsedExp = parseSheetRow(expTab.headers, expTab.rows[0]!, expTab.fieldMaps);
    expect(parsedExp.values.current).toBe(true);

    const skill = record({
      id: 'rec_skill',
      category: 'technical_skills',
      title: 'Python',
      data: { name: 'Python', yearsExperience: 3 },
    });
    const skillTab = buildTab('Skills', ['technical_skills'], [skill]);
    const parsedSkill = parseSheetRow(skillTab.headers, skillTab.rows[0]!, skillTab.fieldMaps);
    expect(parsedSkill.values.yearsExperience).toBe(3);
  });

  it('returns blanks for unknown headers without throwing', () => {
    const parsed = parseSheetRow(['Something Else'], ['x'], []);
    expect(parsed.recordId).toBe('');
    expect(parsed.category).toBeUndefined();
    expect(parsed.values).toEqual({});
  });
});
