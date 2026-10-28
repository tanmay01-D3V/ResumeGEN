import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { bearer, createTestContext, login, seededContext } from './helpers';

describe('authentication and ownership', () => {
  it('exposes a public health check without credentials', async () => {
    const { app } = createTestContext();
    const response = await request(app).get('/api/health');

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      status: 'ok',
      authMode: 'demo',
      database: 'local',
      aiConfigured: false,
    });
  });

  it('rejects protected routes without a bearer token', async () => {
    const { app } = createTestContext();
    const response = await request(app).get('/api/portfolio');

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('unauthorized');
  });

  it('rejects a tampered session token', async () => {
    const { app } = createTestContext();
    const { token } = await login(app);
    const tampered = `${token.slice(0, -2)}xy`;
    const response = await request(app).get('/api/portfolio').set(bearer(tampered));

    expect(response.status).toBe(401);
  });

  it('derives the user from the token and never from a client-supplied uid', async () => {
    const { app } = createTestContext();
    const alice = await login(app, 'alice@example.com', 'Alice');
    const bob = await login(app, 'bob@example.com', 'Bob');

    const created = await request(app)
      .post('/api/portfolio')
      .set(bearer(alice.token))
      .send({
        category: 'projects',
        title: 'Alice private project',
        data: {
          name: 'Alice private project',
          description: 'A private project that belongs to Alice only.',
          technologies: ['Python'],
        },
        tags: [],
        // A malicious client tries to force another owner/status.
        uid: bob.uid,
        verificationStatus: 'verified',
      });

    expect(created.status).toBe(201);
    const recordId = created.body.data.record.id as string;

    const bobList = await request(app).get('/api/portfolio').set(bearer(bob.token));
    expect(bobList.status).toBe(200);
    expect(bobList.body.data.records).toHaveLength(0);

    const bobRead = await request(app)
      .get(`/api/portfolio/${recordId}`)
      .set(bearer(bob.token));
    expect(bobRead.status).toBe(404);

    const bobDelete = await request(app)
      .delete(`/api/portfolio/${recordId}`)
      .set(bearer(bob.token));
    expect(bobDelete.status).toBe(404);

    const aliceRead = await request(app)
      .get(`/api/portfolio/${recordId}`)
      .set(bearer(alice.token));
    expect(aliceRead.status).toBe(200);
  });
});

describe('portfolio CRUD', () => {
  it('creates, lists, updates and deletes a validated record', async () => {
    const { app } = createTestContext();
    const { token } = await login(app);

    const created = await request(app)
      .post('/api/portfolio')
      .set(bearer(token))
      .send({
        category: 'projects',
        title: 'Interview scheduler',
        tags: ['TypeScript', 'React', 'TypeScript'],
        data: {
          name: 'Interview scheduler',
          description: 'Built a scheduler that coordinates interview panels and candidate availability.',
          technologies: 'React, TypeScript, PostgreSQL',
          achievements: 'Reduced manual scheduling effort\nAdded conflict detection',
          unknownField: 'must be dropped by normalisation',
        },
      });

    expect(created.status).toBe(201);
    const record = created.body.data.record;
    expect(record.id).toMatch(/^rec_/);
    expect(record.category).toBe('projects');
    expect(record.data.technologies).toEqual(['React', 'TypeScript', 'PostgreSQL']);
    expect(record.data.unknownField).toBeUndefined();
    expect(record.tags).toEqual(['TypeScript', 'React']);
    expect(record.verificationStatus).toBe('verified');

    const list = await request(app).get('/api/portfolio').set(bearer(token));
    expect(list.body.data.records).toHaveLength(1);

    const updated = await request(app)
      .patch(`/api/portfolio/${record.id}`)
      .set(bearer(token))
      .send({ title: 'Renamed scheduler', verificationStatus: 'needs_review', tags: ['React'] });

    expect(updated.status).toBe(200);
    expect(updated.body.data.record.title).toBe('Renamed scheduler');
    expect(updated.body.data.record.verificationStatus).toBe('needs_review');
    expect(updated.body.data.record.data.technologies).toEqual(['React', 'TypeScript', 'PostgreSQL']);

    const deleted = await request(app)
      .delete(`/api/portfolio/${record.id}`)
      .set(bearer(token));
    expect(deleted.status).toBe(200);

    const after = await request(app).get('/api/portfolio').set(bearer(token));
    expect(after.body.data.records).toHaveLength(0);
  });

  it('rejects invalid records with field-level details', async () => {
    const { app } = createTestContext();
    const { token } = await login(app);

    const response = await request(app)
      .post('/api/portfolio')
      .set(bearer(token))
      .send({ category: 'personal_info', title: '', data: { fullName: 'A' } });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('validation_error');
    expect(response.body.error.details.length).toBeGreaterThan(0);
  });

  it('prevents duplicate singleton records such as personal information', async () => {
    const { app } = createTestContext();
    const { token } = await login(app);

    const body = {
      category: 'personal_info',
      title: 'Ada Lovelace',
      data: { fullName: 'Ada Lovelace', email: 'ada@example.com' },
    };

    expect((await request(app).post('/api/portfolio').set(bearer(token)).send(body)).status).toBe(201);
    const duplicate = await request(app).post('/api/portfolio').set(bearer(token)).send(body);

    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error.code).toBe('conflict');
  });
});

describe('job descriptions', () => {
  it('creates, analyses with the transparent heuristic engine, and invalidates stale analysis on edit', async () => {
    const { app } = createTestContext();
    const { token } = await login(app);

    const rawText = `Backend Engineer — Test Company

Responsibilities
- Build REST APIs with Node.js and Express.js.
- Design PostgreSQL schemas and write efficient SQL queries.
- Write tests and review pull requests using Git.

Required qualifications
- Bachelor's degree in Computer Science or equivalent.
- 1-3 years of experience building production web services.
- Strong TypeScript skills.

Preferred qualifications
- Experience with Docker and AWS.
- Familiarity with GraphQL is a plus.`;

    const created = await request(app)
      .post('/api/job-descriptions')
      .set(bearer(token))
      .send({ jobTitle: 'Backend Engineer', company: 'Test Company', rawText });
    expect(created.status).toBe(201);
    const job = created.body.data.jobDescription;

    const analyzed = await request(app)
      .post(`/api/job-descriptions/${job.id}/analyze`)
      .set(bearer(token));
    expect(analyzed.status).toBe(200);
    expect(analyzed.body.data.job.analysisEngine).toBe('heuristic');
    expect(analyzed.body.data.warning).toContain('Gemini is not configured');
    expect(analyzed.body.data.job.analysis.requiredSkills).toContain('Node.js');
    expect(analyzed.body.data.job.analysis.requiredSkills).toContain('PostgreSQL');
    expect(analyzed.body.data.job.analysis.preferredSkills).toContain('Docker');

    const edited = await request(app)
      .patch(`/api/job-descriptions/${job.id}`)
      .set(bearer(token))
      .send({ jobTitle: 'Backend Engineer', company: 'Test Company', rawText: `${rawText}\n\nUpdated requirement: Kubernetes.` });

    expect(edited.status).toBe(200);
    expect(edited.body.data.jobDescription.analysis).toBeUndefined();
    expect(edited.body.data.jobDescription.analysisTimestamp).toBeUndefined();
  });
});

describe('dashboard and seed data', () => {
  it('seeds fictional sample data once and reports dashboard counts', async () => {
    const { app, token } = await seededContext();

    const dashboard = await request(app).get('/api/dashboard').set(bearer(token));
    expect(dashboard.status).toBe(200);
    expect(dashboard.body.data.counts.portfolioEntries).toBeGreaterThan(10);
    expect(dashboard.body.data.counts.jobDescriptions).toBe(2);
    expect(dashboard.body.data.hasPersonalInfo).toBe(true);
    expect(dashboard.body.data.hasSummary).toBe(true);

    const secondSeed = await request(app).post('/api/demo/seed').set(bearer(token));
    expect(secondSeed.status).toBe(201);
    expect(secondSeed.body.data.portfolioCreated).toBe(0);
    expect(secondSeed.body.data.jobDescriptionsCreated).toBe(0);
  });
});
