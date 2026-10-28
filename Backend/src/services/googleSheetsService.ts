import type { sheets_v4 } from 'googleapis';
import {
  importProposalSchema,
  normalizeRecordData,
  validateRecordData,
  type ImportProposal,
  type IntegrationStatus,
  type PortfolioRecord,
  type SheetPreview,
} from '../../../shared/schemas';
import { SHEET_TABS, isPortfolioCategory, type PortfolioCategory } from '../../../shared/categories';
import type { IntegrationRecord, Repository } from '../repositories';
import { emptyIntegration } from '../repositories';
import { getEnv } from '../config/env';
import { getSheetsClient, sheetRange } from '../config/google';
import { ApiError, zodDetails } from '../utils/errors';
import { newId, nowIso } from '../utils/ids';
import { sanitizeSingleLine } from '../utils/sanitize';
import { errorSummary, logger } from '../utils/logger';
import {
  buildTab,
  buildTabWorkbooks,
  buildWorkbook,
  parseSheetRow,
  upsertRows,
  type Cell,
  type TabWorkbook,
} from './sheetsWorkbook';

type Values = sheets_v4.Schema$ValueRange;

const METADATA_TITLE = 'Metadata';
const METADATA_HEADERS = ['Key', 'Value'];

function normalizeCell(cell: unknown): Cell {
  if (typeof cell === 'number' || typeof cell === 'boolean') return cell;
  return cell === null || cell === undefined ? '' : String(cell);
}

function normalizeValues(values: unknown[][] | null | undefined): Cell[][] {
  return (values ?? []).map((row) => row.map(normalizeCell));
}

function maskSpreadsheetId(id: string): string {
  if (id.length <= 12) return id;
  return `${id.slice(0, 6)}…${id.slice(-4)}`;
}

function extractSpreadsheetId(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return '';
  const urlMatch = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  const candidate = urlMatch?.[1] ?? trimmed;
  if (!/^[a-zA-Z0-9-_]{10,200}$/.test(candidate)) {
    throw ApiError.badRequest('Enter a valid Google Sheets spreadsheet ID or URL.');
  }
  return candidate;
}

function friendlySheetsError(error: unknown): string {
  const status =
    (error as { response?: { status?: number } })?.response?.status ??
    (error as { code?: number })?.code;
  const message = String((error as { message?: string })?.message ?? '');
  if (status === 403) {
    return 'Google Sheets denied access. Share the spreadsheet with the service account configured on the server and grant Editor access.';
  }
  if (status === 404) {
    return 'The spreadsheet was not found. Check GOOGLE_SHEETS_SPREADSHEET_ID and confirm it is shared with the service account.';
  }
  if (/invalid_grant|invalid credentials|could not load the default credentials/i.test(message)) {
    return 'Google credentials could not be loaded. Check GOOGLE_APPLICATION_CREDENTIALS.';
  }
  if (/rate limit|quota/i.test(message)) {
    return 'Google Sheets quota or rate limit reached. Wait a minute and retry the sync.';
  }
  return 'The Google Sheets request failed. Check the server logs and the spreadsheet permissions, then retry.';
}

export class GoogleSheetsService {
  constructor(
    private readonly repo: Repository,
    private readonly clientOverride?: sheets_v4.Sheets | null,
  ) {}

  private client(): sheets_v4.Sheets | null {
    return this.clientOverride !== undefined ? this.clientOverride : getSheetsClient();
  }

  private async resolveConfig(uid: string): Promise<{
    integration: IntegrationRecord;
    spreadsheetId: string;
    configured: boolean;
    missingCredentials: string[];
  }> {
    const env = getEnv();
    const stored = await this.repo.getIntegration(uid);
    const integration = stored ?? emptyIntegration();
    const spreadsheetId = stored?.spreadsheetId || env.spreadsheetId;
    const client = this.client();
    const missingCredentials: string[] = [];
    if (!client) missingCredentials.push('Google service-account credentials');
    if (!spreadsheetId) missingCredentials.push('GOOGLE_SHEETS_SPREADSHEET_ID');
    return {
      integration: { ...integration, spreadsheetId },
      spreadsheetId,
      configured: Boolean(client && spreadsheetId),
      missingCredentials,
    };
  }

  async getStatus(uid: string): Promise<IntegrationStatus> {
    const { integration, spreadsheetId, configured, missingCredentials } = await this.resolveConfig(uid);
    const pending = integration.pendingChanges ?? 0;
    let status = integration.status ?? 'never_synced';
    if (status === 'never_synced' && pending > 0) status = 'pending';
    return {
      configured,
      ...(spreadsheetId ? { spreadsheetIdMasked: maskSpreadsheetId(spreadsheetId) } : {}),
      ...(spreadsheetId
        ? { spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit` }
        : {}),
      autoSync: Boolean(integration.autoSync),
      status,
      ...(integration.lastSyncAt ? { lastSyncAt: integration.lastSyncAt } : {}),
      ...(integration.lastError ? { lastError: integration.lastError } : {}),
      pendingChanges: pending,
      missingCredentials,
    };
  }

  async updateConfig(
    uid: string,
    input: { spreadsheetId?: string; autoSync?: boolean },
  ): Promise<IntegrationStatus> {
    const current = (await this.repo.getIntegration(uid)) ?? emptyIntegration();
    const nextId = input.spreadsheetId !== undefined ? extractSpreadsheetId(input.spreadsheetId) : current.spreadsheetId;
    const spreadsheetChanged = nextId !== current.spreadsheetId;
    await this.repo.saveIntegration(uid, {
      ...current,
      spreadsheetId: nextId,
      autoSync: input.autoSync ?? current.autoSync,
      ...(spreadsheetChanged
        ? { status: 'never_synced', lastSyncAt: undefined, lastError: undefined }
        : {}),
      updatedAt: nowIso(),
    });
    return this.getStatus(uid);
  }

  async preview(uid: string): Promise<SheetPreview> {
    const records = await this.repo.listPortfolio(uid);
    return buildWorkbook(records);
  }

  private async ensureWorksheets(
    client: sheets_v4.Sheets,
    spreadsheetId: string,
    titles: string[],
  ): Promise<void> {
    const metadata = await client.spreadsheets.get({
      spreadsheetId,
      fields: 'sheets.properties.title',
    });
    const existing = new Set(
      (metadata.data.sheets ?? [])
        .map((sheet) => sheet.properties?.title)
        .filter((title): title is string => Boolean(title)),
    );
    const missing = titles.filter((title) => !existing.has(title));
    if (missing.length === 0) return;
    await client.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: missing.map((title) => ({
          addSheet: {
            properties: {
              title,
              gridProperties: { frozenRowCount: 1 },
            },
          },
        })),
      },
    });
  }

  private async readSheet(
    client: sheets_v4.Sheets,
    spreadsheetId: string,
    title: string,
  ): Promise<Cell[][]> {
    const response = await client.spreadsheets.values.get({
      spreadsheetId,
      range: sheetRange(title, 'A1:ZZ20000'),
    });
    return normalizeValues(response.data.values);
  }

  private async writeValues(
    client: sheets_v4.Sheets,
    spreadsheetId: string,
    title: string,
    values: Cell[][],
  ): Promise<void> {
    await client.spreadsheets.values.update({
      spreadsheetId,
      range: sheetRange(title, 'A1'),
      valueInputOption: 'RAW',
      requestBody: { values, majorDimension: 'ROWS' } satisfies Values,
    });
  }

  private async recordSyncError(uid: string, integration: IntegrationRecord, message: string): Promise<void> {
    await this.repo.saveIntegration(uid, {
      ...integration,
      status: 'error',
      lastError: sanitizeSingleLine(message, 500),
      updatedAt: nowIso(),
    });
  }

  async sync(uid: string): Promise<{
    status: IntegrationStatus;
    tabs: Array<{ name: string; updated: number; appended: number; removed: number }>;
  }> {
    const { integration, spreadsheetId, configured, missingCredentials } = await this.resolveConfig(uid);
    const client = this.client();
    if (!configured || !client) {
      throw ApiError.notConfigured(
        'Google Sheets is not configured on the server. Complete the Google Cloud and spreadsheet configuration first.',
        { missing: missingCredentials },
      );
    }

    const records = await this.repo.listPortfolio(uid);
    const tabs = buildTabWorkbooks(records);
    const summary: Array<{ name: string; updated: number; appended: number; removed: number }> = [];

    try {
      await this.ensureWorksheets(client, spreadsheetId, [...tabs.map((tab) => tab.name), METADATA_TITLE]);

      for (const tab of tabs) {
        const existing = await this.readSheet(client, spreadsheetId, tab.name);
        const existingHeaders = existing.length > 0 ? existing[0].map(String) : tab.headers;
        const existingRows = existing.slice(1).filter((row) => row.some((cell) => String(cell).trim() !== ''));
        const result = upsertRows(existingHeaders, existingRows, tab.headers, tab.rows);
        const values: Cell[][] = [tab.headers, ...result.values];
        await this.writeValues(client, spreadsheetId, tab.name, values);
        if (existing.length > values.length) {
          await client.spreadsheets.values.clear({
            spreadsheetId,
            range: sheetRange(tab.name, `A${values.length + 1}:ZZ${existing.length}`),
          });
        }
        summary.push({
          name: tab.name,
          updated: result.updated,
          appended: result.appended,
          removed: result.removed,
        });
      }

      const metadataValues: Cell[][] = [
        METADATA_HEADERS,
        ['application', 'ResumeGEN'],
        ['schemaVersion', '1'],
        ['recordCount', String(records.length)],
        ['lastExportedAt', nowIso()],
        ['sourceOfTruth', 'Firestore'],
      ];
      await this.writeValues(client, spreadsheetId, METADATA_TITLE, metadataValues);

      const syncedAt = nowIso();
      await this.repo.saveIntegration(uid, {
        ...integration,
        spreadsheetId,
        status: 'synced',
        lastSyncAt: syncedAt,
        lastError: undefined,
        pendingChanges: 0,
        updatedAt: syncedAt,
      });
      logger.info('Google Sheets sync completed', {
        uid,
        tabs: summary.length,
        records: records.length,
      });
      return { status: await this.getStatus(uid), tabs: summary };
    } catch (error) {
      const message = friendlySheetsError(error);
      logger.warn('Google Sheets sync failed', { uid, error: errorSummary(error) });
      await this.recordSyncError(uid, { ...integration, spreadsheetId }, message).catch(() => undefined);
      throw ApiError.upstream(message);
    }
  }

  /** Optional automatic sync hook; failures are persisted and never block Firestore writes. */
  async maybeAutoSync(uid: string): Promise<void> {
    try {
      const { integration, configured } = await this.resolveConfig(uid);
      if (!configured || !integration.autoSync) return;
      await this.sync(uid);
    } catch (error) {
      logger.warn('Automatic Google Sheets sync failed', { uid, error: errorSummary(error) });
    }
  }

  async importPreview(uid: string): Promise<{
    proposals: ImportProposal[];
    summary: Record<string, number>;
    spreadsheetIdMasked: string;
  }> {
    const { spreadsheetId, configured, missingCredentials } = await this.resolveConfig(uid);
    const client = this.client();
    if (!configured || !client) {
      throw ApiError.notConfigured(
        'Google Sheets is not configured on the server, so an import preview cannot be read.',
        { missing: missingCredentials },
      );
    }

    const records = await this.repo.listPortfolio(uid);
    const firestoreById = new Map(records.map((record) => [record.id, record]));
    const proposals: ImportProposal[] = [];

    try {
      for (const tab of SHEET_TABS.filter((item) => item.name !== METADATA_TITLE)) {
        let values: Cell[][] = [];
        try {
          values = await this.readSheet(client, spreadsheetId, tab.name);
        } catch (error) {
          const status = (error as { response?: { status?: number } })?.response?.status;
          const message = String((error as { message?: string })?.message ?? '');
          if (status === 404 || (status === 400 && /unable to parse range|not found/i.test(message))) {
            continue; // Tab has not been created yet.
          }
          throw error;
        }
        if (values.length < 2) continue;
        const headers = values[0].map(String);
        const built = buildTab(tab.name, tab.categories, []);
        for (const row of values.slice(1)) {
          if (!row.some((cell) => String(cell).trim() !== '')) continue;
          const parsed = parseSheetRow(headers, row, built.fieldMaps);
          if (!parsed.recordId) continue;

          const issues: string[] = [];
          const category = parsed.category;
          if (!category || !isPortfolioCategory(category)) {
            proposals.push(
              importProposalSchema.parse({
                recordId: parsed.recordId,
                title: parsed.title,
                action: 'invalid',
                data: {},
                issues: [`Unknown or missing Record Type: ${category ?? '(blank)'}`],
              }),
            );
            continue;
          }

          const data = normalizeRecordData(category, parsed.values);
          const validation = validateRecordData(category, data);
          if (!validation.success) {
            issues.push(
              ...zodDetails(validation.error).map((issue) => `${issue.path}: ${issue.message}`),
            );
          }

          const existing = firestoreById.get(parsed.recordId);
          const normalizedData = validation.success
            ? (validation.data as Record<string, unknown>)
            : data;

          if (existing && existing.category !== category) {
            issues.push(
              `Record Type cannot change for an existing record (Firestore: ${existing.category}, sheet: ${category}).`,
            );
          }
          if (parsed.updatedAt && Number.isNaN(Date.parse(parsed.updatedAt))) {
            issues.push('Updated At is not a valid ISO timestamp.');
          }

          let action: ImportProposal['action'] = 'conflict';
          if (issues.length > 0) action = 'invalid';
          else if (!existing) action = 'new';
          else {
            const sameData =
              JSON.stringify(normalizeRecordData(existing.category, existing.data)) ===
              JSON.stringify(normalizedData);
            const sameMeta =
              sanitizeSingleLine(existing.title, 300) === parsed.title &&
              JSON.stringify(existing.tags) === JSON.stringify(parsed.tags);
            if (sameData && sameMeta) action = 'unchanged';
            else if (!parsed.updatedAt) {
              action = 'conflict';
              issues.push('The sheet row has no Updated At value, so the conflict cannot be resolved automatically.');
            } else if (Date.parse(parsed.updatedAt) > Date.parse(existing.updatedAt)) action = 'update';
            else action = 'conflict';
          }

          proposals.push(
            importProposalSchema.parse({
              recordId: parsed.recordId,
              category,
              title: parsed.title || existing?.title || 'Untitled',
              action,
              ...(parsed.updatedAt ? { sheetUpdatedAt: parsed.updatedAt } : {}),
              ...(existing ? { firestoreUpdatedAt: existing.updatedAt } : {}),
              data: normalizedData,
              issues,
            }),
          );
        }
      }
    } catch (error) {
      const message = friendlySheetsError(error);
      logger.warn('Google Sheets import preview failed', { uid, error: errorSummary(error) });
      throw ApiError.upstream(message);
    }

    const summary: Record<string, number> = {
      new: 0,
      update: 0,
      conflict: 0,
      unchanged: 0,
      invalid: 0,
    };
    for (const proposal of proposals) summary[proposal.action] = (summary[proposal.action] ?? 0) + 1;

    return {
      proposals: proposals.sort((a, b) => a.action.localeCompare(b.action) || a.title.localeCompare(b.title)),
      summary,
      spreadsheetIdMasked: maskSpreadsheetId(spreadsheetId),
    };
  }

  async importConfirm(
    uid: string,
    input: { recordIds: string[] },
  ): Promise<{ applied: PortfolioRecord[]; skipped: Array<{ recordId: string; reason: string }> }> {
    const { proposals } = await this.importPreview(uid);
    const requested = new Set(input.recordIds);
    const selected = proposals.filter((proposal) => requested.has(proposal.recordId));
    const applied: PortfolioRecord[] = [];
    const skipped: Array<{ recordId: string; reason: string }> = [];

    for (const proposal of selected) {
      if (proposal.action === 'invalid') {
        skipped.push({ recordId: proposal.recordId, reason: 'The sheet row failed validation.' });
        continue;
      }
      if (proposal.action === 'unchanged') {
        skipped.push({ recordId: proposal.recordId, reason: 'Already in sync with Firestore.' });
        continue;
      }
      if (!proposal.category) {
        skipped.push({ recordId: proposal.recordId, reason: 'Unknown record category.' });
        continue;
      }
      if (!input.recordIds.includes(proposal.recordId)) continue;

      const existing = await this.repo.getPortfolio(uid, proposal.recordId);
      const timestamp = nowIso();
      if (existing) {
        // Spreadsheet edits are untrusted: require the user to re-verify.
        const updated: PortfolioRecord = {
          ...existing,
          title: proposal.title || existing.title,
          data: proposal.data,
          sourceType: 'sheets_import',
          verificationStatus: 'needs_review',
          updatedAt: timestamp,
        };
        applied.push(await this.repo.updatePortfolio(uid, existing.id, updated));
      } else if (proposal.action === 'new') {
        const safeId = /^[A-Za-z0-9_-]{3,200}$/.test(proposal.recordId)
          ? proposal.recordId
          : newId('rec_');
        const record: PortfolioRecord = {
          id: safeId,
          category: proposal.category,
          title: proposal.title || 'Imported record',
          data: proposal.data,
          tags: [],
          sourceType: 'sheets_import',
          verificationStatus: 'needs_review',
          createdAt: timestamp,
          updatedAt: timestamp,
        };
        applied.push(await this.repo.createPortfolio(uid, record));
      } else {
        skipped.push({
          recordId: proposal.recordId,
          reason: 'This row is a conflict but the record no longer exists. Refresh the preview.',
        });
      }
    }

    if (applied.length > 0) await this.repo.markPortfolioChanged(uid);
    return { applied, skipped };
  }
}

export type { TabWorkbook };
