import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import type { ComponentRef } from 'react';
import { KeyboardAvoidingView, Platform, TextInput } from 'react-native';

import { AuthHero, PasswordField } from '@/components/AuthForm';
import { Button } from '@/components/Button';
import { ErrorBanner } from '@/components/ErrorBanner';
import { FooterInner, Screen } from '@/components/Layout';
import { StatusLoadingCard } from '@/components/LoadingPrimitives';
import { useApp } from '@/context/AppContext';
import { MIN_PASSWORD_LENGTH, exchangeRecoveryCode, updatePassword } from '@/services/auth';
import type { Session } from '@/services/auth';
import * as haptics from '@/utils/haptics';

type Phase = 'verifying' | 'ready' | 'invalid';

/**
 * Destino do link do e-mail de recuperação: `gqa-app://reset-password?code=...`.
 * O `code` é trocado por uma sessão temporária (PKCE), usada só para definir a nova senha.
 */
export default function ResetPasswordScreen() {
  const { adoptSession } = useApp();
  const params = useLocalSearchParams<{ code?: string; error_description?: string }>();
  const code = typeof params.code === 'string' ? params.code : undefined;
  const linkError = typeof params.error_description === 'string' ? params.error_description : undefined;
  const confirmRef = useRef<ComponentRef<typeof TextInput>>(null);

  const [phase, setPhase] = useState<Phase>(code ? 'verifying' : 'invalid');
  const [recoverySession, setRecoverySession] = useState<Session | null>(null);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(
    code ? null : linkError?.replace(/\+/g, ' ') || 'Link inválido ou expirado.',
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!code) return;
    let cancelled = false;
    exchangeRecoveryCode(code)
      .then((s) => {
        if (cancelled) return;
        setRecoverySession(s);
        setPhase('ready');
      })
      .catch((e: Error) => {
        if (cancelled) return;
        setError(e.message || 'Link inválido ou expirado.');
        setPhase('invalid');
      });
    return () => {
      cancelled = true;
    };
  }, [code]);

  const submit = async () => {
    if (saving || !recoverySession) return;
    let valid = true;
    if (password.length < MIN_PASSWORD_LENGTH) {
      setPasswordError(`A senha precisa ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`);
      valid = false;
    } else if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
      setPasswordError('Misture letras e números para uma senha mais segura.');
      valid = false;
    } else {
      setPasswordError(null);
    }
    if (confirm !== password) {
      setConfirmError('As senhas não coincidem.');
      valid = false;
    } else {
      setConfirmError(null);
    }
    if (!valid) {
      haptics.error();
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await updatePassword(recoverySession.accessToken, password);
      haptics.success();
      await adoptSession(recoverySession); // já entra logado com a nova senha
      router.replace('/');
    } catch (e) {
      haptics.error();
      setError((e as Error).message || 'Não foi possível alterar a senha.');
      setSaving(false);
    }
  };

  if (phase === 'verifying') {
    return (
      <Screen>
        <StatusLoadingCard
          icon="key-outline"
          badgeText="Validando código"
          title="Verificando link de recuperação"
          subtitle="Checando a segurança do link antes de liberar a criação da nova senha…"
        />
      </Screen>
    );
  }

  if (phase === 'invalid') {
    return (
      <Screen
        footer={
          <FooterInner>
            <Button label="Solicitar novo link" icon="refresh" onPress={() => router.replace('/forgot-password')} />
            <Button label="Voltar ao login" variant="ghost" onPress={() => router.replace('/login')} />
          </FooterInner>
        }
      >
        <AuthHero icon="alert-circle-outline" title="Link inválido" subtitle="Não foi possível usar este link de recuperação." />
        {error ? <ErrorBanner message={error} /> : null}
      </Screen>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen
        footer={
          <FooterInner>
            <Button
              label="Salvar nova senha"
              loadingLabel="Salvando nova senha…"
              icon="checkmark-circle-outline"
              loading={saving}
              onPress={submit}
            />
          </FooterInner>
        }
      >
        <AuthHero
          icon="lock-closed-outline"
          title="Nova senha"
          subtitle={
            recoverySession?.user.email
              ? `Defina uma nova senha para ${recoverySession.user.email}.`
              : 'Defina sua nova senha.'
          }
        />

        <PasswordField
          label="Nova senha"
          value={password}
          onChangeText={(t) => {
            setPassword(t);
            if (passwordError) setPasswordError(null);
          }}
          error={passwordError}
          placeholder={`Mínimo de ${MIN_PASSWORD_LENGTH} caracteres`}
          autoComplete="new-password"
          textContentType="newPassword"
          returnKeyType="next"
          onSubmitEditing={() => confirmRef.current?.focus()}
          editable={!saving}
        />
        <PasswordField
          ref={confirmRef}
          label="Confirmar nova senha"
          value={confirm}
          onChangeText={(t) => {
            setConfirm(t);
            if (confirmError) setConfirmError(null);
          }}
          error={confirmError}
          placeholder="Repita a senha"
          autoComplete="new-password"
          textContentType="newPassword"
          returnKeyType="go"
          onSubmitEditing={submit}
          editable={!saving}
        />

        {error ? <ErrorBanner message={error} /> : null}
      </Screen>
    </KeyboardAvoidingView>
  );
}

