import type { Repository } from '../repositories';
import { PortfolioService } from './portfolioService';
import { JobDescriptionService } from './jobDescriptionService';
import { ResumeService } from './resumeService';
import { GoogleSheetsService } from './googleSheetsService';

export interface Services {
  repo: Repository;
  portfolio: PortfolioService;
  jobs: JobDescriptionService;
  resumes: ResumeService;
  sheets: GoogleSheetsService;
}

export function buildServices(repo: Repository): Services {
  const jobs = new JobDescriptionService(repo);
  return {
    repo,
    portfolio: new PortfolioService(repo),
    jobs,
    resumes: new ResumeService(repo, jobs),
    sheets: new GoogleSheetsService(repo),
  };
}
