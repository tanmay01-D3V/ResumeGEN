import { createApp } from './app';
import { getEnv } from './config/env';
import { logger } from './utils/logger';
import { getGeminiService } from './services/geminiService';

const env = getEnv();
const app = createApp();

const server = app.listen(env.port, () => {
  const gemini = getGeminiService();
  logger.info('ResumeGEN API started', {
    port: env.port,
    environment: env.nodeEnv,
    authMode: env.authMode,
    aiConfigured: gemini.configured,
    aiModel: env.geminiModel,
    sheetsCredentials: env.hasGoogleCredentials,
    spreadsheetConfigured: Boolean(env.spreadsheetId),
  });
  if (env.authMode === 'demo') {
    logger.warn('Demo authentication is active', { reason: env.demoModeReason });
  }
});

function shutdown(signal: string) {
  logger.info('Shutting down', { signal });
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
