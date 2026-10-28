import { getEnv } from '../config/env';
import { getFirebase } from '../config/firebase';
import { logger } from '../utils/logger';
import { FirestoreRepository } from './firestore';
import { LocalRepository } from './local';
import type { Repository } from './types';

let repository: Repository | null = null;

export function createRepository(): Repository {
  if (repository) return repository;
  const env = getEnv();

  if (env.useLocalStore) {
    repository = new LocalRepository(env.dbFile);
    logger.info('Using local demo store', { file: env.dbFile });
    return repository;
  }

  const firebase = getFirebase();
  if (!firebase) {
    throw new Error(
      'Firestore mode selected but Firebase Admin could not be initialised. ' +
        'Check FIREBASE_* credentials or set DEMO_MODE=true.',
    );
  }
  repository = new FirestoreRepository(firebase.db);
  logger.info('Using Firestore repository');
  return repository;
}

export function setRepositoryForTests(next: Repository | null): void {
  repository = next;
}

export type { Repository, IntegrationRecord } from './types';
export { emptyIntegration } from './types';
