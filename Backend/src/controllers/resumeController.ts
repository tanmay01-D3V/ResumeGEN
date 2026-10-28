import type { Request, Response } from 'express';
import {
  generateResumeRequestSchema,
  matchRequestSchema,
  saveResumeRequestSchema,
  suggestionsRequestSchema,
} from '../../../shared/schemas';
import { currentUser } from '../middleware/auth';
import type { Services } from '../services';
import { resumeTitleSchema } from '../services/resumeService';

function sendPdf(res: Response, buffer: Buffer, filename: string): void {
  const ascii = filename
    .normalize('NFKD')
    .replace(/[^\x20-\x7E]/g, '_')
    .replace(/["\\]/g, '')
    .replace(/_+/g, '_');
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${ascii || 'resume.pdf'}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
  );
  res.setHeader('Content-Length', String(buffer.length));
  res.setHeader('Cache-Control', 'no-store');
  res.send(buffer);
}

export class ResumeController {
  constructor(private readonly services: Services) {}

  match = async (req: Request, res: Response): Promise<void> => {
    const auth = currentUser(req);
    const body = matchRequestSchema.parse(req.body);
    const result = await this.services.resumes.match(auth.uid, body.jobDescriptionId, body.useAi);
    res.json({ data: result });
  };

  generate = async (req: Request, res: Response): Promise<void> => {
    const auth = currentUser(req);
    const body = generateResumeRequestSchema.parse(req.body);
    const result = await this.services.resumes.generate(auth.uid, body);
    res.json({ data: result });
  };

  previewPdf = async (req: Request, res: Response): Promise<void> => {
    const auth = currentUser(req);
    const body = generateResumeRequestSchema.parse(req.body);
    const result = await this.services.resumes.renderPreviewPdf(auth.uid, body);
    sendPdf(res, result.buffer, result.filename);
  };

  save = async (req: Request, res: Response): Promise<void> => {
    const auth = currentUser(req);
    const body = saveResumeRequestSchema.parse(req.body);
    const resume = await this.services.resumes.save(auth.uid, body);
    res.status(201).json({ data: { resume } });
  };

  list = async (req: Request, res: Response): Promise<void> => {
    const auth = currentUser(req);
    const resumes = await this.services.resumes.list(auth.uid);
    res.json({ data: { resumes } });
  };

  get = async (req: Request, res: Response): Promise<void> => {
    const auth = currentUser(req);
    const resume = await this.services.resumes.get(auth.uid, String(req.params.id));
    res.json({ data: { resume } });
  };

  rename = async (req: Request, res: Response): Promise<void> => {
    const auth = currentUser(req);
    const body = resumeTitleSchema.parse(req.body);
    const resume = await this.services.resumes.rename(auth.uid, String(req.params.id), body.title);
    res.json({ data: { resume } });
  };

  remove = async (req: Request, res: Response): Promise<void> => {
    const auth = currentUser(req);
    await this.services.resumes.remove(auth.uid, String(req.params.id));
    res.json({ data: { id: String(req.params.id), deleted: true } });
  };

  savedPdf = async (req: Request, res: Response): Promise<void> => {
    const auth = currentUser(req);
    const result = await this.services.resumes.renderSavedPdf(auth.uid, String(req.params.id));
    sendPdf(res, result.buffer, result.filename);
  };

  suggest = async (req: Request, res: Response): Promise<void> => {
    const auth = currentUser(req);
    const body = suggestionsRequestSchema.parse(req.body);
    const result = await this.services.resumes.suggest(auth.uid, body);
    res.json({ data: result });
  };
}
