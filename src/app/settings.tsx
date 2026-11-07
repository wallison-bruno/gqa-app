import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Platform, View } from 'react-native';
import styled, { useTheme } from 'styled-components/native';

import { Button } from '@/components/Button';
import { AppHeader, Card, FooterInner, Screen, SectionTitle } from '@/components/Layout';
import { useApp } from '@/context/AppContext';
import { checkHealth, getDefaultApiUrl, normalizeBaseUrl } from '@/services/api';
import type { ApiError } from '@/services/api';
import * as haptics from '@/utils/haptics';

type TestState = { status: 'idle' | 'testing' | 'ok' | 'fail'; message?: string };

export default function SettingsScreen() {
  const theme = useTheme();
  const { apiUrl, session, saveApiUrl, signOut } = useApp();
  const [urlInput, setUrlInput] = useState(apiUrl);
  const [test, setTest] = useState<TestState>({ status: 'idle' });

  const runTest = async () => {
    setTest({ status: 'testing' });
    try {
      const ok = await checkHealth(urlInput);
      if (!ok) throw new Error('O servidor respondeu, mas não parece ser a API do GQA.');
      haptics.success();
      setTest({ status: 'ok', message: 'Conectado com sucesso!' });
    } catch (e) {
      haptics.error();
      setTest({ status: 'fail', message: (e as ApiError).message });
    }
  };

  const save = async () => {
    await saveApiUrl(urlInput);
    router.back();
  };

  const confirmSignOut = () => {
    const doSignOut = () => {
      signOut();
    };
    if (Platform.OS === 'web') {
      doSignOut();
      return;
    }
    Alert.alert('Sair da conta?', 'Você precisará entrar novamente para gerar questões.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Sair', style: 'destructive', onPress: doSignOut },
    ]);
  };

  const header = <AppHeader title="Configurações" subtitle="Conexão com o servidor" onBack={() => router.back()} />;
  const footer = (
    <FooterInner>
      <Button label="Salvar" icon="save-outline" onPress={save} />
    </FooterInner>
  );

  return (
    <Screen header={header} footer={footer}>
      <Card>
        <SectionTitle>Endereço da API</SectionTitle>
        <Input
          value={urlInput}
          onChangeText={(t) => {
            setUrlInput(t);
            setTest({ status: 'idle' });
          }}
          placeholder="http://192.168.0.10:3000"
          placeholderTextColor={theme.colors.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          accessibilityLabel="Endereço da API"
        />
        <Hint>
          Em celular físico use o IP do seu computador na rede Wi-Fi. No emulador Android use 10.0.2.2 e, no
          simulador iOS, localhost.
        </Hint>

        <Row>
          <View style={{ flex: 1 }}>
            <Button
              label="Testar conexão"
              variant="secondary"
              icon="pulse"
              loading={test.status === 'testing'}
              onPress={runTest}
            />
          </View>
          <View>
            <Button
              label="Padrão"
              variant="ghost"
              onPress={() => {
                setUrlInput(getDefaultApiUrl());
                setTest({ status: 'idle' });
              }}
            />
          </View>
        </Row>

        {test.status === 'ok' || test.status === 'fail' ? (
          <Result $ok={test.status === 'ok'} accessibilityLiveRegion="polite">
            <Ionicons
              name={test.status === 'ok' ? 'checkmark-circle' : 'alert-circle'}
              size={22}
              color={test.status === 'ok' ? theme.colors.success : theme.colors.danger}
            />
            <ResultText $ok={test.status === 'ok'}>{test.message}</ResultText>
          </Result>
        ) : null}
        {test.status === 'idle' ? <Hint>Será usado: {normalizeBaseUrl(urlInput) || getDefaultApiUrl()}</Hint> : null}
      </Card>

      <Card>
        <SectionTitle>Conta</SectionTitle>
        <Row>
          <Ionicons name="person-circle-outline" size={36} color={theme.colors.primary} />
          <View style={{ flex: 1 }}>
            <AccountEmail numberOfLines={1}>{session?.user.email || 'Usuário autenticado'}</AccountEmail>
            <Hint>Conectado via Supabase</Hint>
          </View>
        </Row>
        <Button label="Sair da conta" variant="secondary" icon="log-out-outline" onPress={confirmSignOut} />
      </Card>
    </Screen>
  );
}

const AccountEmail = styled.Text`
  font-size: 16px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.text};
`;

const Input = styled.TextInput`
  min-height: 48px;
  padding: 0 14px;
  font-size: 16px;
  border-radius: ${({ theme }) => theme.radius.md}px;
  border-width: 1px;
  border-color: ${({ theme }) => theme.colors.border};
  background-color: ${({ theme }) => theme.colors.background};
  color: ${({ theme }) => theme.colors.text};
`;

const Hint = styled.Text`
  font-size: 13px;
  line-height: 18px;
  color: ${({ theme }) => theme.colors.textMuted};
`;

const Row = styled.View`
  flex-direction: row;
  gap: 8px;
  align-items: center;
`;

const Result = styled.View<{ $ok: boolean }>`
  flex-direction: row;
  align-items: flex-start;
  gap: 10px;
  padding: 12px 14px;
  border-radius: ${({ theme }) => theme.radius.md}px;
  background-color: ${({ theme, $ok }) => ($ok ? theme.colors.successSoft : theme.colors.dangerSoft)};
`;

const ResultText = styled.Text<{ $ok: boolean }>`
  flex: 1;
  font-size: 14px;
  line-height: 20px;
  color: ${({ theme, $ok }) => ($ok ? theme.colors.success : theme.colors.danger)};
`;

