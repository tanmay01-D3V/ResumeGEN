import { applicationDefault, cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { getEnv } from './env';
import { errorSummary, logger } from '../utils/logger';

export interface FirebaseContext {
  app: App;
  auth: Auth;
  db: Firestore;
}

let cached: FirebaseContext | null | undefined;

export function getFirebase(): FirebaseContext | null {
  if (cached !== undefined) return cached;
  const env = getEnv();
  if (!env.hasFirebaseCredentials) {
    cached = null;
    return null;
  }

  try {
    const existing = getApps();
    const app =
      existing[0] ??
      initializeApp({
        ...(env.firebaseProjectId ? { projectId: env.firebaseProjectId } : {}),
        credential:
          env.firebaseClientEmail && env.firebasePrivateKey
            ? cert({
                projectId: env.firebaseProjectId,
                clientEmail: env.firebaseClientEmail,
                privateKey: env.firebasePrivateKey,
              })
            : applicationDefault(),
      });
    cached = { app, auth: getAuth(app), db: getFirestore(app) };
    logger.info('Firebase Admin initialised', { projectId: env.firebaseProjectId || 'application-default' });
    return cached;
  } catch (error) {
    logger.error('Firebase Admin initialisation failed', { error: errorSummary(error) });
    cached = null;
    return null;
  }
}

export function resetFirebaseForTests(): void {
  cached = undefined;
}
