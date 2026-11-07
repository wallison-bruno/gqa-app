import { Ionicons } from '@expo/vector-icons';
import { useRef, useState } from 'react';
import type { ComponentRef } from 'react';
import { KeyboardAvoidingView, Platform, TextInput, View } from 'react-native';
import styled, { useTheme } from 'styled-components/native';

import { Button } from '@/components/Button';
import { ErrorBanner } from '@/components/ErrorBanner';
import { FooterInner, Screen } from '@/components/Layout';
import { useApp } from '@/context/AppContext';
import { isAuthConfigured } from '@/services/auth';
import * as haptics from '@/utils/haptics';

export default function LoginScreen() {
  const theme = useTheme();
  const { signIn } = useApp();
  const passwordRef = useRef<ComponentRef<typeof TextInput>>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = email.trim().length > 3 && password.length > 0 && !loading;

  const submit = async () => {
    if (!canSubmit) return;
    setLoading(true);
    setError(null);
    try {
      await signIn(email, password);
      haptics.success();
      // O guard de rotas (Stack.Protected) redireciona automaticamente para a Home.
    } catch (e) {
      haptics.error();
      setError((e as Error).message || 'Não foi possível entrar.');
      setLoading(false);
    }
  };

  const footer = (
    <FooterInner>
      <Button label="Entrar" icon="log-in-outline" loading={loading} disabled={!canSubmit} onPress={submit} />
    </FooterInner>
  );

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen footer={footer}>
        <Hero>
          <Logo>
            <Ionicons name="sparkles" size={34} color={theme.colors.onPrimary} />
          </Logo>
          <Title>Bem-vindo ao GQA</Title>
          <Subtitle>Entre para transformar seus documentos em questões de estudo.</Subtitle>
        </Hero>

        <View style={{ gap: 14 }}>
          <View style={{ gap: 6 }}>
            <Label>E-mail</Label>
            <Input
              value={email}
              onChangeText={setEmail}
              placeholder="voce@email.com"
              placeholderTextColor={theme.colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              keyboardType="email-address"
              textContentType="emailAddress"
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
              editable={!loading}
              accessibilityLabel="E-mail"
            />
          </View>

          <View style={{ gap: 6 }}>
            <Label>Senha</Label>
            <PasswordRow>
              <PasswordInput
                ref={passwordRef}
                value={password}
                onChangeText={setPassword}
                placeholder="Sua senha"
                placeholderTextColor={theme.colors.textMuted}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="current-password"
                textContentType="password"
                returnKeyType="go"
                onSubmitEditing={submit}
                editable={!loading}
                accessibilityLabel="Senha"
              />
              <Toggle
                onPress={() => setShowPassword((s) => !s)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
              >
                <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={22} color={theme.colors.textMuted} />
              </Toggle>
            </PasswordRow>
          </View>
        </View>

        {error ? <ErrorBanner message={error} /> : null}
        {!isAuthConfigured ? (
          <ErrorBanner message="Supabase não configurado. Crie o arquivo .env.local com EXPO_PUBLIC_SUPABASE_URL e EXPO_PUBLIC_SUPABASE_KEY (veja .env.example) e reinicie com `npx expo start --clear`." />
        ) : null}
      </Screen>
    </KeyboardAvoidingView>
  );
}

const Hero = styled.View`
  align-items: center;
  gap: 10px;
  padding: 24px 0 8px;
`;

const Logo = styled.View`
  width: 72px;
  height: 72px;
  border-radius: 22px;
  align-items: center;
  justify-content: center;
  background-color: ${({ theme }) => theme.colors.primary};
`;

const Title = styled.Text`
  font-size: 26px;
  font-weight: 800;
  color: ${({ theme }) => theme.colors.text};
`;

const Subtitle = styled.Text`
  font-size: 15px;
  line-height: 22px;
  text-align: center;
  color: ${({ theme }) => theme.colors.textMuted};
`;

const Label = styled.Text`
  font-size: 13px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.textMuted};
`;

const Input = styled.TextInput`
  min-height: 52px;
  padding: 0 14px;
  font-size: 16px;
  border-radius: ${({ theme }) => theme.radius.md}px;
  border-width: 1px;
  border-color: ${({ theme }) => theme.colors.border};
  background-color: ${({ theme }) => theme.colors.surface};
  color: ${({ theme }) => theme.colors.text};
`;

const PasswordRow = styled.View`
  flex-direction: row;
  align-items: center;
  border-radius: ${({ theme }) => theme.radius.md}px;
  border-width: 1px;
  border-color: ${({ theme }) => theme.colors.border};
  background-color: ${({ theme }) => theme.colors.surface};
`;

const PasswordInput = styled.TextInput`
  flex: 1;
  min-height: 52px;
  padding: 0 14px;
  font-size: 16px;
  color: ${({ theme }) => theme.colors.text};
`;

const Toggle = styled.Pressable`
  padding: 0 14px;
`;
