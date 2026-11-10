import { router } from 'expo-router';
import { useRef, useState } from 'react';
import type { ComponentRef } from 'react';
import { KeyboardAvoidingView, Platform, TextInput, View } from 'react-native';

import { Button } from '@/components/Button';
import { AuthHero, Field, FooterLink, LinkButton, OrDivider, PasswordField } from '@/components/AuthForm';
import { ErrorBanner } from '@/components/ErrorBanner';
import { FooterInner, Screen } from '@/components/Layout';
import { useApp } from '@/context/AppContext';
import { isAuthConfigured, signInWithGoogle } from '@/services/auth';
import * as haptics from '@/utils/haptics';

export default function LoginScreen() {
  const { signIn, adoptSession } = useApp();
  const passwordRef = useRef<ComponentRef<typeof TextInput>>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState<'password' | 'google' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const busy = loading !== null;
  const canSubmit = email.trim().length > 3 && password.length > 0 && !busy;

  const submit = async () => {
    if (!canSubmit) return;
    setLoading('password');
    setError(null);
    try {
      await signIn(email, password);
      haptics.success();
      // O guard de rotas (Stack.Protected) redireciona automaticamente para a Home.
    } catch (e) {
      haptics.error();
      setError((e as Error).message || 'Não foi possível entrar.');
      setLoading(null);
    }
  };

  const loginWithGoogle = async () => {
    if (busy) return;
    setLoading('google');
    setError(null);
    try {
      const session = await signInWithGoogle();
      if (session) {
        await adoptSession(session);
        haptics.success();
        return;
      }
      // usuário fechou o navegador: sem erro
      setLoading(null);
    } catch (e) {
      haptics.error();
      setError((e as Error).message || 'Não foi possível entrar com o Google.');
      setLoading(null);
    }
  };

  const footer = (
    <FooterInner>
      <Button
        label="Entrar"
        icon="log-in-outline"
        loading={loading === 'password'}
        disabled={!canSubmit}
        onPress={submit}
      />
    </FooterInner>
  );

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen footer={footer}>
        <AuthHero title="Bem-vindo ao GQA" subtitle="Entre para transformar seus documentos em questões de estudo." />

        <View style={{ gap: 14 }}>
          <Field
            label="E-mail"
            value={email}
            onChangeText={setEmail}
            placeholder="voce@email.com"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            keyboardType="email-address"
            textContentType="emailAddress"
            returnKeyType="next"
            onSubmitEditing={() => passwordRef.current?.focus()}
            editable={!busy}
          />
          <PasswordField
            ref={passwordRef}
            label="Senha"
            value={password}
            onChangeText={setPassword}
            placeholder="Sua senha"
            autoComplete="current-password"
            textContentType="password"
            returnKeyType="go"
            onSubmitEditing={submit}
            editable={!busy}
          />
          <LinkButton label="Esqueci minha senha" align="flex-end" onPress={() => router.push('/forgot-password')} />
        </View>

        {error ? <ErrorBanner message={error} /> : null}
        {!isAuthConfigured ? (
          <ErrorBanner message="Supabase não configurado. Crie o arquivo .env.local com EXPO_PUBLIC_SUPABASE_URL e EXPO_PUBLIC_SUPABASE_KEY (veja .env.example) e reinicie com `npx expo start --clear`." />
        ) : null}

        <OrDivider />

        <Button
          label="Continuar com Google"
          variant="secondary"
          icon="logo-google"
          loading={loading === 'google'}
          disabled={busy}
          onPress={loginWithGoogle}
        />

        <FooterLink prefix="Ainda não tem conta?" label="Criar conta" onPress={() => router.push('/signup')} />
      </Screen>
    </KeyboardAvoidingView>
  );
}
