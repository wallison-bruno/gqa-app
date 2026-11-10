import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

import { ApiError } from '@/services/api';
import { createPkcePair } from '@/services/pkce';
import { secureStorage } from '@/services/secureStorage';

const SUPABASE_URL = (process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').replace(/\/+$/, '');
const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_KEY ?? '';

export const isAuthConfigured = Boolean(SUPABASE_URL && SUPABASE_KEY);

/** Tamanho mínimo de senha validado no app (o Supabase usa 6 por padrão). */
export const MIN_PASSWORD_LENGTH = 8;

const TIMEOUT_MS = 20000;

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

const APP_SCHEME = 'gqa-app';

function createRedirectUrl(path: string): string {
  const cleanPath = path.replace(/^\/+/, '');
  // Em builds nativos (APK / Dev Build), usa sempre o scheme fixo `gqa-app://<path>`,
  // evitando que o expo-linking injete o host do Metro (ex.: localhost:8081).
  if (Platform.OS !== 'web' && Constants.executionEnvironment !== ExecutionEnvironment.StoreClient) {
    return `${APP_SCHEME}://${cleanPath}`;
  }
  return Linking.createURL(cleanPath);
}

/** Rotas de retorno (deep links) que precisam estar na lista de Redirect URLs do Supabase. */
export const redirects = {
  google: () => createRedirectUrl('auth/google'),
  confirm: () => createRedirectUrl('auth/confirm'),
  resetPassword: () => createRedirectUrl('reset-password'),
};

/** Chaves onde guardamos o "code_verifier" de cada fluxo PKCE até o usuário voltar ao app. */
const VERIFIER_KEYS = {
  google: 'gqa.pkce.google',
  signup: 'gqa.pkce.signup',
  recovery: 'gqa.pkce.recovery',
} as const;

type Purpose = keyof typeof VERIFIER_KEYS;

// ---------------------------------------------------------------------------
// HTTP helper
// ---------------------------------------------------------------------------

function friendlyAuthError(status: number, body: Record<string, unknown> | null): string {
  const code = String(body?.error_code ?? body?.code ?? '');
  const text = String(body?.msg ?? body?.error_description ?? body?.message ?? '');

  if (code === 'invalid_credentials' || /invalid login credentials/i.test(text)) {
    return 'E-mail ou senha incorretos.';
  }
  if (code === 'email_not_confirmed' || /email not confirmed/i.test(text)) {
    return 'Confirme seu e-mail antes de entrar. Verifique sua caixa de entrada.';
  }
  if (code === 'user_already_exists' || /already registered/i.test(text)) {
    return 'Este e-mail já possui cadastro. Entre ou recupere sua senha.';
  }
  if (code === 'weak_password' || /password should be at least|weak/i.test(text)) {
    return `Senha fraca. Use pelo menos ${MIN_PASSWORD_LENGTH} caracteres, misturando letras e números.`;
  }
  if (code === 'same_password' || /different from the old password/i.test(text)) {
    return 'A nova senha precisa ser diferente da anterior.';
  }
  if (code === 'validation_failed' || /unable to validate email|invalid format/i.test(text)) {
    return 'Informe um e-mail válido.';
  }
  if (code === 'signup_disabled') {
    return 'O cadastro está desativado no momento.';
  }
  if (code === 'email_provider_disabled' || /email logins are disabled/i.test(text)) {
    return 'O login por e-mail está desativado no Supabase (Authentication → Providers → Email).';
  }
  if (
    code === 'otp_expired' ||
    code === 'flow_state_expired' ||
    /expired|invalid flow state|token has expired or is invalid/i.test(text)
  ) {
    return 'Código ou link inválido ou expirado. Confira os dígitos ou solicite um novo.';
  }
  if (status === 429 || code === 'over_request_rate_limit' || code === 'over_email_send_rate_limit') {
    return 'Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente de novo.';
  }
  return text || `Falha na autenticação (erro ${status}).`;
}

async function authFetch(
  path: string,
  options: { method?: 'GET' | 'POST' | 'PUT'; body?: object; token?: string } = {},
): Promise<Record<string, unknown> | null> {
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
    response = await fetch(`${SUPABASE_URL}/auth/v1${path}`, {
      method: options.method ?? 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_KEY,
        ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });
  } catch (err) {
    const timedOut = (err as Error)?.name === 'AbortError';
    throw new ApiError(
      timedOut ? 'A operação demorou demais. Tente novamente.' : 'Sem conexão com a internet.',
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
  return body;
}

function toSession(data: TokenResponse): Session {
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: data.expires_at ?? Math.floor(Date.now() / 1000) + (data.expires_in ?? 3600),
    user: { id: data.user.id, email: data.user.email ?? '' },
  };
}

// ---------------------------------------------------------------------------
// E-mail + senha
// ---------------------------------------------------------------------------

export async function signInWithPassword(email: string, password: string): Promise<Session> {
  const body = await authFetch('/token?grant_type=password', {
    body: { email: email.trim(), password },
  });
  return toSession(body as unknown as TokenResponse);
}

export async function refreshSession(refreshToken: string): Promise<Session> {
  const body = await authFetch('/token?grant_type=refresh_token', {
    body: { refresh_token: refreshToken },
  });
  return toSession(body as unknown as TokenResponse);
}

/** Revoga a sessão no Supabase (melhor esforço: falhas são ignoradas). */
export async function signOutRemote(accessToken: string): Promise<void> {
  try {
    await authFetch('/logout', { token: accessToken });
  } catch {
    // sem rede: a sessão local é removida de qualquer forma
  }
}

// ---------------------------------------------------------------------------
// Cadastro
// ---------------------------------------------------------------------------

export type SignUpResult =
  | { status: 'signed_in'; session: Session }
  | { status: 'confirm_email'; email: string };

/**
 * Cria a conta. Se o Supabase exigir confirmação de e-mail, devolve `confirm_email`;
 * caso contrário já devolve a sessão (login automático).
 */
export async function signUpWithPassword(params: {
  email: string;
  password: string;
  name?: string;
}): Promise<SignUpResult> {
  const email = params.email.trim();
  const { verifier, challenge } = await createPkcePair();
  await secureStorage.set(VERIFIER_KEYS.signup, verifier);

  const body = await authFetch(`/signup?redirect_to=${encodeURIComponent(redirects.confirm())}`, {
    body: {
      email,
      password: params.password,
      data: params.name?.trim() ? { full_name: params.name.trim() } : {},
      code_challenge: challenge,
      code_challenge_method: 's256',
    },
  });

  // Com confirmação desligada, a resposta já traz access_token + user.
  if (body && typeof body.access_token === 'string') {
    return { status: 'signed_in', session: toSession(body as unknown as TokenResponse) };
  }

  // E-mail já cadastrado: o Supabase responde 200 com `identities` vazio (anti-enumeração).
  const identities = (body as { identities?: unknown[] } | null)?.identities;
  if (Array.isArray(identities) && identities.length === 0) {
    throw new ApiError('Este e-mail já possui cadastro. Entre ou recupere sua senha.', 'server', 422);
  }

  return { status: 'confirm_email', email };
}

/** Reenvia o e-mail de confirmação do cadastro. */
export async function resendConfirmation(email: string): Promise<void> {
  const { verifier, challenge } = await createPkcePair();
  await secureStorage.set(VERIFIER_KEYS.signup, verifier);

  await authFetch(`/resend?redirect_to=${encodeURIComponent(redirects.confirm())}`, {
    body: {
      type: 'signup',
      email: email.trim(),
      code_challenge: challenge,
      code_challenge_method: 's256',
    },
  });
}

// ---------------------------------------------------------------------------
// Recuperação de senha
// ---------------------------------------------------------------------------

/** Envia o e-mail de recuperação. O link abre o app em `reset-password?code=...`. */
export async function requestPasswordReset(email: string): Promise<void> {
  const { verifier, challenge } = await createPkcePair();
  await secureStorage.set(VERIFIER_KEYS.recovery, verifier);

  await authFetch(`/recover?redirect_to=${encodeURIComponent(redirects.resetPassword())}`, {
    body: { email: email.trim(), code_challenge: challenge, code_challenge_method: 's256' },
  });
}

/** Troca o `code` do link de recuperação por uma sessão temporária (não é aplicada ao app). */
export function exchangeRecoveryCode(code: string): Promise<Session> {
  return exchangeCode(code, 'recovery');
}

/** Valida o código numérico (OTP de 6 a 8 dígitos) recebido por e-mail na recuperação de senha. */
export async function verifyRecoveryOtp(email: string, code: string): Promise<Session> {
  const body = await authFetch('/verify', {
    body: {
      type: 'recovery',
      email: email.trim(),
      token: code.replace(/\s+/g, ''),
    },
  });
  return toSession(body as unknown as TokenResponse);
}

/** Define a nova senha usando a sessão de recuperação. */
export async function updatePassword(accessToken: string, newPassword: string): Promise<void> {
  await authFetch('/user', { method: 'PUT', token: accessToken, body: { password: newPassword } });
}

// ---------------------------------------------------------------------------
// Confirmação de e-mail
// ---------------------------------------------------------------------------

export function exchangeSignupCode(code: string): Promise<Session> {
  return exchangeCode(code, 'signup');
}

/** Valida o código numérico (OTP de 6 a 8 dígitos) de confirmação de cadastro enviado por e-mail. */
export async function verifySignupOtp(email: string, code: string): Promise<Session> {
  const body = await authFetch('/verify', {
    body: {
      type: 'signup',
      email: email.trim(),
      token: code.replace(/\s+/g, ''),
    },
  });
  return toSession(body as unknown as TokenResponse);
}

export function exchangeGoogleCode(code: string): Promise<Session> {
  return exchangeCode(code, 'google');
}

// ---------------------------------------------------------------------------
// Google (OAuth com PKCE via navegador do sistema)
// ---------------------------------------------------------------------------

/** Resultado de `signInWithGoogle`: `null` quando o usuário cancela. */
export async function signInWithGoogle(): Promise<Session | null> {
  if (!isAuthConfigured) {
    throw new ApiError(
      'Supabase não configurado. Defina EXPO_PUBLIC_SUPABASE_URL e EXPO_PUBLIC_SUPABASE_KEY no arquivo .env.local.',
      'invalid',
    );
  }

  const redirectTo = redirects.google();
  const { verifier, challenge } = await createPkcePair();
  await secureStorage.set(VERIFIER_KEYS.google, verifier);

  const query = Object.entries({
    provider: 'google',
    redirect_to: redirectTo,
    code_challenge: challenge,
    code_challenge_method: 's256',
    prompt: 'select_account',
  })
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('&');
  const authUrl = `${SUPABASE_URL}/auth/v1/authorize?${query}`;

  // No Android, o AppState 'active' frequentemente resolve o openAuthSessionAsync com 'dismiss'
  // alguns milissegundos antes do evento de deep link ('url') chegar. Escutamos também pelo Linking.
  let capturedUrl: string | null = null;
  let resolveLink: ((url: string) => void) | null = null;
  const linkPromise = new Promise<string>((resolve) => {
    resolveLink = resolve;
  });
  const sub = Linking.addEventListener('url', (event) => {
    if (event.url && (event.url.includes('code=') || event.url.includes('access_token=') || event.url.includes('error='))) {
      capturedUrl = event.url;
      resolveLink?.(event.url);
    }
  });

  let finalUrl: string | null = null;
  try {
    const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectTo);
    if (result.type === 'success') {
      finalUrl = result.url;
    } else if (capturedUrl) {
      finalUrl = capturedUrl;
    } else if (Platform.OS === 'android') {
      finalUrl = await Promise.race([
        linkPromise,
        new Promise<null>((r) => setTimeout(() => r(null), 900)),
      ]);
    }
  } finally {
    sub.remove();
  }

  if (!finalUrl) return null;

  const returned = parseAuthParams(finalUrl);
  if (returned.error || returned.error_description) {
    throw new ApiError(
      returned.error_description?.replace(/\+/g, ' ') || 'Não foi possível entrar com o Google.',
      'server',
    );
  }
  if (returned.code) {
    return exchangeCode(returned.code, 'google');
  }
  if (returned.access_token && returned.refresh_token) {
    return sessionFromImplicitTokens(returned);
  }
  throw new ApiError('Resposta inesperada do login com Google. Tente novamente.', 'invalid');
}

export async function sessionFromImplicitTokens(params: Record<string, string>): Promise<Session> {
  const userBody = (await authFetch('/user', {
    method: 'GET',
    token: params.access_token,
  })) as { id?: string; email?: string } | null;

  if (!userBody?.id) {
    throw new ApiError('Não foi possível obter os dados do usuário no login com Google.', 'invalid');
  }
  const expiresAt = params.expires_at
    ? Number(params.expires_at)
    : Math.floor(Date.now() / 1000) + Number(params.expires_in || 3600);

  return {
    accessToken: params.access_token,
    refreshToken: params.refresh_token,
    expiresAt,
    user: { id: userBody.id, email: userBody.email ?? '' },
  };
}

// ---------------------------------------------------------------------------
// PKCE
// ---------------------------------------------------------------------------

// Evita trocar o mesmo `code` duas vezes (ex.: deep link + retorno do navegador no Android).
const exchanges = new Map<string, Promise<Session>>();

function exchangeCode(code: string, purpose: Purpose): Promise<Session> {
  const cached = exchanges.get(code);
  if (cached) return cached;

  const promise = (async () => {
    const verifier = await secureStorage.get(VERIFIER_KEYS[purpose]);
    if (!verifier) {
      throw new ApiError(
        'Não foi possível validar o link neste aparelho. Se você já confirmou o e-mail, entre normalmente.',
        'invalid',
      );
    }
    const body = await authFetch('/token?grant_type=pkce', {
      body: { auth_code: code, code_verifier: verifier },
    });
    await secureStorage.remove(VERIFIER_KEYS[purpose]);
    return toSession(body as unknown as TokenResponse);
  })();

  exchanges.set(code, promise);
  // Se falhar, permite nova tentativa com o mesmo code (ex.: sem rede).
  promise.catch(() => exchanges.delete(code));
  return promise;
}

/** Lê parâmetros de uma URL de retorno, tanto na query (?a=b) quanto no fragmento (#a=b). */
export function parseAuthParams(url: string): Record<string, string> {
  const out: Record<string, string> = {};
  const queryPart = url.split('#')[0].split('?')[1] ?? '';
  const hashPart = url.split('#')[1] ?? '';
  for (const chunk of [queryPart, hashPart]) {
    for (const pair of chunk.split('&')) {
      if (!pair) continue;
      const [k, v = ''] = pair.split('=');
      try {
        out[decodeURIComponent(k)] = decodeURIComponent(v.replace(/\+/g, ' '));
      } catch {
        out[k] = v;
      }
    }
  }
  return out;
}
