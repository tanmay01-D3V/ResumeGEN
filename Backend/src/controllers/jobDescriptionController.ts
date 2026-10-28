import type { Request, Response } from 'express';
import { jobDescriptionInputSchema } from '../../../shared/schemas';
import { currentUser } from '../middleware/auth';
import type { Services } from '../services';

export class JobDescriptionController {
  constructor(private readonly services: Services) {}

  list = async (req: Request, res: Response): Promise<void> => {
    const auth = currentUser(req);
    const jobs = await this.services.jobs.list(auth.uid);
    res.json({ data: { jobDescriptions: jobs } });
  };

  get = async (req: Request, res: Response): Promise<void> => {
    const auth = currentUser(req);
    const job = await this.services.jobs.get(auth.uid, String(req.params.id));
    res.json({ data: { jobDescription: job } });
  };

  create = async (req: Request, res: Response): Promise<void> => {
    const auth = currentUser(req);
    const input = jobDescriptionInputSchema.parse(req.body);
    const job = await this.services.jobs.create(auth.uid, input);
    res.status(201).json({ data: { jobDescription: job } });
  };

  update = async (req: Request, res: Response): Promise<void> => {
    const auth = currentUser(req);
    const input = jobDescriptionInputSchema.parse(req.body);
    const job = await this.services.jobs.update(auth.uid, String(req.params.id), input);
    res.json({ data: { jobDescription: job } });
  };

  remove = async (req: Request, res: Response): Promise<void> => {
    const auth = currentUser(req);
    await this.services.jobs.remove(auth.uid, String(req.params.id));
    res.json({ data: { id: String(req.params.id), deleted: true } });
  };

  analyze = async (req: Request, res: Response): Promise<void> => {
    const auth = currentUser(req);
    const result = await this.services.jobs.analyze(auth.uid, String(req.params.id));
    res.json({ data: result });
  };
}
