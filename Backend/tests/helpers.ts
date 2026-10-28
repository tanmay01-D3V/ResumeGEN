import type { Express } from 'express';
import type { Response } from 'superagent';
import request from 'supertest';
import { expect } from 'vitest';
import { createApp } from '../src/app';
import { LocalRepository } from '../src/repositories/local';
import { buildServices, type Services } from '../src/services';

export interface TestContext {
  app: Express;
  repo: LocalRepository;
  services: Services;
}

export function createTestContext(): TestContext {
  const repo = new LocalRepository(':memory:');
  const services = buildServices(repo);
  const app = createApp({ services });
  return { app, repo, services };
}

export function bearer(token: string): { Authorization: string } {
  return { Authorization: `Bearer ${token}` };
}

export async function login(
  app: Express,
  email = 'tester@example.com',
  name = 'Test User',
): Promise<{ token: string; uid: string }> {
  const response = await request(app).post('/api/auth/demo').send({ email, name });
  expect(response.status).toBe(200);
  return {
    token: response.body.data.token as string,
    uid: response.body.data.user.uid as string,
  };
}

export async function seededContext(options?: { email?: string; name?: string }): Promise<
  TestContext & { token: string; uid: string; records: any[]; jobs: any[] }
> {
  const context = createTestContext();
  const session = await login(
    context.app,
    options?.email ?? 'tester@example.com',
    options?.name ?? 'Test User',
  );
  const seeded = await request(context.app)
    .post('/api/demo/seed')
    .set(bearer(session.token));
  expect(seeded.status).toBe(201);

  const portfolio = await request(context.app)
    .get('/api/portfolio')
    .set(bearer(session.token));
  const jobs = await request(context.app)
    .get('/api/job-descriptions')
    .set(bearer(session.token));

  return {
    ...context,
    token: session.token,
    uid: session.uid,
    records: portfolio.body.data.records,
    jobs: jobs.body.data.jobDescriptions,
  };
}

/** Collects a binary PDF body so PDF endpoints can be asserted directly. */
export function binaryParser(response: Response, callback: (error: Error | null, body?: Buffer) => void): void {
  const chunks: Buffer[] = [];
  response.on('data', (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
  response.on('end', () => callback(null, Buffer.concat(chunks)));
  response.on('error', (error: Error) => callback(error));
}
