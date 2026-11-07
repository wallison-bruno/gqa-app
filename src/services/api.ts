import Constants from 'expo-constants';
import { Platform } from 'react-native';

import type { Difficulty, PickedFile, Question, UploadResponse } from '@/types';

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
const HEALTH_TIMEOUT_MS = 8 * 1000;

/**
 * Endereço padrão da API.
 * - Dispositivo físico / Expo Go: usa o mesmo IP do computador que roda o Metro.
 * - Emulador Android: 10.0.2.2 aponta para o localhost do computador.
 * - iOS Simulator / Web: localhost.
 */
export function getDefaultApiUrl(): string {
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
  'Não foi possível conectar ao servidor. Verifique se a API está rodando e se o endereço nas configurações está correto (celular e computador na mesma rede Wi-Fi).';

function extractServerMessage(body: unknown, fallback: string): string {
  if (body && typeof body === 'object' && 'error' in body) {
    const msg = (body as { error?: unknown }).error;
    if (typeof msg === 'string' && msg.trim()) return msg;
  }
  return fallback;
}

function friendlyStatusMessage(status: number, serverMessage: string): string {
  switch (status) {
    case 401:
      return 'Sessão expirada ou inválida. Saia e entre novamente.';
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

async function request<T>(
  url: string,
  init: RequestInit,
  timeoutMs: number,
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
    HEALTH_TIMEOUT_MS,
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
    form.append('userId', userId);

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

function isValidQuestion(q: unknown): q is Question {
  if (!q || typeof q !== 'object') return false;
  const c = q as Partial<Question>;
  return (
    typeof c.enunciado === 'string' &&
    Array.isArray(c.alternativas) &&
    c.alternativas.length >= 2 &&
    c.alternativas.every((a) => typeof a === 'string') &&
    typeof c.resposta_correta === 'string'
  );
}

/** POST /gerar-questao (application/json). */
export async function generateQuestion(
  baseUrl: string,
  params: { documentId: string; nivelDificuldade: Difficulty; tema?: string },
  accessToken?: string | null,
): Promise<Question> {
  const data = await request<Question>(
    `${normalizeBaseUrl(baseUrl)}/gerar-questao`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify({
        document_id: params.documentId,
        nivelDificuldade: params.nivelDificuldade,
        tema: params.tema?.trim() || null,
      }),
    },
    QUESTION_TIMEOUT_MS,
  );

  if (!isValidQuestion(data)) {
    throw new ApiError('O servidor devolveu uma questão em formato inesperado.', 'invalid');
  }
  return { ...data, comentario: typeof data.comentario === 'string' ? data.comentario : '' };
}

