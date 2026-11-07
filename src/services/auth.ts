import { ApiError } from '@/services/api';

const SUPABASE_URL = (process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').replace(/\/+$/, '');
const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_KEY ?? '';

export interface Session {
  accessToken: string;
  refreshToken: string;
  /** Epoch em segundos */
  expiresAt: number;
  user: { id: string; email: string };
}

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_at?: number;
  expires_in?: number;
  user: { id: string; email?: string };
}

export const isAuthConfigured = Boolean(SUPABASE_URL && SUPABASE_KEY);

const TIMEOUT_MS = 15000;

function friendlyAuthError(status: number, body: Record<string, unknown> | null): string {
  const code = String(body?.error_code ?? body?.code ?? '');
  const text = String(body?.msg ?? body?.error_description ?? body?.message ?? '');
  if (code === 'invalid_credentials' || /invalid login credentials/i.test(text)) {
    return 'E-mail ou senha incorretos.';
  }
  if (code === 'email_not_confirmed' || /email not confirmed/i.test(text)) {
    return 'Confirme seu e-mail antes de entrar.';
  }
  if (status === 429 || code === 'over_request_rate_limit') {
    return 'Muitas tentativas. Aguarde um instante e tente de novo.';
  }
  return text || `Falha na autenticação (erro ${status}).`;
}

async function tokenRequest(grantType: 'password' | 'refresh_token', payload: object): Promise<Session> {
  if (!isAuthConfigured) {
    throw new ApiError(
      'Supabase não configurado. Defina EXPO_PUBLIC_SUPABASE_URL e EXPO_PUBLIC_SUPABASE_KEY no arquivo .env.local.',
      'invalid',
    );
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=${grantType}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: SUPABASE_KEY },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } catch (err) {
    const timedOut = (err as Error)?.name === 'AbortError';
    throw new ApiError(
      timedOut ? 'O login demorou demais. Tente novamente.' : 'Sem conexão com a internet.',
      timedOut ? 'timeout' : 'network',
    );
  } finally {
    clearTimeout(timer);
  }

  let body: Record<string, unknown> | null = null;
  try {
    body = (await response.json()) as Record<string, unknown>;
  } catch {
    body = null;
  }

  if (!response.ok) {
    throw new ApiError(friendlyAuthError(response.status, body), 'server', response.status);
  }

  const data = body as unknown as TokenResponse;
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: data.expires_at ?? Math.floor(Date.now() / 1000) + (data.expires_in ?? 3600),
    user: { id: data.user.id, email: data.user.email ?? '' },
  };
}

export function signInWithPassword(email: string, password: string): Promise<Session> {
  return tokenRequest('password', { email: email.trim(), password });
}

export function refreshSession(refreshToken: string): Promise<Session> {
  return tokenRequest('refresh_token', { refresh_token: refreshToken });
}

/** Revoga a sessão no Supabase (melhor esforço: falhas são ignoradas). */
export async function signOutRemote(accessToken: string): Promise<void> {
  if (!isAuthConfigured) return;
  try {
    await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
      method: 'POST',
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${accessToken}` },
    });
  } catch {
    // sem rede: a sessão local é removida de qualquer forma
  }
}

