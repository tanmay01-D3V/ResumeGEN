import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { DEFAULT_SECTION_ORDER } from '../../shared/schemas';
import { bearer, binaryParser, seededContext } from './helpers';

function baseSettings() {
  return {
    sectionOrder: [...DEFAULT_SECTION_ORDER],
    template: 'classic' as const,
    layout: 'one_page' as const,
    contactOverrides: {},
  };
}

describe('matching, generation and PDF export', () => {
  it('matches only verified portfolio evidence and never treats a job keyword as proof', async () => {
    const { app, token, records, jobs } = await seededContext();
    const mlJob = jobs.find((job) => job.jobTitle === 'Machine Learning Engineer');
    expect(mlJob?.analysis).toBeTruthy();

    const response = await request(app)
      .post('/api/resumes/match')
      .set(bearer(token))
      .send({ jobDescriptionId: mlJob.id, useAi: false });

    expect(response.status).toBe(200);
    const match = response.body.data;
    expect(match.engine).toBe('deterministic');
    expect(match.matches.length).toBeGreaterThan(5);

    const python = match.matches.find((item: any) => item.requirement === 'Python');
    expect(python.status).toBe('strong');
    expect(python.recordIds.length).toBeGreaterThan(0);
    for (const id of python.recordIds) {
      const record = records.find((entry) => entry.id === id);
      expect(record).toBeTruthy();
      expect(record.verificationStatus).toBe('verified');
    }

    // Every evidence ID must point to a real verified record owned by the user.
    const verifiedIds = new Set(records.map((record) => record.id));
    for (const item of match.matches) {
      for (const id of item.recordIds) expect(verifiedIds.has(id)).toBe(true);
    }

    const fake = match.matches.find((item: any) => item.requirement === 'Kubernetes');
    if (fake) {
      expect(fake.status).toBe('not_evidenced');
      expect(fake.recordIds).toEqual([]);
    }

    // Unverified records never appear in ranked records.
    const rankedIds = new Set(match.rankedRecords.map((entry: any) => entry.recordId));
    for (const id of rankedIds) {
      expect(records.find((record) => record.id === id)?.verificationStatus).toBe('verified');
    }
  });

  it('refuses to match or generate before the job description is analysed', async () => {
    const { app, token } = await seededContext();
    const created = await request(app)
      .post('/api/job-descriptions')
      .set(bearer(token))
      .send({
        jobTitle: 'Data Analyst',
        rawText:
          'Analyse product data using SQL and Python. Build dashboards and present insights to stakeholders. Requires strong communication skills and attention to detail.',
      });
    const jobId = created.body.data.jobDescription.id;

    const match = await request(app)
      .post('/api/resumes/match')
      .set(bearer(token))
      .send({ jobDescriptionId: jobId, useAi: false });
    expect(match.status).toBe(400);
    expect(match.body.error.message).toContain('Analyse this job description');

    const generate = await request(app)
      .post('/api/resumes/generate')
      .set(bearer(token))
      .send({
        jobDescriptionId: jobId,
        selectedRecordIds: [created.body.data.jobDescription.id],
        settings: baseSettings(),
        useAiSummary: false,
      });
    expect(generate.status).toBe(400);
  });

  it('generates a server-assembled document, saves a snapshot, and detects staleness', async () => {
    const { app, token, records, jobs } = await seededContext();
    const job = jobs.find((entry) => entry.jobTitle === 'Full-Stack Developer');

    const project = records.find((record) => record.category === 'projects');
    const skill = records.find((record) => record.category === 'technical_skills');
    const education = records.find((record) => record.category === 'education');
    expect(project && skill && education).toBeTruthy();

    const selectedRecordIds = [project.id, skill.id, education.id];
    const generate = await request(app)
      .post('/api/resumes/generate')
      .set(bearer(token))
      .send({
        jobDescriptionId: job.id,
        selectedRecordIds,
        settings: baseSettings(),
        useAiSummary: false,
      });

    expect(generate.status).toBe(200);
    const result = generate.body.data;
    expect(result.document.name).toBe('Aarav Mehta');
    expect(result.document.sections.map((section: any) => section.key)).toEqual(
      expect.arrayContaining(['skills', 'projects', 'education']),
    );
    expect(result.document.engine).toBe('deterministic');
    expect(result.portfolioFingerprint).toMatch(/^[a-f0-9]{32}$/);

    // Section order is honoured.
    const keys = result.document.sections.map((section: any) => section.key);
    expect(keys.indexOf('skills')).toBeLessThan(keys.indexOf('projects'));

    const saved = await request(app)
      .post('/api/resumes')
      .set(bearer(token))
      .send({
        title: 'Full-Stack tailored version',
        jobDescriptionId: job.id,
        selectedRecordIds,
        settings: baseSettings(),
        aiAssisted: false,
      });

    expect(saved.status).toBe(201);
    const resume = saved.body.data.resume;
    expect(resume.id).toMatch(/^resume_/);
    expect(resume.document).toBeTruthy();
    expect(resume.selectedRecordIds.sort()).toEqual([...selectedRecordIds].sort());

    const listed = await request(app).get('/api/resumes').set(bearer(token));
    expect(listed.body.data.resumes[0].outdated).toBe(false);

    // Edit a selected record so the saved snapshot no longer reflects the portfolio.
    await new Promise((resolve) => setTimeout(resolve, 10));
    const patched = await request(app)
      .patch(`/api/portfolio/${project.id}`)
      .set(bearer(token))
      .send({ title: `${project.title} (revised)` });
    expect(patched.status).toBe(200);

    const afterEdit = await request(app)
      .get(`/api/resumes/${resume.id}`)
      .set(bearer(token));
    expect(afterEdit.body.data.resume.outdated).toBe(true);
  });

  it('rejects unverified or removed records instead of silently dropping them', async () => {
    const { app, token, jobs } = await seededContext();
    const job = jobs[0];

    const unverified = await request(app)
      .post('/api/portfolio')
      .set(bearer(token))
      .send({
        category: 'projects',
        title: 'Unverified claim',
        data: { name: 'Unverified claim', description: 'A project that has not been reviewed yet.' },
        tags: [],
        verificationStatus: 'needs_review',
      });
    const unverifiedId = unverified.body.data.record.id;

    const response = await request(app)
      .post('/api/resumes/generate')
      .set(bearer(token))
      .send({
        jobDescriptionId: job.id,
        selectedRecordIds: [unverifiedId],
        settings: baseSettings(),
        useAiSummary: false,
      });

    expect(response.status).toBe(400);
    expect(response.body.error.message).toContain('Only verified records');

    const missing = await request(app)
      .post('/api/resumes/generate')
      .set(bearer(token))
      .send({
        jobDescriptionId: job.id,
        selectedRecordIds: ['rec_does_not_exist'],
        settings: baseSettings(),
        useAiSummary: false,
      });
    expect(missing.status).toBe(400);
    expect(missing.body.error.message).toContain('no longer exist');
  });

  it('renders preview and saved PDFs from the server snapshot', async () => {
    const { app, token, records, jobs } = await seededContext();
    const job = jobs[0];
    const selectedRecordIds = records
      .filter((record) => ['projects', 'technical_skills', 'education'].includes(record.category))
      .slice(0, 4)
      .map((record) => record.id);

    const preview = await request(app)
      .post('/api/resumes/pdf')
      .set(bearer(token))
      .send({
        jobDescriptionId: job.id,
        selectedRecordIds,
        settings: baseSettings(),
        useAiSummary: false,
      })
      .buffer(true)
      .parse(binaryParser);

    expect(preview.status).toBe(200);
    expect(String(preview.headers['content-type'])).toContain('application/pdf');
    expect(String(preview.headers['content-disposition'])).toContain('attachment');
    expect(Buffer.isBuffer(preview.body)).toBe(true);
    expect(preview.body.subarray(0, 5).toString()).toBe('%PDF-');
    expect(preview.body.length).toBeGreaterThan(1000);

    const saved = await request(app)
      .post('/api/resumes')
      .set(bearer(token))
      .send({
        title: 'PDF snapshot',
        jobDescriptionId: job.id,
        selectedRecordIds,
        settings: baseSettings(),
        aiAssisted: false,
      });
    const resumeId = saved.body.data.resume.id;

    const savedPdf = await request(app)
      .get(`/api/resumes/${resumeId}/pdf`)
      .set(bearer(token))
      .buffer(true)
      .parse(binaryParser);

    expect(savedPdf.status).toBe(200);
    expect(savedPdf.body.subarray(0, 5).toString()).toBe('%PDF-');
  });

  it('returns deterministic improvement suggestions with a disclaimer', async () => {
    const { app, token, records, jobs } = await seededContext();
    const job = jobs[0];
    const projects = records.filter((record) => record.category === 'projects');

    const response = await request(app)
      .post('/api/resumes/suggestions')
      .set(bearer(token))
      .send({
        jobDescriptionId: job.id,
        selectedRecordIds: projects.map((record) => record.id),
      });

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body.data.suggestions)).toBe(true);
    expect(response.body.data.suggestions.length).toBeGreaterThan(0);
    expect(response.body.data.disclaimer).toContain('not verified facts');
    expect(response.body.data.engine).toBe('heuristic');
  });
});

describe('Google Sheets integration without credentials', () => {
  it('reports missing configuration but still previews the workbook from Firestore', async () => {
    const { app, token, records } = await seededContext();

    const status = await request(app)
      .get('/api/integrations/google-sheets/status')
      .set(bearer(token));
    expect(status.status).toBe(200);
    expect(status.body.data.status.configured).toBe(false);
    expect(status.body.data.status.missingCredentials.length).toBeGreaterThan(0);

    const preview = await request(app)
      .get('/api/integrations/google-sheets/preview')
      .set(bearer(token));
    expect(preview.status).toBe(200);
    expect(preview.body.data.preview.recordCount).toBe(records.length);
    expect(preview.body.data.preview.tabs.length).toBeGreaterThan(5);

    const projectTab = preview.body.data.preview.tabs.find((tab: any) => tab.name === 'Projects');
    expect(projectTab.recordIds.length).toBeGreaterThan(0);
    expect(projectTab.rows.length).toBe(projectTab.recordIds.length);
  });

  it('returns 503 with actionable detail when a live sync is requested', async () => {
    const { app, token } = await seededContext();

    const response = await request(app)
      .post('/api/integrations/google-sheets/sync')
      .set(bearer(token));

    expect(response.status).toBe(503);
    expect(response.body.error.code).toBe('not_configured');
    expect(response.body.error.details.missing).toBeTruthy();
  });
});
