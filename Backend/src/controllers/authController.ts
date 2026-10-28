import type { Request, Response } from 'express';
import { z } from 'zod';
import { getEnv } from '../config/env';
import { currentUser } from '../middleware/auth';
import { ApiError } from '../utils/errors';
import { createDemoToken, newDemoUser } from '../services/authService';
import { buildUserProfile } from '../services/dashboardService';
import { seedDemoData } from '../services/seedService';
import type { Services } from '../services';
import type { PublicConfig } from '../../../shared/types';
import { getGeminiService } from '../services/geminiService';

export const demoLoginSchema = z.object({
  email: z.string().trim().email().max(200),
  name: z.string().trim().max(160).optional(),
  intent: z.enum(['signin', 'signup']).optional(),
});

export const updateMeSchema = z.object({
  displayName: z.string().trim().min(1).max(160),
});

export function publicConfig(): PublicConfig {
  const env = getEnv();
  const gemini = getGeminiService();
  return {
    authMode: env.authMode,
    aiConfigured: gemini.configured,
    aiModel: env.geminiModel,
    sheetsConfigured: env.hasGoogleCredentials && Boolean(env.spreadsheetId),
    spreadsheetConfigured: Boolean(env.spreadsheetId),
    ...(env.authMode === 'firebase' && env.firebaseProjectId
      ? { firebaseProjectId: env.firebaseProjectId }
      : {}),
    ...(env.demoModeReason ? { demoModeReason: env.demoModeReason } : {}),
  };
}

export class AuthController {
  constructor(private readonly services: Services) {}

  config = (_req: Request, res: Response): void => {
    res.json({ data: publicConfig() });
  };

  me = async (req: Request, res: Response): Promise<void> => {
    const auth = currentUser(req);
    const existing = await this.services.repo.getUser(auth.uid);
    const profile = buildUserProfile({
      uid: auth.uid,
      email: auth.email || existing?.email || '',
      name: auth.name || existing?.displayName || '',
      authMode: auth.authMode,
      existing,
    });
    await this.services.repo.upsertUser(profile);
    res.json({
      data: {
        user: {
          uid: profile.uid,
          email: profile.email,
          displayName: profile.displayName,
          authMode: profile.authMode,
          createdAt: profile.createdAt,
        },
        config: publicConfig(),
      },
    });
  };

  demoLogin = async (req: Request, res: Response): Promise<void> => {
    const env = getEnv();
    if (env.authMode !== 'demo') {
      throw ApiError.forbidden('This server uses Firebase Authentication. Sign in through the Firebase client.');
    }
    const body = demoLoginSchema.parse(req.body);
    const user = newDemoUser(body.email, body.name ?? '');
    const existing = await this.services.repo.getUser(user.uid);
    const profile = buildUserProfile({
      uid: user.uid,
      email: user.email,
      name: body.name || existing?.displayName || user.name,
      authMode: 'demo',
      existing,
    });
    await this.services.repo.upsertUser(profile);
    const token = createDemoToken({ uid: profile.uid, email: profile.email, name: profile.displayName });
    res.json({
      data: {
        token,
        user: {
          uid: profile.uid,
          email: profile.email,
          displayName: profile.displayName,
          authMode: 'demo',
        },
        config: publicConfig(),
        notice:
          'Demo authentication stores accounts in the configured local store. Use Firebase Authentication for production.',
      },
    });
  };

  updateMe = async (req: Request, res: Response): Promise<void> => {
    const auth = currentUser(req);
    const body = updateMeSchema.parse(req.body);
    const existing = await this.services.repo.getUser(auth.uid);
    if (!existing) throw ApiError.notFound('Profile not found.');
    const profile = { ...existing, displayName: body.displayName, lastLoginAt: new Date().toISOString() };
    await this.services.repo.upsertUser(profile);
    res.json({ data: { user: profile } });
  };

  seed = async (req: Request, res: Response): Promise<void> => {
    const auth = currentUser(req);
    const existing = await this.services.repo.getUser(auth.uid);
    const result = await seedDemoData(this.services.repo, {
      uid: auth.uid,
      email: auth.email || existing?.email || 'demo@example.com',
      displayName: existing?.displayName || auth.name || 'Demo user',
    });
    res.status(201).json({ data: result });
  };
}
