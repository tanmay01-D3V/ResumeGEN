import crypto from 'node:crypto';
import { getEnv } from '../config/env';
import { getFirebase } from '../config/firebase';
import { ApiError } from '../utils/errors';
import { demoUid, nowIso } from '../utils/ids';

export interface AuthUser {
  uid: string;
  email: string;
  name: string;
  authMode: 'firebase' | 'demo';
}

interface DemoTokenPayload {
  sub: string;
  email: string;
  name: string;
  mode: 'demo';
  iat: number;
  exp: number;
}

const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7;

function base64url(value: Buffer | string): string {
  return Buffer.from(value)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function sign(payload: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('base64url');
}

export function createDemoToken(user: { uid: string; email: string; name: string }): string {
  const env = getEnv();
  const now = Math.floor(Date.now() / 1000);
  const payload: DemoTokenPayload = {
    sub: user.uid,
    email: user.email,
    name: user.name,
    mode: 'demo',
    iat: now,
    exp: now + TOKEN_TTL_SECONDS,
  };
  const encoded = base64url(JSON.stringify(payload));
  const signature = sign(encoded, env.sessionSecret);
  return `${encoded}.${signature}`;
}

export function verifyDemoToken(token: string): AuthUser {
  const env = getEnv();
  const [encoded, signature] = token.split('.');
  if (!encoded || !signature) throw ApiError.unauthorized('Malformed session token.');

  const expected = sign(encoded, env.sessionSecret);
  const providedBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (
    providedBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(providedBuffer, expectedBuffer)
  ) {
    throw ApiError.unauthorized('Invalid session token.');
  }

  let payload: DemoTokenPayload;
  try {
    payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as DemoTokenPayload;
  } catch {
    throw ApiError.unauthorized('Malformed session token.');
  }

  if (
    payload.mode !== 'demo' ||
    typeof payload.sub !== 'string' ||
    typeof payload.exp !== 'number' ||
    payload.exp < Math.floor(Date.now() / 1000)
  ) {
    throw ApiError.unauthorized('Your session has expired. Please sign in again.');
  }

  return {
    uid: payload.sub,
    email: payload.email,
    name: payload.name,
    authMode: 'demo',
  };
}

export async function verifyBearerToken(token: string): Promise<AuthUser> {
  const env = getEnv();
  if (!token) throw ApiError.unauthorized();

  if (env.authMode === 'demo') return verifyDemoToken(token);

  const firebase = getFirebase();
  if (!firebase) throw ApiError.unauthorized('Authentication is not configured on the server.');

  try {
    const decoded = await firebase.auth.verifyIdToken(token, true);
    if (!decoded.uid) throw new Error('Token has no uid');
    return {
      uid: decoded.uid,
      email: decoded.email ?? '',
      name: typeof decoded.name === 'string' ? decoded.name : (decoded.email ?? 'User'),
      authMode: 'firebase',
    };
  } catch {
    throw ApiError.unauthorized('Your session is invalid or expired. Please sign in again.');
  }
}

export function demoAuthAllowed(): boolean {
  return getEnv().authMode === 'demo';
}

export function newDemoUser(email: string, name: string) {
  const normalizedEmail = email.trim().toLowerCase();
  return {
    uid: demoUid(normalizedEmail),
    email: normalizedEmail,
    name: name.trim() || normalizedEmail.split('@')[0] || 'Demo user',
    createdAt: nowIso(),
  };
}
