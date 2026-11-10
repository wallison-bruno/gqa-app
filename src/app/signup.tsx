import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import type { ComponentRef } from 'react';
import { KeyboardAvoidingView, Platform, TextInput, View } from 'react-native';
import styled, { useTheme } from 'styled-components/native';

import { AuthHero, Field, FooterLink, OrDivider, PasswordField, isValidEmail } from '@/components/AuthForm';
import { Button } from '@/components/Button';
import { ErrorBanner } from '@/components/ErrorBanner';
import { FooterInner, Screen } from '@/components/Layout';
import { useApp } from '@/context/AppContext';
import {
  MIN_PASSWORD_LENGTH,
  resendConfirmation,
  signInWithGoogle,
  signUpWithPassword,
  verifySignupOtp,
} from '@/services/auth';
import * as haptics from '@/utils/haptics';

type FieldErrors = Partial<Record<'email' | 'password' | 'confirm', string>>;

export default function SignUpScreen() {
  const theme = useTheme();
  const { adoptSession } = useApp();
  const emailRef = useRef<ComponentRef<typeof TextInput>>(null);
  const passwordRef = useRef<ComponentRef<typeof TextInput>>(null);
  const confirmRef = useRef<ComponentRef<typeof TextInput>>(null);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [loading, setLoading] = useState<'signup' | 'google' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [otpCode, setOtpCode] = useState('');
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [resend, setResend] = useState<'idle' | 'sending' | 'sent'>('idle');

  const busy = loading !== null;

  const validate = (): boolean => {
    const errors: FieldErrors = {};
    if (!isValidEmail(email)) errors.email = 'Informe um e-mail válido.';
    if (password.length < MIN_PASSWORD_LENGTH) {
      errors.password = `A senha precisa ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`;
    } else if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
      errors.password = 'Misture letras e números para uma senha mais segura.';
    }
    if (confirm !== password) errors.confirm = 'As senhas não coincidem.';
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const submit = async () => {
    if (busy) return;
    setError(null);
    if (!validate()) {
      haptics.error();
      return;
    }
    setLoading('signup');
    try {
      const result = await signUpWithPassword({ email, password, name });
      haptics.success();
      if (result.status === 'signed_in') {
        await adoptSession(result.session); // o guard de rotas leva para a Home
        return;
      }
      setPendingEmail(result.email);
      setLoading(null);
    } catch (e) {
      haptics.error();
      setError((e as Error).message || 'Não foi possível criar a conta.');
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
      setLoading(null);
    } catch (e) {
      haptics.error();
      setError((e as Error).message || 'Não foi possível entrar com o Google.');
      setLoading(null);
    }
  };

  const resendEmail = async () => {
    if (!pendingEmail || resend === 'sending') return;
    setResend('sending');
    setError(null);
    try {
      await resendConfirmation(pendingEmail);
      setResend('sent');
    } catch (e) {
      setError((e as Error).message);
      setResend('idle');
    }
  };

  const confirmWithCode = async () => {
    if (!pendingEmail || verifyingOtp) return;
    const clean = otpCode.replace(/\D/g, '');
    if (clean.length < 6) {
      setError('Digite o código de 8 dígitos enviado para seu e-mail.');
      haptics.error();
      return;
    }
    setVerifyingOtp(true);
    setError(null);
    try {
      const session = await verifySignupOtp(pendingEmail, clean);
      await adoptSession(session);
      haptics.success();
    } catch (e) {
      haptics.error();
      setError((e as Error).message || 'Não foi possível validar o código.');
      setVerifyingOtp(false);
    }
  };

  // ---- Estado: aguardando confirmação do e-mail ----
  if (pendingEmail) {
    return (
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Screen
          footer={
            <FooterInner>
              <Button
                label="Confirmar código"
                icon="checkmark-circle-outline"
                loading={verifyingOtp}
                disabled={verifyingOtp}
                onPress={confirmWithCode}
              />
            </FooterInner>
          }
        >
          <AuthHero
            icon="mail-unread-outline"
            title="Confirme seu e-mail"
            subtitle={`Enviamos um código para ${pendingEmail}. Digite o código de 8 dígitos abaixo ou toque no link enviado por e-mail.`}
          />
          <Field
            label="Código de 8 dígitos"
            value={otpCode}
            onChangeText={(t) => {
              setOtpCode(t.replace(/\D/g, '').slice(0, 8));
              if (error) setError(null);
            }}
            placeholder="00000000"
            keyboardType="number-pad"
            maxLength={8}
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            returnKeyType="done"
            onSubmitEditing={confirmWithCode}
            editable={!verifyingOtp}
            style={{ letterSpacing: 6, fontSize: 20, fontWeight: '700', textAlign: 'center' }}
          />
          <Tip>
            <Ionicons name="information-circle-outline" size={20} color={theme.colors.primary} />
            <TipText>Não encontrou? Verifique também a caixa de spam ou promoções.</TipText>
          </Tip>
          {error ? <ErrorBanner message={error} /> : null}
          <Button
            label={resend === 'sent' ? 'Código reenviado!' : 'Reenviar código'}
            variant="secondary"
            icon="refresh"
            loading={resend === 'sending'}
            disabled={resend === 'sent' || verifyingOtp}
            onPress={resendEmail}
          />
          <FooterLink prefix="Já confirmou pelo link?" label="Ir para o login" onPress={() => router.replace('/login')} />
        </Screen>
      </KeyboardAvoidingView>
    );
  }

  const footer = (
    <FooterInner>
      <Button label="Criar conta" icon="person-add-outline" loading={loading === 'signup'} disabled={busy} onPress={submit} />
    </FooterInner>
  );

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen footer={footer}>
        <AuthHero title="Criar conta" subtitle="Leva menos de um minuto. Depois é só enviar um documento e estudar." />

        <View style={{ gap: 14 }}>
          <Field
            label="Nome (opcional)"
            value={name}
            onChangeText={setName}
            placeholder="Como devemos te chamar?"
            autoComplete="name"
            textContentType="name"
            returnKeyType="next"
            onSubmitEditing={() => emailRef.current?.focus()}
            editable={!busy}
          />
          <Field
            ref={emailRef}
            label="E-mail"
            value={email}
            onChangeText={(t) => {
              setEmail(t);
              if (fieldErrors.email) setFieldErrors((f) => ({ ...f, email: undefined }));
            }}
            error={fieldErrors.email}
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
            editable={!busy}
          />
          <PasswordField
            ref={confirmRef}
            label="Confirmar senha"
            value={confirm}
            onChangeText={(t) => {
              setConfirm(t);
              if (fieldErrors.confirm) setFieldErrors((f) => ({ ...f, confirm: undefined }));
            }}
            error={fieldErrors.confirm}
            placeholder="Repita a senha"
            autoComplete="new-password"
            textContentType="newPassword"
            returnKeyType="go"
            onSubmitEditing={submit}
            editable={!busy}
          />
        </View>

        {error ? <ErrorBanner message={error} /> : null}

        <OrDivider />

        <Button
          label="Cadastrar com Google"
          variant="secondary"
          icon="logo-google"
          loading={loading === 'google'}
          disabled={busy}
          onPress={loginWithGoogle}
        />

        <FooterLink
          prefix="Já tem conta?"
          label="Entrar"
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/login'))}
        />
      </Screen>
    </KeyboardAvoidingView>
  );
}

const Tip = styled.View`
  flex-direction: row;
  gap: 10px;
  align-items: flex-start;
  padding: 14px 16px;
  border-radius: ${({ theme }) => theme.radius.md}px;
  background-color: ${({ theme }) => theme.colors.primarySoft};
`;

const TipText = styled.Text`
  flex: 1;
  font-size: 14px;
  line-height: 20px;
  color: ${({ theme }) => theme.colors.text};
`;
