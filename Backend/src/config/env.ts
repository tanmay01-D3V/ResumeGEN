import path from 'node:path';
import fs from 'node:fs';
import dotenv from 'dotenv';

const backendRoot = path.resolve(__dirname, '../..');
const projectRoot = path.resolve(backendRoot, '..');

// Root .env is the documented location. Backend/.env can override it locally.
dotenv.config({ path: path.join(projectRoot, '.env') });
dotenv.config({ path: path.join(backendRoot, '.env'), override: true });

export type AuthMode = 'firebase' | 'demo';

export interface AppEnv {
  nodeEnv: string;
  port: number;
  frontendUrls: string[];
  authMode: AuthMode;
  demoModeReason: string;
  sessionSecret: string;
  dbFile: string;
  geminiApiKey: string;
  geminiModel: string;
  geminiTimeoutMs: number;
  spreadsheetId: string;
  googleCredentialsPath: string;
  firebaseProjectId: string;
  firebaseClientEmail: string;
  firebasePrivateKey: string;
  hasFirebaseCredentials: boolean;
  hasGoogleCredentials: boolean;
  backendRoot: string;
  useLocalStore: boolean;
}

let cached: AppEnv | null = null;

function bool(value: string | undefined): boolean {
  return value === 'true' || value === '1';
}

function resolveCredentialPath(value: string): string {
  if (!value) return '';
  if (path.isAbsolute(value)) return value;
  const fromCwd = path.resolve(process.cwd(), value);
  if (fs.existsSync(fromCwd)) return fromCwd;
  const fromRoot = path.resolve(projectRoot, value);
  if (fs.existsSync(fromRoot)) return fromRoot;
  return fromCwd;
}

export function buildEnv(): AppEnv {
  const nodeEnv = process.env.NODE_ENV || 'development';
  const firebaseProjectId = process.env.FIREBASE_PROJECT_ID?.trim() || '';
  const firebaseClientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim() || '';
  const firebasePrivateKey = (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n').trim();
  const googleCredentialsPath = resolveCredentialPath(
    process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim() || '',
  );

  const hasFirebaseCredentials = Boolean(
    (firebaseProjectId && firebaseClientEmail && firebasePrivateKey) ||
      (googleCredentialsPath && fs.existsSync(googleCredentialsPath)),
  );

  const forceDemo = bool(process.env.DEMO_MODE) || nodeEnv === 'test';
  const authMode: AuthMode = forceDemo || !hasFirebaseCredentials ? 'demo' : 'firebase';

  let demoModeReason = '';
  if (authMode === 'demo') {
    demoModeReason = forceDemo
      ? 'DEMO_MODE is enabled. Accounts are stored locally and signed with a development token.'
      : 'Firebase Admin credentials are not configured, so the server is using local demo authentication.';
  }

  const sessionSecret =
    process.env.SESSION_SECRET?.trim() ||
    (nodeEnv === 'production'
      ? ''
      : 'resumegen-local-development-secret-do-not-use-in-production');

  if (nodeEnv === 'production' && !sessionSecret) {
    throw new Error('SESSION_SECRET is required in production.');
  }

  const frontendUrls = (process.env.FRONTEND_URL || 'http://localhost:5173')
    .split(',')
    .map((value) => value.trim().replace(/\/$/, ''))
    .filter(Boolean);

  const dbFileRaw = process.env.DB_FILE?.trim() || path.join(backendRoot, '.data', 'db.json');
  const dbFile = dbFileRaw === ':memory:'
    ? ':memory:'
    : path.isAbsolute(dbFileRaw)
      ? dbFileRaw
      : path.resolve(projectRoot, dbFileRaw);

  return {
    nodeEnv,
    port: Number(process.env.PORT || 5050),
    frontendUrls,
    authMode,
    demoModeReason,
    sessionSecret,
    dbFile,
    geminiApiKey: process.env.GEMINI_API_KEY?.trim() || '',
    geminiModel: process.env.GEMINI_MODEL?.trim() || 'gemini-2.5-flash',
    geminiTimeoutMs: Number(process.env.GEMINI_TIMEOUT_MS || 30000),
    spreadsheetId: process.env.GOOGLE_SHEETS_SPREADSHEET_ID?.trim() || '',
    googleCredentialsPath,
    firebaseProjectId,
    firebaseClientEmail,
    firebasePrivateKey,
    hasFirebaseCredentials,
    hasGoogleCredentials: Boolean(
      (googleCredentialsPath && fs.existsSync(googleCredentialsPath)) ||
        (firebaseClientEmail && firebasePrivateKey),
    ),
    backendRoot,
    useLocalStore: process.env.FIRESTORE_EMULATOR_HOST ? false : authMode === 'demo',
  };
}

export function getEnv(): AppEnv {
  if (!cached) cached = buildEnv();
  return cached;
}

export function resetEnvForTests(): void {
  cached = null;
}

export const projectPaths = {
  backendRoot,
  projectRoot,
};
