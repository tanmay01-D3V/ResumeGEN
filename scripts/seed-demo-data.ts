/**
 * Seed the fictional demo portfolio and sample job descriptions.
 *
 * Usage: npm run seed [-- email@example.com "Display Name"]
 *
 * Only runs against the local demo repository. This prevents accidentally
 * writing sample records into a Firebase project.
 */
import { getEnv } from '../Backend/src/config/env';
import { createRepository } from '../Backend/src/repositories';
import { seedDemoData } from '../Backend/src/services/seedService';
import { demoUid } from '../Backend/src/utils/ids';

async function main(): Promise<void> {
  const env = getEnv();
  if (env.authMode !== 'demo' || !env.useLocalStore) {
    throw new Error(
      'The seed script only targets the local demo store. Set DEMO_MODE=true (and unset Firebase credentials) before seeding.',
    );
  }

  const email = (process.argv[2] || 'demo@example.com').trim().toLowerCase();
  const displayName = (process.argv[3] || 'Aarav Mehta').trim();
  const uid = demoUid(email);
  const repo = createRepository();
  const existing = await repo.getUser(uid);

  const result = await seedDemoData(repo, {
    uid,
    email,
    displayName: existing?.displayName || displayName,
  });

  console.log(
    [
      `Seeded demo workspace for ${email} (${uid}).`,
      `Portfolio: ${result.portfolioCreated} created, ${result.portfolioSkipped} skipped.`,
      `Job descriptions: ${result.jobDescriptionsCreated} created, ${result.jobDescriptionsSkipped} skipped.`,
      `Store: ${env.dbFile}`,
    ].join('\n'),
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
