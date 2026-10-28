import { google, type sheets_v4 } from 'googleapis';
import { getEnv } from './env';
import { logger } from '../utils/logger';

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

let cachedClient: sheets_v4.Sheets | null | undefined;

export function getSheetsClient(): sheets_v4.Sheets | null {
  if (cachedClient !== undefined) return cachedClient;
  const env = getEnv();
  if (!env.hasGoogleCredentials) {
    cachedClient = null;
    return null;
  }

  try {
    const auth = new google.auth.GoogleAuth({
      scopes: SCOPES,
      ...(env.googleCredentialsPath
        ? { keyFile: env.googleCredentialsPath }
        : {
            credentials: {
              client_email: env.firebaseClientEmail,
              private_key: env.firebasePrivateKey,
            },
          }),
    });
    cachedClient = google.sheets({ version: 'v4', auth });
    return cachedClient;
  } catch (error) {
    logger.error('Google Sheets client initialisation failed', {
      message: error instanceof Error ? error.message : 'unknown error',
    });
    cachedClient = null;
    return null;
  }
}

export function resetSheetsClientForTests(): void {
  cachedClient = undefined;
}

export function sheetRange(title: string, range: string): string {
  return `'${title.replace(/'/g, "''")}'!${range}`;
}
