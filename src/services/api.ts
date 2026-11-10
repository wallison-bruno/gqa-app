import Constants from 'expo-constants';
import { Platform } from 'react-native';

import type {
  DeleteDocumentResponse,
  DeleteQuestionResponse,
  Difficulty,
  PickedFile,
  Question,
  StoredDocument,
  UploadResponse,
} from '@/types';
import { decodeFileName } from '@/utils/format';

export type ApiErrorKind = 'network' | 'timeout' | 'server' | 'invalid';

export class ApiError extends Error {
  kind: ApiErrorKind;
  status?: number;

  constructor(message: string, kind: ApiErrorKind, status?: number) {
    super(message);
    this.name = 'ApiError';
    this.kind = kind;
    this.status = status;
  }
}

const SERVER_PORT = 3000;
const UPLOAD_TIMEOUT_MS = 5 * 60 * 1000; // indexação (embeddings) pode demorar
const QUESTION_TIMEOUT_MS = 90 * 1000;
const DEFAULT_TIMEOUT_MS = 45 * 1000; // o Render pode levar ~30-50s para "acordar" após inatividade

/** API em produção (Render). Pode ser sobrescrita com EXPO_PUBLIC_API_URL no .env.local. */
export const PRODUCTION_API_URL = 'https://gqa-backend.onrender.com';

/**
 * Endereço padrão da API: EXPO_PUBLIC_API_URL, se definida, ou o backend em produção.
 * Para testar com o servidor local, defina EXPO_PUBLIC_API_URL=http://<IP-do-PC>:3000
 * (ou altere nas Configurações do app).
 */
export function getDefaultApiUrl(): string {
  return normalizeBaseUrl(process.env.EXPO_PUBLIC_API_URL ?? '') || PRODUCTION_API_URL;
}

/** Endereço do servidor local de desenvolvimento, sugerido nas Configurações. */
export function getLocalApiUrl(): string {
  if (Platform.OS === 'web') {
    const host = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
    return `http://${host || 'localhost'}:${SERVER_PORT}`;
  }
  const hostUri = Constants.expoConfig?.hostUri;
  const host = hostUri?.split(':')[0];
  if (host) return `http://${host}:${SERVER_PORT}`;
  return Platform.OS === 'android'
    ? `http://10.0.2.2:${SERVER_PORT}`
    : `http://localhost:${SERVER_PORT}`;
}

export function normalizeBaseUrl(url: string): string {
  let clean = url.trim().replace(/\/+$/, '');
  if (clean && !/^https?:\/\//i.test(clean)) clean = `http://${clean}`;
  return clean;
}

const NETWORK_MESSAGE =
  'Não foi possível conectar ao servidor. Verifique sua conexão com a internet. Se o servidor estava inativo, ele pode levar até um minuto para acordar: tente novamente em instantes.';

function extractServerMessage(body: unknown, fallback: string): string {
  if (body && typeof body === 'object') {
    const record = body as Record<string, unknown>;
    for (const key of ['error', 'message', 'msg']) {
      if (typeof record[key] === 'string' && (record[key] as string).trim()) {
        return (record[key] as string).trim();
      }
    }
  }
  return fallback;
}

function friendlyStatusMessage(status: number, serverMessage: string): string {
  switch (status) {
    case 401:
      return 'Sessão expirada ou inválida. Saia e entre novamente.';
    case 404:
      return serverMessage || 'Registro não encontrado no servidor.';
    case 413:
      return 'O arquivo é maior que o limite permitido pelo servidor.';
    case 415:
      return 'Formato de arquivo não suportado. Envie PDF, DOCX, TXT ou imagem.';
    case 422:
      return 'Não foi possível extrair texto suficiente do arquivo.';
    case 502:
      return `A IA não conseguiu gerar uma questão válida agora. Tente novamente. (${serverMessage})`;
    default:
      return serverMessage;
  }
}

function authHeaders(accessToken?: string | null, json = false): Record<string, string> {
  return {
    Accept: 'application/json',
    ...(json ? { 'Content-Type': 'application/json' } : {}),
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
  };
}

async function request<T>(
  url: string,
  init: RequestInit,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(url, { ...init, signal: controller.signal });
  } catch (err) {
    if ((err as Error)?.name === 'AbortError') {
      throw new ApiError('O servidor demorou demais para responder. Tente novamente.', 'timeout');
    }
    throw new ApiError(NETWORK_MESSAGE, 'network');
  } finally {
    clearTimeout(timer);
  }

  let body: unknown = null;
  const text = await response.text();
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = null;
    }
  }

  if (!response.ok) {
    const serverMessage = extractServerMessage(body, `Erro ${response.status} no servidor.`);
    throw new ApiError(friendlyStatusMessage(response.status, serverMessage), 'server', response.status);
  }
  return body as T;
}

export async function checkHealth(baseUrl: string): Promise<boolean> {
  const data = await request<{ ok?: boolean }>(
    `${normalizeBaseUrl(baseUrl)}/health`,
    { method: 'GET' },
    DEFAULT_TIMEOUT_MS,
  );
  return Boolean(data?.ok);
}

/**
 * POST /upload (multipart/form-data: file + userId).
 * Usa XMLHttpRequest para reportar o progresso do envio.
 */
export function uploadDocument(
  baseUrl: string,
  userId: string,
  accessToken: string | null,
  file: PickedFile,
  onProgress?: (fraction: number) => void,
  onUploadFinished?: () => void,
): Promise<UploadResponse> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    if (userId) form.append('userId', userId);

    if (Platform.OS === 'web') {
      form.append('file', file.file ?? (file as unknown as Blob), file.name);
    } else {
      form.append('file', { uri: file.uri, name: file.name, type: file.mimeType } as unknown as Blob);
    }

    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${normalizeBaseUrl(baseUrl)}/upload`);
    xhr.timeout = UPLOAD_TIMEOUT_MS;
    xhr.setRequestHeader('Accept', 'application/json');
    if (accessToken) xhr.setRequestHeader('Authorization', `Bearer ${accessToken}`);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) onProgress?.(event.loaded / event.total);
    };
    xhr.upload.onload = () => {
      onProgress?.(1);
      onUploadFinished?.();
    };

    xhr.onload = () => {
      let body: unknown = null;
      try {
        body = JSON.parse(xhr.responseText);
      } catch {
        body = null;
      }

      if (xhr.status >= 200 && xhr.status < 300) {
        const id = (body as UploadResponse | null)?.document_id;
        if (!id) {
          reject(new ApiError('Resposta inesperada do servidor ao enviar o arquivo.', 'invalid'));
          return;
        }
        resolve(body as UploadResponse);
        return;
      }
      const serverMessage = extractServerMessage(body, `Erro ${xhr.status} no servidor.`);
      reject(new ApiError(friendlyStatusMessage(xhr.status, serverMessage), 'server', xhr.status));
    };
    xhr.onerror = () => reject(new ApiError(NETWORK_MESSAGE, 'network'));
    xhr.ontimeout = () =>
      reject(new ApiError('O processamento do arquivo demorou demais. Tente um arquivo menor.', 'timeout'));

    xhr.send(form);
  });
}

// ---------------------------------------------------------------------------
// Documentos do usuário (GET /documentos, DELETE /documentos/:documentId)
// ---------------------------------------------------------------------------

interface RawServerDocument {
  id?: string;
  document_id?: string;
  nome_arquivo?: string;
  title?: string;
  file_type?: string;
  mime_type?: string;
  data_envio?: string;
  created_at?: string;
  status?: string;
  quantidade_questoes?: number;
  size?: number;
}

function normalizeDocument(raw: RawServerDocument): StoredDocument | null {
  const id = String(raw.id ?? raw.document_id ?? '').trim();
  if (!id) return null;
  const rawTitle = String(raw.nome_arquivo ?? raw.title ?? 'Documento').trim();
  const title = decodeFileName(rawTitle) || 'Documento';
  const mimeType = String(raw.file_type ?? raw.mime_type ?? 'application/pdf').trim() || 'application/pdf';
  const dateStr = raw.data_envio ?? raw.created_at ?? '';
  const parsedDate = dateStr ? Date.parse(dateStr) : NaN;
  const createdAt = Number.isFinite(parsedDate) ? parsedDate : Date.now();

  return {
    id,
    title,
    mimeType,
    size: typeof raw.size === 'number' ? raw.size : undefined,
    createdAt,
    status: typeof raw.status === 'string' ? raw.status : 'processado',
    questionCount: typeof raw.quantidade_questoes === 'number' ? raw.quantidade_questoes : 0,
  };
}

/** GET /documentos — Lista todos os documentos enviados pelo usuário autenticado. */
export async function listDocuments(
  baseUrl: string,
  accessToken: string | null,
): Promise<StoredDocument[]> {
  const data = await request<unknown>(
    `${normalizeBaseUrl(baseUrl)}/documentos`,
    {
      method: 'GET',
      headers: authHeaders(accessToken),
    },
    DEFAULT_TIMEOUT_MS,
  );

  const list = Array.isArray(data)
    ? data
    : data && typeof data === 'object' && Array.isArray((data as { documentos?: unknown[] }).documentos)
      ? (data as { documentos: unknown[] }).documentos
      : [];

  return list
    .map((item) => (item && typeof item === 'object' ? normalizeDocument(item as RawServerDocument) : null))
    .filter((doc): doc is StoredDocument => doc !== null);
}

/** DELETE /documentos/:documentId — Apaga o documento e todas as suas questões vinculadas. */
export async function deleteDocument(
  baseUrl: string,
  documentId: string,
  accessToken: string | null,
): Promise<DeleteDocumentResponse> {
  return request<DeleteDocumentResponse>(
    `${normalizeBaseUrl(baseUrl)}/documentos/${encodeURIComponent(documentId)}`,
    {
      method: 'DELETE',
      headers: authHeaders(accessToken),
    },
    DEFAULT_TIMEOUT_MS,
  );
}

// ---------------------------------------------------------------------------
// Questões (POST /gerar-questao, GET /documentos/:id/questoes, DELETE /questoes/:id)
// ---------------------------------------------------------------------------

function normalizeDifficulty(value: unknown, fallback?: Difficulty): Difficulty | undefined {
  if (typeof value !== 'string') return fallback;
  const clean = value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  if (clean === 'facil' || clean === 'medio' || clean === 'dificil') {
    return clean;
  }
  return fallback;
}

function parseAlternatives(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.filter((item): item is string => typeof item === 'string');
  }
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter((item): item is string => typeof item === 'string');
      }
    } catch {
      // ignora
    }
  }
  return [];
}

function normalizeQuestion(
  raw: unknown,
  fallbackDocId = '',
  fallbackDifficulty?: Difficulty,
): Question | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const alternativas = parseAlternatives(r.alternativas);
  if (
    typeof r.enunciado !== 'string' ||
    !r.enunciado.trim() ||
    alternativas.length < 2 ||
    typeof r.resposta_correta !== 'string'
  ) {
    return null;
  }

  const id = String(r.id ?? r.question_id ?? '').trim();
  const documentId = String(r.document_id ?? fallbackDocId).trim();

  return {
    id,
    question_id: id || undefined,
    document_id: documentId,
    enunciado: r.enunciado,
    alternativas,
    resposta_correta: r.resposta_correta,
    nivel_dificuldade: normalizeDifficulty(r.nivel_dificuldade, fallbackDifficulty),
    comentario: typeof r.comentario === 'string' ? r.comentario : '',
    created_at: typeof r.created_at === 'string' ? r.created_at : undefined,
  };
}

/** POST /gerar-questao — Gera uma nova questão para o documento e a salva no banco. */
export async function generateQuestion(
  baseUrl: string,
  params: { documentId: string; nivelDificuldade: Difficulty; tema?: string },
  accessToken?: string | null,
): Promise<Question> {
  const data = await request<unknown>(
    `${normalizeBaseUrl(baseUrl)}/gerar-questao`,
    {
      method: 'POST',
      headers: authHeaders(accessToken, true),
      body: JSON.stringify({
        document_id: params.documentId,
        nivelDificuldade: params.nivelDificuldade,
        tema: params.tema?.trim() || '',
      }),
    },
    QUESTION_TIMEOUT_MS,
  );

  const normalized = normalizeQuestion(data, params.documentId, params.nivelDificuldade);
  if (!normalized) {
    throw new ApiError('O servidor devolveu uma questão em formato inesperado.', 'invalid');
  }
  return normalized;
}

/** GET /documentos/:documentId/questoes — Lista as questões salvas de um documento. */
export async function listDocumentQuestions(
  baseUrl: string,
  documentId: string,
  accessToken: string | null,
): Promise<Question[]> {
  const data = await request<unknown>(
    `${normalizeBaseUrl(baseUrl)}/documentos/${encodeURIComponent(documentId)}/questoes`,
    {
      method: 'GET',
      headers: authHeaders(accessToken),
    },
    DEFAULT_TIMEOUT_MS,
  );

  const list = Array.isArray(data)
    ? data
    : data && typeof data === 'object' && Array.isArray((data as { questoes?: unknown[] }).questoes)
      ? (data as { questoes: unknown[] }).questoes
      : [];

  return list
    .map((item) => normalizeQuestion(item, documentId))
    .filter((q): q is Question => q !== null);
}

/** DELETE /questoes/:questaoId — Apaga uma questão específica do banco. */
export async function deleteQuestion(
  baseUrl: string,
  questionId: string,
  accessToken: string | null,
): Promise<DeleteQuestionResponse> {
  return request<DeleteQuestionResponse>(
    `${normalizeBaseUrl(baseUrl)}/questoes/${encodeURIComponent(questionId)}`,
    {
      method: 'DELETE',
      headers: authHeaders(accessToken),
    },
    DEFAULT_TIMEOUT_MS,
  );
}
