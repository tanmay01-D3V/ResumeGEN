/**
 * Safe logging helpers. Never log tokens, API keys, full job descriptions,
 * portfolio contents or service-account details.
 */

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

function write(level: LogLevel, message: string, context?: Record<string, unknown>) {
  const line: Record<string, unknown> = {
    level,
    time: new Date().toISOString(),
    message,
  };
  if (context) {
    for (const [key, value] of Object.entries(context)) {
      if (value === undefined) continue;
      line[key] = value;
    }
  }
  const serialized = JSON.stringify(line);
  if (level === 'error') console.error(serialized);
  else if (level === 'warn') console.warn(serialized);
  else console.log(serialized);
}

export const logger = {
  info: (message: string, context?: Record<string, unknown>) => write('info', message, context),
  warn: (message: string, context?: Record<string, unknown>) => write('warn', message, context),
  error: (message: string, context?: Record<string, unknown>) => write('error', message, context),
  debug: (message: string, context?: Record<string, unknown>) => {
    if (process.env.NODE_ENV !== 'production') write('debug', message, context);
  },
};

export function errorSummary(error: unknown): { name: string; message: string } {
  if (error instanceof Error) return { name: error.name, message: error.message.slice(0, 500) };
  return { name: 'UnknownError', message: String(error).slice(0, 500) };
}
