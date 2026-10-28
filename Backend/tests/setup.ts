/**
 * Backend test bootstrap.
 *
 * NODE_ENV=test forces demo authentication and disables the general rate
 * limiter, so tests never depend on external credentials. Every test creates
 * its own in-memory repository; no real data file is touched.
 */

process.env.NODE_ENV = 'test';
process.env.DEMO_MODE = 'true';
process.env.FIREBASE_PROJECT_ID = '';
process.env.FIREBASE_CLIENT_EMAIL = '';
process.env.FIREBASE_PRIVATE_KEY = '';
process.env.GOOGLE_APPLICATION_CREDENTIALS = '';
process.env.GOOGLE_SHEETS_SPREADSHEET_ID = '';
process.env.GEMINI_API_KEY = '';
