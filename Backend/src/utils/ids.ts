import { randomUUID } from 'node:crypto';

export function newId(prefix = ''): string {
  return `${prefix}${randomUUID()}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}

/** Stable, non-reversible demo uid derived from an email address. */
export function demoUid(email: string): string {
  return `demo_${email.trim().toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 24)}`;
}
