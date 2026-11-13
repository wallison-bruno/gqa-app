import { router } from 'expo-router';
import { useRef, useState } from 'react';
import type { ComponentRef } from 'react';
import { KeyboardAvoidingView, Platform, TextInput, View } from 'react-native';

import { AuthHero, Field, FooterLink, LinkButton, PasswordField, isValidEmail } from '@/components/AuthForm';
import { Button } from '@/components/Button';
import { ErrorBanner } from '@/components/ErrorBanner';
import { FooterInner, Screen } from '@/components/Layout';
import { useApp } from '@/context/AppContext';
import { MIN_PASSWORD_LENGTH, requestPasswordReset, updatePassword, verifyRecoveryOtp } from '@/services/auth';
import * as haptics from '@/utils/haptics';

type ResetFieldErrors = Partial<Record<'code' | 'password' | 'confirm', string>>;

export default function ForgotPasswordScreen() {
  const { adoptSession } = useApp();
  const passwordRef = useRef<ComponentRef<typeof TextInput>>(null);
  const confirmRef = useRef<ComponentRef<typeof TextInput>>(null);

  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [fieldErrors, setFieldErrors] = useState<ResetFieldErrors>({});
  const [resendState, setResendState] = useState<'idle' | 'sending' | 'sent'>('idle');

  const goToLogin = () => (router.canGoBack() ? router.back() : router.replace('/login'));

  const sendCode = async () => {
    if (loading) return;
    setError(null);
    if (!isValidEmail(email)) {
      setEmailError('Informe um e-mail válido.');
      haptics.error();
      return;
    }
    setEmailError(null);
    setLoading(true);
    try {
      await requestPasswordReset(email);
      haptics.success();
      setSentTo(email.trim());
      setResendState('idle');
    } catch (e) {
      haptics.error();
      setError((e as Error).message || 'Não foi possível enviar o código.');
    } finally {
      setLoading(false);
    }
  };

  const openCodeStep = () => {
    if (loading) return;
    setError(null);
    if (!isValidEmail(email)) {
      setEmailError('Informe o e-mail da conta para validar o código.');
      haptics.error();
      return;
    }
    setEmailError(null);
    setSentTo(email.trim());
  };

  const resendCode = async () => {
    if (!sentTo || resendState === 'sending' || loading) return;
    setResendState('sending');
    setError(null);
    try {
      await requestPasswordReset(sentTo);
      haptics.success();
      setResendState('sent');
    } catch (e) {
      haptics.error();
      setError((e as Error).message || 'Não foi possível reenviar o código.');
      setResendState('idle');
    }
  };

  const validateReset = (): boolean => {
    const cleanCode = code.replace(/\D/g, '');
    const errors: ResetFieldErrors = {};
    if (cleanCode.length < 6) {
      errors.code = 'Digite o código de 8 dígitos enviado para seu e-mail.';
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      errors.password = `A senha precisa ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`;
    } else if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
      errors.password = 'Misture letras e números para uma senha mais segura.';
    }
    if (confirm !== password) {
      errors.confirm = 'As senhas não coincidem.';
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const verifyAndReset = async () => {
    if (!sentTo || loading) return;
    setError(null);
    if (!validateReset()) {
      haptics.error();
      return;
    }
    setLoading(true);
    try {
      const session = await verifyRecoveryOtp(sentTo, code);
      await updatePassword(session.accessToken, password);
      await adoptSession(session);
      haptics.success();
    } catch (e) {
      haptics.error();
      setError((e as Error).message || 'Não foi possível redefinir a senha.');
      setLoading(false);
    }
  };

  if (sentTo) {
    return (
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Screen
          footer={
            <FooterInner>
              <Button
                label="Redefinir senha"
                loadingLabel="Redefinindo senha…"
                icon="checkmark-circle-outline"
                loading={loading}
                disabled={loading}
                onPress={verifyAndReset}
              />
            </FooterInner>
          }
        >
          <AuthHero
            icon="mail-open-outline"
            title="Código de verificação"
            subtitle={`Enviamos um código de 8 dígitos para ${sentTo}. Digite o código abaixo e escolha sua nova senha.`}
          />

          <View style={{ gap: 14 }}>
            <Field
              label="Código de 8 dígitos"
              value={code}
              onChangeText={(t) => {
                const digits = t.replace(/\D/g, '').slice(0, 8);
                setCode(digits);
                if (fieldErrors.code) setFieldErrors((f) => ({ ...f, code: undefined }));
              }}
              error={fieldErrors.code}
              placeholder="00000000"
              keyboardType="number-pad"
              maxLength={8}
              autoComplete="one-time-code"
              textContentType="oneTimeCode"
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
              editable={!loading}
              style={{ letterSpacing: 6, fontSize: 20, fontWeight: '700', textAlign: 'center' }}
            />

            <PasswordField
              ref={passwordRef}
              label="Nova senha"
              value={password}
              onChangeText={(t) => {
                setPassword(t);
                if (fieldErrors.password) setFieldErrors((f) => ({ ...f, password: undefined }));
              }}
              error={fieldErrors.password}
              placeholder={`Mínimo de ${MIN_PASSWORD_LENGTH} caracteres`}
              autoComplete="new-password"
              textContentType="newPassword"
              returnKeyType="next"
              onSubmitEditing={() => confirmRef.current?.focus()}
              editable={!loading}
            />

            <PasswordField
              ref={confirmRef}
              label="Confirmar nova senha"
              value={confirm}
              onChangeText={(t) => {
                setConfirm(t);
                if (fieldErrors.confirm) setFieldErrors((f) => ({ ...f, confirm: undefined }));
              }}
              error={fieldErrors.confirm}
              placeholder="Repita a nova senha"
              autoComplete="new-password"
              textContentType="newPassword"
              returnKeyType="go"
              onSubmitEditing={verifyAndReset}
              editable={!loading}
            />
          </View>

          {error ? <ErrorBanner message={error} /> : null}

          <Button
            label={resendState === 'sent' ? 'Código reenviado!' : 'Reenviar código'}
            loadingLabel="Reenviando código…"
            variant="secondary"
            icon="refresh"
            loading={resendState === 'sending'}
            disabled={resendState === 'sent' || loading}
            onPress={resendCode}
          />

          <FooterLink
            prefix="E-mail incorreto?"
            label="Trocar e-mail"
            onPress={() => {
              setSentTo(null);
              setCode('');
              setError(null);
              setFieldErrors({});
            }}
          />
        </Screen>
      </KeyboardAvoidingView>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen
        footer={
          <FooterInner>
            <Button
              label="Enviar código"
              loadingLabel="Enviando código…"
              icon="send-outline"
              loading={loading}
              disabled={email.trim().length < 4}
              onPress={sendCode}
            />
          </FooterInner>
        }
      >
        <AuthHero
          icon="key-outline"
          title="Recuperar senha"
          subtitle="Informe o e-mail da sua conta e enviaremos um código de 8 dígitos para você criar uma nova senha."
        />

        <Field
          label="E-mail"
          value={email}
          onChangeText={(t) => {
            setEmail(t);
            if (emailError) setEmailError(null);
          }}
          error={emailError}
          placeholder="voce@email.com"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          keyboardType="email-address"
          textContentType="emailAddress"
          returnKeyType="send"
          onSubmitEditing={sendCode}
          editable={!loading}
        />

        <LinkButton label="Já recebi um código" onPress={openCodeStep} />

        {error ? <ErrorBanner message={error} /> : null}

        <FooterLink prefix="Lembrou a senha?" label="Entrar" onPress={goToLogin} />
      </Screen>
    </KeyboardAvoidingView>
  );
}
