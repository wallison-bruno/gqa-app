import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Platform, View } from 'react-native';
import styled, { useTheme } from 'styled-components/native';

import { Button } from '@/components/Button';
import { ErrorBanner } from '@/components/ErrorBanner';
import { AppHeader, Card, FooterInner, IconButton, Screen, SectionTitle } from '@/components/Layout';
import { useApp } from '@/context/AppContext';
import { ApiError, uploadDocument } from '@/services/api';
import { FilePickError, SUPPORTED_LABEL, MAX_FILE_MB, fileIcon, pickDocument } from '@/services/filePicker';
import type { PickedFile, StoredDocument } from '@/types';
import { formatBytes, formatRelativeDate } from '@/utils/format';
import * as haptics from '@/utils/haptics';

type Phase = 'idle' | 'uploading' | 'processing';

export default function HomeScreen() {
  const theme = useTheme();
  const { apiUrl, userId, documents, addDocument, removeDocument, getAccessToken } = useApp();

  const [file, setFile] = useState<PickedFile | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<{ message: string; network: boolean } | null>(null);

  const busy = phase !== 'idle';

  const handlePick = useCallback(async () => {
    if (busy) return;
    setError(null);
    try {
      const picked = await pickDocument();
      if (picked) setFile(picked);
    } catch (e) {
      const message = e instanceof FilePickError ? e.message : 'Não foi possível abrir o arquivo selecionado.';
      setError({ message, network: false });
    }
  }, [busy]);

  const handleUpload = useCallback(async () => {
    if (!file || busy) return;
    setError(null);
    setProgress(0);
    setPhase('uploading');
    try {
      const accessToken = await getAccessToken();
      const result = await uploadDocument(
        apiUrl,
        userId,
        accessToken,
        file,
        (fraction) => setProgress(fraction),
        () => setPhase('processing'),
      );

      const doc: StoredDocument = {
        id: result.document_id,
        title: file.name,
        mimeType: file.mimeType,
        size: file.size,
        createdAt: Date.now(),
      };
      await addDocument(doc);
      haptics.success();
      setFile(null);
      router.push({ pathname: '/quiz/[documentId]', params: { documentId: doc.id, title: doc.title } });
    } catch (e) {
      haptics.error();
      const apiError = e instanceof ApiError ? e : null;
      setError({
        message: apiError?.message ?? 'Algo deu errado ao enviar o arquivo.',
        network: apiError?.kind === 'network',
      });
    } finally {
      setPhase('idle');
    }
  }, [file, busy, apiUrl, userId, addDocument, getAccessToken]);

  const openDocument = (doc: StoredDocument) =>
    router.push({ pathname: '/quiz/[documentId]', params: { documentId: doc.id, title: doc.title } });

  const confirmRemove = (doc: StoredDocument) => {
    if (Platform.OS === 'web') {
      removeDocument(doc.id);
      return;
    }
    Alert.alert('Remover da lista?', `"${doc.title}" será removido apenas deste aparelho.`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Remover', style: 'destructive', onPress: () => removeDocument(doc.id) },
    ]);
  };

  const header = (
    <AppHeader
      title="GQA"
      subtitle="Gerador de questões"
      right={
        <IconButton
          accessibilityRole="button"
          accessibilityLabel="Configurações"
          onPress={() => router.push('/settings')}
        >
          <Ionicons name="settings-outline" size={22} color={theme.colors.text} />
        </IconButton>
      }
    />
  );

  const footer = (
    <FooterInner>
      <Button
        label={phase === 'uploading' ? 'Enviando arquivo…' : phase === 'processing' ? 'Processando…' : 'Enviar e gerar questões'}
        icon="sparkles"
        loading={busy}
        disabled={!file}
        onPress={handleUpload}
      />
    </FooterInner>
  );

  return (
    <Screen header={header} footer={footer}>
      <View style={{ gap: 6 }}>
        <Title>Estude com o seu próprio material</Title>
        <Subtitle>
          Envie um documento e receba questões de múltipla escolha com correção e explicação.
        </Subtitle>
      </View>

      {file ? (
        <Card>
          <FileRow>
            <FileBadge>
              <Ionicons name={fileIcon(file.mimeType)} size={26} color={theme.colors.primary} />
            </FileBadge>
            <View style={{ flex: 1 }}>
              <FileName numberOfLines={2}>{file.name}</FileName>
              <FileMeta>{formatBytes(file.size) || 'Tamanho desconhecido'}</FileMeta>
            </View>
            {!busy ? (
              <IconButton
                accessibilityRole="button"
                accessibilityLabel="Remover arquivo selecionado"
                onPress={() => setFile(null)}
              >
                <Ionicons name="close" size={20} color={theme.colors.textMuted} />
              </IconButton>
            ) : null}
          </FileRow>

          {phase === 'uploading' ? (
            <View style={{ gap: 6 }}>
              <Track>
                <Fill style={{ width: `${Math.round(progress * 100)}%` }} />
              </Track>
              <FileMeta>Enviando… {Math.round(progress * 100)}%</FileMeta>
            </View>
          ) : null}

          {phase === 'processing' ? (
            <ProcessingRow>
              <ActivityIndicator color={theme.colors.primary} />
              <FileMeta style={{ flex: 1 }}>
                Lendo e indexando o documento. Isso pode levar alguns instantes em arquivos grandes…
              </FileMeta>
            </ProcessingRow>
          ) : null}

          {!busy ? <Button label="Trocar arquivo" variant="secondary" icon="swap-horizontal" onPress={handlePick} /> : null}
        </Card>
      ) : (
        <DropZone
          onPress={handlePick}
          accessibilityRole="button"
          accessibilityLabel="Escolher arquivo para enviar"
        >
          <DropIcon>
            <Ionicons name="cloud-upload-outline" size={34} color={theme.colors.primary} />
          </DropIcon>
          <DropTitle>Escolher arquivo</DropTitle>
          <DropHint>
            {SUPPORTED_LABEL}
            {'\n'}até {MAX_FILE_MB} MB
          </DropHint>
        </DropZone>
      )}

      {error ? (
        <ErrorBanner
          message={error.message}
          onRetry={file ? handleUpload : undefined}
          onOpenSettings={error.network ? () => router.push('/settings') : undefined}
        />
      ) : null}

      {documents.length > 0 ? (
        <View style={{ gap: 10 }}>
          <SectionTitle>Documentos recentes</SectionTitle>
          {documents.map((doc) => (
            <DocRow
              key={doc.id}
              onPress={() => openDocument(doc)}
              onLongPress={() => confirmRemove(doc)}
              accessibilityRole="button"
              accessibilityLabel={`Abrir ${doc.title}`}
              accessibilityHint="Mantenha pressionado para remover da lista"
            >
              <FileBadge>
                <Ionicons name={fileIcon(doc.mimeType)} size={22} color={theme.colors.primary} />
              </FileBadge>
              <View style={{ flex: 1 }}>
                <FileName numberOfLines={1}>{doc.title}</FileName>
                <FileMeta>
                  {[formatBytes(doc.size), formatRelativeDate(doc.createdAt)].filter(Boolean).join(' · ')}
                </FileMeta>
              </View>
              <Ionicons name="chevron-forward" size={20} color={theme.colors.textMuted} />
              <RemoveButton
                onPress={() => confirmRemove(doc)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={`Remover ${doc.title} da lista`}
              >
                <Ionicons name="trash-outline" size={18} color={theme.colors.textMuted} />
              </RemoveButton>
            </DocRow>
          ))}
        </View>
      ) : null}
    </Screen>
  );
}

const Title = styled.Text`
  font-size: 28px;
  line-height: 34px;
  font-weight: 800;
  color: ${({ theme }) => theme.colors.text};
`;

const Subtitle = styled.Text`
  font-size: 16px;
  line-height: 23px;
  color: ${({ theme }) => theme.colors.textMuted};
`;

const DropZone = styled.Pressable`
  align-items: center;
  gap: 8px;
  padding: 36px 20px;
  border-radius: ${({ theme }) => theme.radius.lg}px;
  border-width: 2px;
  border-style: dashed;
  border-color: ${({ theme }) => theme.colors.primary};
  background-color: ${({ theme }) => theme.colors.primarySoft};
`;

const DropIcon = styled.View`
  width: 68px;
  height: 68px;
  border-radius: 34px;
  align-items: center;
  justify-content: center;
  background-color: ${({ theme }) => theme.colors.surface};
`;

const DropTitle = styled.Text`
  font-size: 18px;
  font-weight: 800;
  color: ${({ theme }) => theme.colors.primary};
`;

const DropHint = styled.Text`
  font-size: 13px;
  line-height: 19px;
  text-align: center;
  color: ${({ theme }) => theme.colors.textMuted};
`;

const FileRow = styled.View`
  flex-direction: row;
  align-items: center;
  gap: 12px;
`;

const FileBadge = styled.View`
  width: 48px;
  height: 48px;
  border-radius: 14px;
  align-items: center;
  justify-content: center;
  background-color: ${({ theme }) => theme.colors.primarySoft};
`;

const FileName = styled.Text`
  font-size: 16px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.text};
`;

const FileMeta = styled.Text`
  font-size: 13px;
  line-height: 18px;
  color: ${({ theme }) => theme.colors.textMuted};
`;

const Track = styled.View`
  height: 8px;
  border-radius: 4px;
  overflow: hidden;
  background-color: ${({ theme }) => theme.colors.surfaceAlt};
`;

const Fill = styled.View`
  height: 100%;
  border-radius: 4px;
  background-color: ${({ theme }) => theme.colors.primary};
`;

const ProcessingRow = styled.View`
  flex-direction: row;
  align-items: center;
  gap: 12px;
`;

const DocRow = styled.Pressable`
  flex-direction: row;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border-radius: ${({ theme }) => theme.radius.md}px;
  border-width: 1px;
  border-color: ${({ theme }) => theme.colors.border};
  background-color: ${({ theme }) => theme.colors.surface};
`;

const RemoveButton = styled.Pressable`
  padding: 6px;
`;

