import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator } from 'react-native';
import styled, { useTheme } from 'styled-components/native';

import { AuthHero } from '@/components/AuthForm';
import { Button } from '@/components/Button';
import { FooterInner, Screen } from '@/components/Layout';
import { useApp } from '@/context/AppContext';
import { exchangeSignupCode } from '@/services/auth';

/**
 * Destino do link de confirmação de e-mail: `gqa-app://auth/confirm?code=...`.
 * Troca o `code` por uma sessão e já entra no app.
 */
export default function ConfirmEmailScreen() {
  const theme = useTheme();
  const { adoptSession } = useApp();
  const params = useLocalSearchParams<{ code?: string; error_description?: string }>();
  const code = typeof params.code === 'string' ? params.code : undefined;
  const linkError = typeof params.error_description === 'string' ? params.error_description : undefined;

  const [failure, setFailure] = useState<string | null>(
    code ? null : linkError?.replace(/\+/g, ' ') || 'Link de confirmação inválido ou expirado.',
  );

  useEffect(() => {
    if (!code) return;
    let cancelled = false;
    exchangeSignupCode(code)
      .then(async (session) => {
        if (cancelled) return;
        await adoptSession(session);
        router.replace('/');
      })
      .catch((e: Error) => {
        if (!cancelled) setFailure(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [code, adoptSession]);

  if (failure) {
    return (
      <Screen
        footer={
          <FooterInner>
            <Button label="Ir para o login" icon="log-in-outline" onPress={() => router.replace('/login')} />
          </FooterInner>
        }
      >
        <AuthHero icon="mail-open-outline" title="Quase lá" subtitle={failure} />
      </Screen>
    );
  }

  return (
    <Screen>
      <Center>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Muted>Confirmando seu e-mail…</Muted>
      </Center>
    </Screen>
  );
}

const Center = styled.View`
  align-items: center;
  gap: 16px;
  padding: 80px 0;
`;

const Muted = styled.Text`
  font-size: 15px;
  color: ${({ theme }) => theme.colors.textMuted};
`;

