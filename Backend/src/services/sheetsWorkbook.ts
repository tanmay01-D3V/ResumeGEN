import {
  CATEGORY_META,
  SHEET_TABS,
  type CategoryField,
  type PortfolioCategory,
} from '../../../shared/categories';
import type { PortfolioRecord, SheetPreview } from '../../../shared/schemas';
import { sanitizeSingleLine, sanitizeText } from '../utils/sanitize';
import { nowIso } from '../utils/ids';

export type Cell = string | number | boolean;

export interface TabFieldMap {
  header: string;
  key: string;
  type: CategoryField['type'];
}

export interface TabWorkbook {
  name: string;
  categories: PortfolioCategory[];
  headers: string[];
  fieldMaps: TabFieldMap[];
  rows: Cell[][];
  recordIds: string[];
}

const BASE_HEADERS = [
  'Record ID',
  'Record Type',
  'Title',
  'Tags',
  'Source Type',
  'Verification Status',
  'Created At',
  'Updated At',
] as const;

export const BASE_HEADER_KEYS: Record<string, string> = {
  'Record ID': 'id',
  'Record Type': 'category',
  Title: 'title',
  Tags: 'tags',
  'Source Type': 'sourceType',
  'Verification Status': 'verificationStatus',
  'Created At': 'createdAt',
  'Updated At': 'updatedAt',
};

function tabFields(categories: PortfolioCategory[]): TabFieldMap[] {
  const maps: TabFieldMap[] = [];
  const seenKeys = new Set<string>();
  const seenHeaders = new Set<string>();
  for (const category of categories) {
    for (const field of CATEGORY_META[category].fields) {
      if (seenKeys.has(field.key)) continue;
      let header = field.label;
      if (seenHeaders.has(header)) header = `${field.label} (${category})`;
      seenKeys.add(field.key);
      seenHeaders.add(header);
      maps.push({ header, key: field.key, type: field.type });
    }
  }
  return maps;
}

function cellValue(field: Pick<CategoryField, 'key' | 'type'>, record: PortfolioRecord): Cell {
  const value = (record.data as Record<string, unknown>)[field.key];
  if (value === undefined || value === null) return '';
  if (field.type === 'list') {
    if (Array.isArray(value)) {
      return value
        .map((item) => sanitizeSingleLine(String(item), 400))
        .filter(Boolean)
        .join('; ');
    }
    return sanitizeText(String(value), 2000);
  }
  if (field.type === 'boolean') return value === true ? 'Yes' : 'No';
  if (field.type === 'number') {
    const number = Number(value);
    return Number.isFinite(number) ? number : '';
  }
  if (field.type === 'textarea') return sanitizeText(String(value), 2000);
  return sanitizeSingleLine(String(value), 400);
}

export function buildTab(
  name: string,
  categories: PortfolioCategory[],
  records: PortfolioRecord[],
): TabWorkbook {
  const fields = tabFields(categories);
  const headers = [...BASE_HEADERS, ...fields.map((field) => field.header)];
  const scoped = records
    .filter((record) => categories.includes(record.category))
    .sort((a, b) => {
      const categoryCompare = categories.indexOf(a.category) - categories.indexOf(b.category);
      if (categoryCompare !== 0) return categoryCompare;
      return a.title.localeCompare(b.title);
    });

  const rows: Cell[][] = scoped.map((record) => [
    record.id,
    record.category,
    sanitizeSingleLine(record.title, 300),
    record.tags.join('; '),
    record.sourceType,
    record.verificationStatus,
    record.createdAt,
    record.updatedAt,
    ...fields.map((field) => cellValue(field, record)),
  ]);

  return {
    name,
    categories,
    headers,
    fieldMaps: fields,
    rows,
    recordIds: scoped.map((record) => record.id),
  };
}

export function buildWorkbook(records: PortfolioRecord[], generatedAt = nowIso()): SheetPreview {
  const tabs: SheetPreview['tabs'] = [];
  for (const tab of SHEET_TABS) {
    if (tab.name === 'Metadata') {
      tabs.push({
        name: 'Metadata',
        headers: ['Key', 'Value'],
        rows: [
          ['application', 'ResumeGEN'],
          ['schemaVersion', '1'],
          ['recordCount', String(records.length)],
          ['generatedAt', generatedAt],
          ['sourceOfTruth', 'Firestore'],
        ],
        recordIds: [],
      });
      continue;
    }
    const built = buildTab(tab.name, tab.categories, records);
    tabs.push({
      name: built.name,
      headers: built.headers,
      rows: built.rows,
      recordIds: built.recordIds,
    });
  }
  return {
    tabs,
    generatedAt,
    recordCount: records.length,
  };
}

export function buildTabWorkbooks(records: PortfolioRecord[]): TabWorkbook[] {
  return SHEET_TABS.filter((tab) => tab.name !== 'Metadata').map((tab) =>
    buildTab(tab.name, tab.categories, records),
  );
}

/**
 * Upsert exported rows by stable Record ID. Existing records keep their row
 * position; new records are appended. Rows for deleted records are removed,
 * while rows with no Record ID (user notes) are preserved at the bottom.
 */
export function upsertRows(
  existingHeaders: string[],
  existingRows: Cell[][],
  headers: string[],
  newRows: Cell[][],
): { values: Cell[][]; updated: number; appended: number; removed: number; preserved: number } {
  const existingIdIndex = existingHeaders.findIndex(
    (header) => header.trim().toLowerCase() === 'record id',
  );
  const newIdIndex = headers.findIndex((header) => header.trim().toLowerCase() === 'record id');
  if (newIdIndex === -1) throw new Error('Exported rows require a Record ID column.');

  const newById = new Map<string, Cell[]>();
  for (const row of newRows) {
    const id = String(row[newIdIndex] ?? '').trim();
    if (id) newById.set(id, row);
  }

  const values: Cell[][] = [];
  const used = new Set<string>();
  let updated = 0;
  let preserved = 0;

  for (const existingRow of existingRows) {
    const existingId =
      existingIdIndex >= 0 ? String(existingRow[existingIdIndex] ?? '').trim() : '';
    if (!existingId) {
      // Preserve user-authored rows without a record ID (e.g. notes).
      preserved += 1;
      values.push(existingRow);
      continue;
    }
    const replacement = newById.get(existingId);
    if (!replacement) continue; // stale record deleted from Firestore
    values.push(replacement);
    used.add(existingId);
    updated += 1;
  }

  let appended = 0;
  for (const row of newRows) {
    const id = String(row[newIdIndex] ?? '').trim();
    if (!id || used.has(id)) continue;
    values.push(row);
    used.add(id);
    appended += 1;
  }

  const removed = existingRows.filter((row) => {
    const id = existingIdIndex >= 0 ? String(row[existingIdIndex] ?? '').trim() : '';
    return Boolean(id) && !newById.has(id);
  }).length;

  return { values, updated, appended, removed, preserved };
}

/** Parse a sheet row back into a portfolio data object using the tab's fields. */
export function parseSheetRow(
  headers: string[],
  row: Cell[],
  fields: TabFieldMap[],
): { values: Record<string, unknown>; title: string; category?: string; recordId: string; updatedAt: string; tags: string[] } {
  const byHeader = new Map<string, { index: number; field?: TabFieldMap; base?: string }>();
  headers.forEach((header, index) => {
    const trimmed = header.trim();
    const field = fields.find((candidate) => candidate.header === trimmed);
    const base = BASE_HEADER_KEYS[trimmed];
    if (field) byHeader.set(trimmed, { index, field });
    else if (base) byHeader.set(trimmed, { index, base });
  });

  const get = (header: string): Cell => {
    const entry = byHeader.get(header);
    if (!entry) return '';
    return row[entry.index] ?? '';
  };

  const values: Record<string, unknown> = {};
  for (const field of fields) {
    const entry = byHeader.get(field.header);
    if (!entry) continue;
    const raw = row[entry.index];
    if (raw === undefined || raw === null || raw === '') continue;
    if (field.type === 'boolean') values[field.key] = raw === true || /^(yes|true|1)$/i.test(String(raw));
    else if (field.type === 'number') {
      const number = Number(raw);
      if (Number.isFinite(number)) values[field.key] = number;
    } else values[field.key] = raw;
  }

  const tagsRaw = String(get('Tags') ?? '');
  return {
    recordId: String(get('Record ID') ?? '').trim(),
    category: String(get('Record Type') ?? '').trim() || undefined,
    title: sanitizeSingleLine(String(get('Title') ?? ''), 300),
    updatedAt: String(get('Updated At') ?? '').trim(),
    tags: tagsRaw
      .split(';')
      .map((tag) => sanitizeSingleLine(tag, 60))
      .filter(Boolean),
    values,
  };
}

export function workbookPreviewFromTabs(tabs: TabWorkbook[], recordCount: number): SheetPreview {
  return {
    tabs: tabs.map((tab) => ({
      name: tab.name,
      headers: tab.headers,
      rows: tab.rows,
      recordIds: tab.recordIds,
    })),
    generatedAt: nowIso(),
    recordCount,
  };
}
