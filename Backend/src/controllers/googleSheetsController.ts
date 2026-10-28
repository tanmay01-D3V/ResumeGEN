import type { Request, Response } from 'express';
import { z } from 'zod';
import { currentUser } from '../middleware/auth';
import type { Services } from '../services';

export const sheetsConfigSchema = z
  .object({
    spreadsheetId: z.string().trim().max(500).optional(),
    autoSync: z.boolean().optional(),
  })
  .refine((value) => value.spreadsheetId !== undefined || value.autoSync !== undefined, {
    message: 'Provide a spreadsheet ID or an autoSync setting.',
  });

export const sheetsImportConfirmSchema = z.object({
  recordIds: z.array(z.string().min(1)).min(1).max(500),
});

export class GoogleSheetsController {
  constructor(private readonly services: Services) {}

  status = async (req: Request, res: Response): Promise<void> => {
    const auth = currentUser(req);
    const status = await this.services.sheets.getStatus(auth.uid);
    res.json({ data: { status } });
  };

  preview = async (req: Request, res: Response): Promise<void> => {
    const auth = currentUser(req);
    const preview = await this.services.sheets.preview(auth.uid);
    res.json({ data: { preview } });
  };

  config = async (req: Request, res: Response): Promise<void> => {
    const auth = currentUser(req);
    const body = sheetsConfigSchema.parse(req.body);
    const status = await this.services.sheets.updateConfig(auth.uid, body);
    res.json({ data: { status } });
  };

  sync = async (req: Request, res: Response): Promise<void> => {
    const auth = currentUser(req);
    const result = await this.services.sheets.sync(auth.uid);
    res.json({ data: result });
  };

  importPreview = async (req: Request, res: Response): Promise<void> => {
    const auth = currentUser(req);
    const result = await this.services.sheets.importPreview(auth.uid);
    res.json({ data: result });
  };

  importConfirm = async (req: Request, res: Response): Promise<void> => {
    const auth = currentUser(req);
    const body = sheetsImportConfirmSchema.parse(req.body);
    const result = await this.services.sheets.importConfirm(auth.uid, body);
    res.json({ data: result });
  };
}
