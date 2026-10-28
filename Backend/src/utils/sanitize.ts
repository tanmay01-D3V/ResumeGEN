/**
 * Sanitisation for user- and AI-controlled text before storage, HTML preview
 * or PDF rendering. React escapes on the client; PDFKit draws literal text.
 */

export function sanitizeText(value: unknown, maxLength = 5000): string {
  if (typeof value !== 'string') return '';
  return value
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    // Remove control characters except newline and tab.
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, maxLength);
}

export function sanitizeSingleLine(value: unknown, maxLength = 300): string {
  return sanitizeText(value, maxLength).replace(/\s+/g, ' ').trim();
}

export function sanitizeFilename(value: string): string {
  const cleaned = value
    .replace(/[^\p{L}\p{N}._-]+/gu, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 120);
  return cleaned || 'resume';
}

export function ensureHttpUrl(value: string): string {
  if (!value) return '';
  if (/^https?:\/\//i.test(value)) return value;
  return `https://${value}`;
}

export function isSafeHttpUrl(value: string): boolean {
  if (!value) return false;
  // Reject non-HTTP schemes (javascript:, data:, vbscript:) before prepending.
  const scheme = value.trim().match(/^([a-z][a-z0-9+.-]*):/i);
  if (scheme && !/^https?$/i.test(scheme[1]!)) return false;
  return /^https?:\/\/[^\s]+$/i.test(ensureHttpUrl(value));
}
