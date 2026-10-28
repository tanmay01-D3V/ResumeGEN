import type {
  MatchResponse,
  PortfolioRecord,
  ResumeSettings,
} from '@shared/types';

/**
 * Pure helpers for the resume builder. Keeping selection, filtering and
 * preview-staleness logic out of the page component makes the rules testable
 * and prevents the UI and the server from drifting apart.
 */

export function uniqueIds(ids: string[]): string[] {
  return [...new Set(ids)];
}

/** Personal information and summary are rendered from contact/summary settings. */
export function selectableRecords(records: PortfolioRecord[]): PortfolioRecord[] {
  return records.filter((record) => !['personal_info', 'summary'].includes(record.category));
}

/**
 * Preselect the strongest verified evidence. Falls back to ranked records when
 * the deterministic matcher found no strong requirement, and never selects
 * unverified records.
 */
export function suggestedSelection(match: MatchResponse, records: PortfolioRecord[]): string[] {
  const verified = new Set(
    records.filter((record) => record.verificationStatus === 'verified').map((record) => record.id),
  );
  const strong = uniqueIds(
    match.matches.filter((item) => item.status === 'strong').flatMap((item) => item.recordIds),
  ).filter((id) => verified.has(id));
  if (strong.length) return strong.slice(0, 24);
  return match.rankedRecords
    .filter((ranked) => verified.has(ranked.recordId))
    .slice(0, 8)
    .map((ranked) => ranked.recordId);
}

/** Search across title, category and stored values, with an optional category filter. */
export function filterRecords(
  records: PortfolioRecord[],
  options: { query: string; category?: string },
): PortfolioRecord[] {
  const query = options.query.trim().toLowerCase();
  const category = options.category ?? 'all';
  return records
    .filter((record) => category === 'all' || record.category === category)
    .filter((record) => {
      if (!query) return true;
      return `${record.title} ${record.category} ${JSON.stringify(record.data)}`
        .toLowerCase()
        .includes(query);
    });
}

export function toggleSelection(ids: string[], id: string): string[] {
  return ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id];
}

export function buildBuilderSignature(input: {
  selectedIds: string[];
  settings: ResumeSettings;
  useAiSummary: boolean;
}): string {
  return JSON.stringify({
    ids: [...input.selectedIds].sort(),
    settings: input.settings,
    useAiSummary: input.useAiSummary,
  });
}

/** A preview is stale as soon as any input that affects it changes. */
export function isPreviewStale(
  generatedSignature: string | null,
  currentSignature: string,
): boolean {
  return Boolean(generatedSignature && generatedSignature !== currentSignature);
}
