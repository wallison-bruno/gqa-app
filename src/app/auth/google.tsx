import * as Linking from 'expo-linking';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';

import { AuthHero } from '@/components/AuthForm';
import { Button } from '@/components/Button';
import { FooterInner, Screen } from '@/components/Layout';
import { StatusLoadingCard } from '@/components/LoadingPrimitives';
import { useApp } from '@/context/AppContext';
import { exchangeGoogleCode, parseAuthParams, sessionFromImplicitTokens } from '@/services/auth';

/**
 * Rota de retorno do login com Google (`gqa-app://auth/google`).
 * Suporta tanto `?code=...` (PKCE) quanto `#access_token=...` (implicit).
 */
export default function GoogleCallbackScreen() {
  const { session, adoptSession } = useApp();
  const params = useLocalSearchParams<{ code?: string; error?: string; error_description?: string }>();
  const rawUrl = Linking.useURL();
  const handledRef = useRef(false);

  const urlParams = useMemo(() => (rawUrl ? parseAuthParams(rawUrl) : {}), [rawUrl]);
  const code = (typeof params.code === 'string' ? params.code : undefined) ?? urlParams.code;
  const accessToken = urlParams.access_token;
  const refreshToken = urlParams.refresh_token;
  const linkError =
    (typeof params.error_description === 'string' ? params.error_description : params.error) ??
    urlParams.error_description ??
    urlParams.error;

  const [failure, setFailure] = useState<string | null>(
    linkError ? linkError.replace(/\+/g, ' ') : null,
  );

  useEffect(() => {
    if (session) return;

    if (code && !handledRef.current) {
      handledRef.current = true;
      exchangeGoogleCode(code)
        .then(async (newSession) => {
          await adoptSession(newSession);
        })
        .catch((e: Error) => {
          setFailure(e.message || 'Falha ao autenticar com Google.');
        });
      return;
    }

    if (accessToken && refreshToken && !handledRef.current) {
      handledRef.current = true;
      sessionFromImplicitTokens(urlParams)
        .then(async (newSession) => {
          await adoptSession(newSession);
        })
        .catch((e: Error) => {
          setFailure(e.message || 'Falha ao autenticar com Google.');
        });
      return;
    }

    const timer = setTimeout(() => {
      if (!handledRef.current) router.replace('/login');
    }, 6000);
    return () => clearTimeout(timer);
  }, [session, code, accessToken, refreshToken, urlParams, adoptSession]);

  if (failure) {
    return (
      <Screen
        footer={
          <FooterInner>
            <Button label="Voltar ao login" icon="log-in-outline" onPress={() => router.replace('/login')} />
          </FooterInner>
        }
      >
        <AuthHero icon="alert-circle-outline" title="Login com Google" subtitle={failure} />
      </Screen>
    );
  }

  return (
    <Screen>
      <StatusLoadingCard
        icon="logo-google"
        badgeText="Autenticação segura"
        title="Conectando com o Google"
        subtitle="Confirmando suas credenciais. Você será redirecionado em instantes…"
      />
    </Screen>
  );
}
