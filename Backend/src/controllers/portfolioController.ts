import type { Request, Response } from 'express';
import {
  importConfirmSchema,
  importPreviewRequestSchema,
  portfolioRecordInputSchema,
  portfolioRecordPatchSchema,
} from '../../../shared/schemas';
import { currentUser } from '../middleware/auth';
import { ApiError } from '../utils/errors';
import type { Services } from '../services';

export class PortfolioController {
  constructor(private readonly services: Services) {}

  list = async (req: Request, res: Response): Promise<void> => {
    const auth = currentUser(req);
    const records = await this.services.portfolio.list(auth.uid);
    res.json({ data: { records } });
  };

  get = async (req: Request, res: Response): Promise<void> => {
    const auth = currentUser(req);
    const record = await this.services.portfolio.get(auth.uid, String(req.params.id));
    res.json({ data: { record } });
  };

  create = async (req: Request, res: Response): Promise<void> => {
    const auth = currentUser(req);
    const input = portfolioRecordInputSchema.parse(req.body);
    const record = await this.services.portfolio.create(auth.uid, input);
    void this.services.sheets.maybeAutoSync(auth.uid);
    res.status(201).json({ data: { record } });
  };

  update = async (req: Request, res: Response): Promise<void> => {
    const auth = currentUser(req);
    const patch = portfolioRecordPatchSchema.parse(req.body);
    const record = await this.services.portfolio.update(auth.uid, String(req.params.id), patch);
    void this.services.sheets.maybeAutoSync(auth.uid);
    res.json({ data: { record } });
  };

  remove = async (req: Request, res: Response): Promise<void> => {
    const auth = currentUser(req);
    await this.services.portfolio.remove(auth.uid, String(req.params.id));
    void this.services.sheets.maybeAutoSync(auth.uid);
    res.json({ data: { id: String(req.params.id), deleted: true } });
  };

  structureText = async (req: Request, res: Response): Promise<void> => {
    const auth = currentUser(req);
    const body = importPreviewRequestSchema.parse(req.body);
    const result = await this.services.portfolio.structureText(body.text);
    res.json({ data: result });
  };

  importConfirm = async (req: Request, res: Response): Promise<void> => {
    const auth = currentUser(req);
    const body = importConfirmSchema.parse(req.body);
    const records = body.records.map((record) => ({
      ...record,
      tags: record.tags ?? [],
    }));
    const result = await this.services.portfolio.confirmImport(auth.uid, records);
    if (result.created.length === 0) {
      throw ApiError.badRequest(
        'No records were saved. Review the skipped items and fix the data before confirming.',
        { skipped: result.skipped },
      );
    }
    void this.services.sheets.maybeAutoSync(auth.uid);
    res.status(201).json({ data: result });
  };
}
