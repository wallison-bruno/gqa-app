import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';

import { getDefaultApiUrl, normalizeBaseUrl } from '@/services/api';
import { refreshSession, signInWithPassword, signOutRemote } from '@/services/auth';
import type { Session } from '@/services/auth';
import { secureStorage } from '@/services/secureStorage';
import type { StoredDocument } from '@/types';

const KEYS = {
  apiUrl: '@gqa/apiUrl',
  session: 'gqa.session',
  documents: (userId: string) => `@gqa/documents/${userId}`,
};

const MAX_DOCUMENTS = 20;
const REFRESH_MARGIN_S = 60;

interface AppState {
  ready: boolean;
  apiUrl: string;
  session: Session | null;
  /** ID do usuário autenticado no Supabase (vazio se deslogado). */
  userId: string;
  documents: StoredDocument[];
  signIn: (email: string, password: string) => Promise<void>;
  /** Passa a usar uma sessão já obtida (Google, confirmação de e-mail, cadastro, nova senha). */
  adoptSession: (session: Session) => Promise<void>;
  signOut: () => Promise<void>;
  /** Retorna um access token válido (renova automaticamente se estiver para expirar). */
  getAccessToken: () => Promise<string | null>;
  saveApiUrl: (apiUrl: string) => Promise<void>;
  addDocument: (doc: StoredDocument) => Promise<void>;
  removeDocument: (id: string) => Promise<void>;
}

const AppContext = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [apiUrl, setApiUrl] = useState(getDefaultApiUrl());
  const [session, setSession] = useState<Session | null>(null);
  const [documents, setDocuments] = useState<StoredDocument[]>([]);

  const sessionRef = useRef<Session | null>(null);
  const refreshing = useRef<Promise<Session | null> | null>(null);

  const applySession = useCallback(async (next: Session | null) => {
    sessionRef.current = next;
    setSession(next);
    if (next) await secureStorage.set(KEYS.session, JSON.stringify(next));
    else await secureStorage.remove(KEYS.session);
  }, []);

  // Carga inicial: URL da API + sessão salva (renovada se já expirou)
  useEffect(() => {
    (async () => {
      try {
        const storedUrl = await AsyncStorage.getItem(KEYS.apiUrl);
        if (storedUrl) setApiUrl(storedUrl);

        const raw = await secureStorage.get(KEYS.session);
        if (raw) {
          let saved = JSON.parse(raw) as Session;
          if (saved.expiresAt - Date.now() / 1000 < REFRESH_MARGIN_S) {
            try {
              saved = await refreshSession(saved.refreshToken);
            } catch (e) {
              // Refresh token inválido => volta ao login. Sem rede => mantém para tentar depois.
              if ((e as { kind?: string }).kind === 'server') {
                await secureStorage.remove(KEYS.session);
                return;
              }
            }
          }
          sessionRef.current = saved;
          setSession(saved);
          await secureStorage.set(KEYS.session, JSON.stringify(saved));
        }
      } catch {
        await secureStorage.remove(KEYS.session).catch(() => {});
      } finally {
        setReady(true);
      }
    })();
  }, []);

  // Documentos recentes são guardados por usuário
  const userId = session?.user.id ?? '';
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    AsyncStorage.getItem(KEYS.documents(userId))
      .then((raw) => {
        if (cancelled) return;
        const parsed = raw ? (JSON.parse(raw) as StoredDocument[]) : [];
        setDocuments(Array.isArray(parsed) ? parsed : []);
      })
      .catch(() => !cancelled && setDocuments([]));
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const next = await signInWithPassword(email, password);
      await applySession(next);
    },
    [applySession],
  );

  const signOut = useCallback(async () => {
    const token = sessionRef.current?.accessToken;
    setDocuments([]);
    await applySession(null);
    if (token) await signOutRemote(token);
  }, [applySession]);

  const getAccessToken = useCallback(async () => {
    const current = sessionRef.current;
    if (!current) return null;
    if (current.expiresAt - Date.now() / 1000 > REFRESH_MARGIN_S) return current.accessToken;

    if (!refreshing.current) {
      refreshing.current = refreshSession(current.refreshToken)
        .then(async (next) => {
          await applySession(next);
          return next;
        })
        .catch(async (e) => {
          if ((e as { kind?: string }).kind === 'server') await applySession(null);
          return null;
        })
        .finally(() => {
          refreshing.current = null;
        });
    }
    const next = await refreshing.current;
    return next?.accessToken ?? null;
  }, [applySession]);

  const saveApiUrl = useCallback(async (value: string) => {
    const url = normalizeBaseUrl(value) || getDefaultApiUrl();
    setApiUrl(url);
    await AsyncStorage.setItem(KEYS.apiUrl, url);
  }, []);

  const persistDocuments = useCallback(
    async (docs: StoredDocument[]) => {
      setDocuments(docs);
      if (userId) await AsyncStorage.setItem(KEYS.documents(userId), JSON.stringify(docs));
    },
    [userId],
  );

  const addDocument = useCallback(
    async (doc: StoredDocument) => {
      const next = [doc, ...documents.filter((d) => d.id !== doc.id)].slice(0, MAX_DOCUMENTS);
      await persistDocuments(next);
    },
    [documents, persistDocuments],
  );

  const removeDocument = useCallback(
    async (id: string) => {
      await persistDocuments(documents.filter((d) => d.id !== id));
    },
    [documents, persistDocuments],
  );

  const value = useMemo<AppState>(
    () => ({
      ready,
      apiUrl,
      session,
      userId,
      documents,
      signIn,
      adoptSession: applySession,
      signOut,
      getAccessToken,
      saveApiUrl,
      addDocument,
      removeDocument,
    }),
    [ready, apiUrl, session, userId, documents, signIn, applySession, signOut, getAccessToken, saveApiUrl, addDocument, removeDocument],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppState {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp deve ser usado dentro de <AppProvider>');
  return ctx;
}
