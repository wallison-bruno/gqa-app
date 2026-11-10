import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';

import {
  deleteDocument as deleteDocumentRemote,
  getDefaultApiUrl,
  listDocuments,
  normalizeBaseUrl,
} from '@/services/api';
import { refreshSession, signInWithPassword, signOutRemote } from '@/services/auth';
import type { Session } from '@/services/auth';
import { secureStorage } from '@/services/secureStorage';
import type { StoredDocument } from '@/types';

const KEYS = {
  apiUrl: '@gqa/apiUrl',
  session: 'gqa.session',
  documents: (userId: string) => `@gqa/documents/${userId}`,
};

const REFRESH_MARGIN_S = 60;

interface AppState {
  ready: boolean;
  apiUrl: string;
  session: Session | null;
  /** ID do usuário autenticado no Supabase (vazio se deslogado). */
  userId: string;
  documents: StoredDocument[];
  documentsLoading: boolean;
  documentsError: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  /** Passa a usar uma sessão já obtida (Google, confirmação de e-mail, cadastro, nova senha). */
  adoptSession: (session: Session) => Promise<void>;
  signOut: () => Promise<void>;
  /** Retorna um access token válido (renova automaticamente se estiver para expirar). */
  getAccessToken: () => Promise<string | null>;
  saveApiUrl: (apiUrl: string) => Promise<void>;
  /** Busca a lista atualizada de documentos do usuário no banco (`GET /documentos`). */
  refreshDocuments: () => Promise<void>;
  addDocument: (doc: StoredDocument) => Promise<void>;
  /** Remove o documento e suas questões no banco (`DELETE /documentos/:id`) e atualiza o estado local. */
  removeDocument: (id: string) => Promise<void>;
  /** Atualiza instantaneamente a contagem de questões de um documento no estado local. */
  updateDocumentQuestionCount: (documentId: string, update: { count?: number; delta?: number }) => void;
}

const AppContext = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [apiUrl, setApiUrl] = useState(getDefaultApiUrl());
  const [session, setSession] = useState<Session | null>(null);
  const [documents, setDocuments] = useState<StoredDocument[]>([]);
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [documentsError, setDocumentsError] = useState<string | null>(null);

  const sessionRef = useRef<Session | null>(null);
  const documentsRef = useRef<StoredDocument[]>([]);
  const refreshing = useRef<Promise<Session | null> | null>(null);

  const setAndSyncDocuments = useCallback((next: StoredDocument[], uid: string) => {
    documentsRef.current = next;
    setDocuments(next);
    if (uid) {
      AsyncStorage.setItem(KEYS.documents(uid), JSON.stringify(next)).catch(() => {});
    }
  }, []);

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

  const userId = session?.user.id ?? '';

  const refreshDocuments = useCallback(async () => {
    if (!sessionRef.current) return;
    setDocumentsLoading(true);
    setDocumentsError(null);
    try {
      const token = await getAccessToken();
      const remoteDocs = await listDocuments(apiUrl, token);
      const uid = sessionRef.current?.user.id ?? '';
      // Preserva o tamanho em bytes local (quando conhecido no upload) caso o servidor não retorne `size`
      const prevById = new Map(documentsRef.current.map((d) => [d.id, d]));
      const merged = remoteDocs.map((doc) => {
        const prev = prevById.get(doc.id);
        return {
          ...doc,
          size: doc.size ?? prev?.size,
        };
      });
      setAndSyncDocuments(merged, uid);
    } catch (e) {
      setDocumentsError((e as Error).message || 'Não foi possível carregar seus documentos.');
    } finally {
      setDocumentsLoading(false);
    }
  }, [apiUrl, getAccessToken, setAndSyncDocuments]);

  // Ao trocar de usuário: carrega cache local imediatamente e sincroniza com GET /documentos
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(KEYS.documents(userId));
        if (!cancelled && raw) {
          const parsed = JSON.parse(raw) as StoredDocument[];
          if (Array.isArray(parsed)) {
            documentsRef.current = parsed;
            setDocuments(parsed);
          }
        }
      } catch {
        // ignora erro de leitura de cache
      }
      if (!cancelled) {
        await refreshDocuments();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, refreshDocuments]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const next = await signInWithPassword(email, password);
      await applySession(next);
    },
    [applySession],
  );

  const signOut = useCallback(async () => {
    const token = sessionRef.current?.accessToken;
    documentsRef.current = [];
    setDocuments([]);
    setDocumentsError(null);
    await applySession(null);
    if (token) await signOutRemote(token);
  }, [applySession]);

  const saveApiUrl = useCallback(async (value: string) => {
    const url = normalizeBaseUrl(value) || getDefaultApiUrl();
    setApiUrl(url);
    await AsyncStorage.setItem(KEYS.apiUrl, url);
  }, []);

  const addDocument = useCallback(
    async (doc: StoredDocument) => {
      const next = [doc, ...documentsRef.current.filter((d) => d.id !== doc.id)];
      setAndSyncDocuments(next, userId);
    },
    [userId, setAndSyncDocuments],
  );

  const removeDocument = useCallback(
    async (id: string) => {
      const token = await getAccessToken();
      await deleteDocumentRemote(apiUrl, id, token);
      const next = documentsRef.current.filter((d) => d.id !== id);
      setAndSyncDocuments(next, userId);
    },
    [apiUrl, getAccessToken, userId, setAndSyncDocuments],
  );

  const updateDocumentQuestionCount = useCallback(
    (documentId: string, update: { count?: number; delta?: number }) => {
      const next = documentsRef.current.map((doc) => {
        if (doc.id !== documentId) return doc;
        const current = doc.questionCount ?? 0;
        const updatedCount =
          typeof update.count === 'number'
            ? Math.max(0, update.count)
            : Math.max(0, current + (update.delta ?? 0));
        return { ...doc, questionCount: updatedCount };
      });
      setAndSyncDocuments(next, userId);
    },
    [userId, setAndSyncDocuments],
  );

  const value = useMemo<AppState>(
    () => ({
      ready,
      apiUrl,
      session,
      userId,
      documents,
      documentsLoading,
      documentsError,
      signIn,
      adoptSession: applySession,
      signOut,
      getAccessToken,
      saveApiUrl,
      refreshDocuments,
      addDocument,
      removeDocument,
      updateDocumentQuestionCount,
    }),
    [
      ready,
      apiUrl,
      session,
      userId,
      documents,
      documentsLoading,
      documentsError,
      signIn,
      applySession,
      signOut,
      getAccessToken,
      saveApiUrl,
      refreshDocuments,
      addDocument,
      removeDocument,
      updateDocumentQuestionCount,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppState {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp deve ser usado dentro de <AppProvider>');
  return ctx;
}
