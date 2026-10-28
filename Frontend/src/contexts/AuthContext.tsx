import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { api, ApiError, getToken, setToken, UNAUTHORIZED_EVENT } from '@/lib/api';
import type { PublicConfig, UserProfile } from '@shared/types';

interface AuthUser {
  uid: string;
  email: string;
  displayName: string;
  authMode: 'demo' | 'firebase';
  createdAt?: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  config: PublicConfig | null;
  initializing: boolean;
  authError: string | null;
  loginDemo: (input: { email: string; name?: string; intent?: 'signin' | 'signup' }) => Promise<void>;
  loginWithFirebase: (input: {
    email: string;
    password: string;
    name?: string;
    intent: 'signin' | 'signup';
  }) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>;
  updateDisplayName: (name: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string | undefined,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string | undefined,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string | undefined,
};

function hasFirebaseClientConfig(): boolean {
  return Boolean(firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId);
}

async function firebaseSignIn(input: {
  email: string;
  password: string;
  name?: string;
  intent: 'signin' | 'signup';
}): Promise<string> {
  if (!hasFirebaseClientConfig()) {
    throw new Error(
      'Firebase client configuration is missing. Set VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN and VITE_FIREBASE_PROJECT_ID.',
    );
  }
  const { initializeApp, getApps } = await import('firebase/app');
  const { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile } =
    await import('firebase/auth');
  const app = getApps()[0] ?? initializeApp(firebaseConfig);
  const auth = getAuth(app);

  if (input.intent === 'signup') {
    const credential = await createUserWithEmailAndPassword(auth, input.email, input.password);
    if (input.name) await updateProfile(credential.user, { displayName: input.name });
  } else {
    await signInWithEmailAndPassword(auth, input.email, input.password);
  }

  const current = auth.currentUser;
  if (!current) throw new Error('Firebase sign-in did not return a user.');
  return current.getIdToken();
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [config, setConfig] = useState<PublicConfig | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const bootstrapped = useRef(false);

  const loadConfig = useCallback(async () => {
    try {
      const publicConfig = await api.config();
      setConfig(publicConfig);
      return publicConfig;
    } catch {
      return null;
    }
  }, []);

  const refresh = useCallback(async () => {
    const token = getToken();
    if (!token) {
      setUser(null);
      await loadConfig();
      return;
    }
    try {
      const me = await api.me();
      setUser(me.user as AuthUser);
      setConfig(me.config);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        setToken(null);
        setUser(null);
        await loadConfig();
      } else {
        setAuthError(error instanceof Error ? error.message : 'Could not load your account.');
      }
    }
  }, [loadConfig]);

  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;
    void (async () => {
      try {
        await refresh();
      } finally {
        setInitializing(false);
      }
    })();
  }, [refresh]);

  useEffect(() => {
    function handleUnauthorized() {
      setUser(null);
      setAuthError('Your session expired. Sign in again to continue.');
    }
    window.addEventListener(UNAUTHORIZED_EVENT, handleUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, handleUnauthorized);
  }, []);

  const loginDemo = useCallback(
    async (input: { email: string; name?: string; intent?: 'signin' | 'signup' }) => {
      setAuthError(null);
      const result = await api.demoLogin(input);
      setToken(result.token);
      setUser(result.user as AuthUser);
      setConfig(result.config);
    },
    [],
  );

  const loginWithFirebase = useCallback(
    async (input: {
      email: string;
      password: string;
      name?: string;
      intent: 'signin' | 'signup';
    }) => {
      setAuthError(null);
      const token = await firebaseSignIn(input);
      setToken(token);
      const me = await api.me();
      setUser(me.user as AuthUser);
      setConfig(me.config);
    },
    [],
  );

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    setAuthError(null);
    void loadConfig();
  }, [loadConfig]);

  const updateDisplayName = useCallback(
    async (name: string) => {
      const result = await api.updateMe(name);
      setUser((current) => (current ? { ...current, displayName: result.user.displayName } : current));
    },
    [],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      config,
      initializing,
      authError,
      loginDemo,
      loginWithFirebase,
      logout,
      refresh,
      updateDisplayName,
    }),
    [user, config, initializing, authError, loginDemo, loginWithFirebase, logout, refresh, updateDisplayName],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
