import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Platform, View } from 'react-native';
import styled, { useTheme } from 'styled-components/native';

import { Button } from '@/components/Button';
import { DocumentListSkeleton } from '@/components/DocumentListSkeleton';
import { ErrorBanner } from '@/components/ErrorBanner';
import { AppHeader, Card, FooterInner, IconButton, Screen, SectionTitle } from '@/components/Layout';
import { DiscreteSpinner, FadeInView } from '@/components/LoadingPrimitives';
import { UploadStatusPanel } from '@/components/UploadStatusPanel';
import { useApp } from '@/context/AppContext';
import { ApiError, uploadDocument } from '@/services/api';
import { FilePickError, MAX_FILE_MB, SUPPORTED_LABEL, fileIcon, pickDocument } from '@/services/filePicker';
import type { PickedFile, StoredDocument } from '@/types';
import { decodeFileName, formatBytes, formatRelativeDate } from '@/utils/format';
import * as haptics from '@/utils/haptics';

type Phase = 'idle' | 'uploading' | 'processing';

export default function HomeScreen() {
  const theme = useTheme();
  const {
    apiUrl,
    userId,
    documents,
    documentsLoading,
    documentsError,
    refreshDocuments,
    addDocument,
    removeDocument,
    getAccessToken,
  } = useApp();

  const [file, setFile] = useState<PickedFile | null>(null);
  const [addedDocument, setAddedDocument] = useState<StoredDocument | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [progress, setProgress] = useState(0);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [manualRefreshing, setManualRefreshing] = useState(false);
  const [error, setError] = useState<{ message: string; network: boolean } | null>(null);

  const busy = phase !== 'idle';

  const handlePullRefresh = useCallback(async () => {
    setManualRefreshing(true);
    try {
      await refreshDocuments();
    } finally {
      setManualRefreshing(false);
    }
  }, [refreshDocuments]);

  // Sincroniza a lista de documentos do banco sempre que a tela inicial ganha foco
  useFocusEffect(
    useCallback(() => {
      refreshDocuments();
    }, [refreshDocuments]),
  );

  const handlePick = useCallback(async () => {
    if (busy) return;
    setError(null);
    try {
      const picked = await pickDocument();
      if (picked) {
        setAddedDocument(null);
        setFile(picked);
      }
    } catch (e) {
      const message = e instanceof FilePickError ? e.message : 'Não foi possível abrir o arquivo selecionado.';
      setError({ message, network: false });
    }
  }, [busy]);

  const handleAddAnother = useCallback(async () => {
    if (busy) return;
    setAddedDocument(null);
    setFile(null);
    await handlePick();
  }, [busy, handlePick]);

  const handleUpload = useCallback(async () => {
    if (!file || busy) return;
    setError(null);
    setAddedDocument(null);
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
        title: decodeFileName(file.name),
        mimeType: file.mimeType,
        size: file.size,
        createdAt: Date.now(),
        status: 'processado',
        questionCount: 0,
      };
      await addDocument(doc);
      haptics.success();
      setFile(null);
      setAddedDocument(doc);
    } catch (e) {
      haptics.error();
      const apiError = e instanceof ApiError ? e : null;
      setError({
        message:
          apiError?.message ??
          'Não foi possível adicionar este arquivo agora. Tente novamente ou escolha outro arquivo.',
        network: apiError?.kind === 'network',
      });
    } finally {
      setPhase('idle');
    }
  }, [file, busy, apiUrl, userId, addDocument, getAccessToken]);

  const openDocument = (doc: StoredDocument) => {
    if (deletingId === doc.id) return;
    if (addedDocument?.id === doc.id) {
      setAddedDocument(null);
    }
    router.push({
      pathname: '/quiz/[documentId]',
      params: { documentId: doc.id, title: decodeFileName(doc.title) },
    });
  };

  const executeDeleteDocument = useCallback(
    async (doc: StoredDocument) => {
      if (deletingId) return;
      setDeletingId(doc.id);
      setError(null);
      try {
        await removeDocument(doc.id);
        setAddedDocument((prev) => (prev?.id === doc.id ? null : prev));
        haptics.success();
      } catch (e) {
        haptics.error();
        const apiError = e instanceof ApiError ? e : null;
        setError({
          message: apiError?.message ?? 'Não foi possível excluir o documento.',
          network: apiError?.kind === 'network',
        });
      } finally {
        setDeletingId(null);
      }
    },
    [deletingId, removeDocument],
  );

  const confirmRemove = (doc: StoredDocument) => {
    if (deletingId) return;
    const cleanTitle = decodeFileName(doc.title);
    if (Platform.OS === 'web') {
      const ok =
        typeof window !== 'undefined'
          ? window.confirm(`Excluir "${cleanTitle}" e todas as suas questões salvas?`)
          : true;
      if (ok) executeDeleteDocument(doc);
      return;
    }
    Alert.alert(
      'Excluir documento?',
      `"${cleanTitle}" e todas as suas questões salvas serão excluídos permanentemente.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Excluir', style: 'destructive', onPress: () => executeDeleteDocument(doc) },
      ],
    );
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
      {addedDocument ? (
        <Button label="Gerar questões agora" icon="sparkles" onPress={() => openDocument(addedDocument)} />
      ) : (
        <Button
          label="Enviar arquivo"
          loadingLabel={phase === 'uploading' ? 'Enviando arquivo…' : 'Preparando seu material…'}
          icon="cloud-upload-outline"
          loading={busy}
          disabled={!file}
          onPress={handleUpload}
        />
      )}
    </FooterInner>
  );

  return (
    <Screen header={header} footer={footer} refreshing={manualRefreshing} onRefresh={handlePullRefresh}>
      <View style={{ gap: 6 }}>
        <Title>Estude com o seu próprio material</Title>
        <Subtitle>Adicione um arquivo e gere questões personalizadas com correção e explicação.</Subtitle>
      </View>

      {addedDocument ? (
        <FadeInView>
          <Card accessibilityLiveRegion="polite">
            <FileRow>
              <SuccessBadge>
                <Ionicons name="checkmark-circle" size={28} color={theme.colors.success} />
              </SuccessBadge>
              <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                <SuccessTitle>Arquivo adicionado com sucesso!</SuccessTitle>
                <FileMeta numberOfLines={1} ellipsizeMode="middle">
                  {decodeFileName(addedDocument.title)}
                </FileMeta>
              </View>
              <IconButton
                accessibilityRole="button"
                accessibilityLabel="Fechar confirmação"
                onPress={() => setAddedDocument(null)}
              >
                <Ionicons name="close" size={20} color={theme.colors.textMuted} />
              </IconButton>
            </FileRow>

            <SuccessDescription>
              Seu material já está disponível para gerar questões.
            </SuccessDescription>

            <Button
              label="Adicionar outro arquivo"
              variant="secondary"
              icon="add-circle-outline"
              onPress={handleAddAnother}
            />
          </Card>
        </FadeInView>
      ) : file ? (
        <Card>
          <FileRow>
            <FileBadge>
              <Ionicons name={fileIcon(file.mimeType)} size={26} color={theme.colors.primary} />
            </FileBadge>
            <View style={{ flex: 1, minWidth: 0 }}>
              <FileName numberOfLines={2}>{decodeFileName(file.name)}</FileName>
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

          {phase === 'uploading' || phase === 'processing' ? (
            <UploadStatusPanel phase={phase} progress={progress} />
          ) : null}

          {!busy ? (
            <Button label="Trocar arquivo" variant="secondary" icon="swap-horizontal" onPress={handlePick} />
          ) : null}
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

      <View style={{ gap: 10 }}>
        <SectionHeader>
          <SectionTitle>
            Meus materiais{documents.length > 0 ? ` (${documents.length})` : ''}
          </SectionTitle>
          <RefreshAction
            onPress={refreshDocuments}
            disabled={documentsLoading}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Atualizar lista de materiais"
          >
            {documentsLoading ? (
              <DiscreteSpinner size="sm" />
            ) : (
              <Ionicons name="refresh-outline" size={18} color={theme.colors.primary} />
            )}
            <RefreshText>{documentsLoading ? 'Atualizando…' : 'Atualizar'}</RefreshText>
          </RefreshAction>
        </SectionHeader>

        {documentsError && documents.length === 0 ? (
          <ErrorBanner message={documentsError} onRetry={refreshDocuments} />
        ) : null}

        {documentsLoading && documents.length === 0 ? (
          <DocumentListSkeleton count={3} />
        ) : documents.length === 0 ? (
          <FadeInView>
            <EmptyDocsCard>
              <Ionicons name="folder-open-outline" size={28} color={theme.colors.textMuted} />
              <EmptyDocsText>
                Você ainda não adicionou nenhum material. Escolha um arquivo acima para começar!
              </EmptyDocsText>
            </EmptyDocsCard>
          </FadeInView>
        ) : (
          <FadeInView style={{ gap: 10 }}>
            {documents.map((doc) => {
              const count = doc.questionCount ?? 0;
              const isDeleting = deletingId === doc.id;
              const metaParts = [
                formatBytes(doc.size),
                formatRelativeDate(doc.createdAt),
              ].filter(Boolean);

              return (
                <DocRow
                  key={doc.id}
                  onPress={() => openDocument(doc)}
                  onLongPress={() => confirmRemove(doc)}
                  disabled={isDeleting}
                  style={{ opacity: isDeleting ? 0.65 : 1 }}
                  accessibilityRole="button"
                  accessibilityLabel={`Abrir ${doc.title}`}
                  accessibilityHint="Toque para estudar as questões ou mantenha pressionado para excluir"
                >
                  <FileBadge>
                    <Ionicons name={fileIcon(doc.mimeType)} size={22} color={theme.colors.primary} />
                  </FileBadge>
                  <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                    <FileName numberOfLines={1}>{decodeFileName(doc.title)}</FileName>
                    <DocMetaRow>
                      {isDeleting ? (
                        <QuestionCountBadge $hasQuestions={false}>
                          <QuestionCountText $hasQuestions={false}>Excluindo documento…</QuestionCountText>
                        </QuestionCountBadge>
                      ) : (
                        <>
                          <QuestionCountBadge $hasQuestions={count > 0}>
                            <Ionicons
                              name={count > 0 ? 'help-buoy-outline' : 'sparkles-outline'}
                              size={12}
                              color={count > 0 ? theme.colors.primary : theme.colors.textMuted}
                            />
                            <QuestionCountText $hasQuestions={count > 0}>
                              {count > 0
                                ? `${count} ${count === 1 ? 'questão' : 'questões'}`
                                : 'Gerar questões'}
                            </QuestionCountText>
                          </QuestionCountBadge>
                          {metaParts.length > 0 ? (
                            <FileMeta numberOfLines={1}>{metaParts.join(' · ')}</FileMeta>
                          ) : null}
                        </>
                      )}
                    </DocMetaRow>
                  </View>
                  {!isDeleting ? (
                    <Ionicons name="chevron-forward" size={20} color={theme.colors.textMuted} />
                  ) : null}
                  <RemoveButton
                    onPress={() => confirmRemove(doc)}
                    disabled={isDeleting}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={`Excluir ${doc.title}`}
                  >
                    {isDeleting ? (
                      <DiscreteSpinner size="sm" color={theme.colors.danger} />
                    ) : (
                      <Ionicons name="trash-outline" size={18} color={theme.colors.danger} />
                    )}
                  </RemoveButton>
                </DocRow>
              );
            })}
          </FadeInView>
        )}
      </View>
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

const SuccessBadge = styled.View`
  width: 48px;
  height: 48px;
  border-radius: 14px;
  align-items: center;
  justify-content: center;
  background-color: ${({ theme }) => theme.colors.successSoft};
`;

const SuccessTitle = styled.Text`
  font-size: 16px;
  font-weight: 800;
  color: ${({ theme }) => theme.colors.success};
`;

const SuccessDescription = styled.Text`
  font-size: 14px;
  line-height: 20px;
  color: ${({ theme }) => theme.colors.text};
`;

const FileName = styled.Text`
  font-size: 16px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.text};
`;

const FileMeta = styled.Text`
  font-size: 12px;
  line-height: 16px;
  color: ${({ theme }) => theme.colors.textMuted};
`;

const SectionHeader = styled.View`
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
`;

const RefreshAction = styled.Pressable`
  flex-direction: row;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border-radius: ${({ theme }) => theme.radius.pill}px;
`;

const RefreshText = styled.Text`
  font-size: 13px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.primary};
`;

const EmptyDocsCard = styled.View`
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 24px 16px;
  border-radius: ${({ theme }) => theme.radius.md}px;
  border-width: 1px;
  border-color: ${({ theme }) => theme.colors.border};
  background-color: ${({ theme }) => theme.colors.surface};
`;

const EmptyDocsText = styled.Text`
  font-size: 14px;
  line-height: 20px;
  text-align: center;
  color: ${({ theme }) => theme.colors.textMuted};
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

const DocMetaRow = styled.View`
  flex-direction: row;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
`;

const QuestionCountBadge = styled.View<{ $hasQuestions: boolean }>`
  flex-direction: row;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: ${({ theme }) => theme.radius.pill}px;
  background-color: ${({ theme, $hasQuestions }) =>
    $hasQuestions ? theme.colors.primarySoft : theme.colors.surfaceAlt};
`;

const QuestionCountText = styled.Text<{ $hasQuestions: boolean }>`
  font-size: 12px;
  font-weight: 700;
  color: ${({ theme, $hasQuestions }) => ($hasQuestions ? theme.colors.primary : theme.colors.textMuted)};
`;

const RemoveButton = styled.Pressable`
  width: 36px;
  height: 36px;
  border-radius: 18px;
  align-items: center;
  justify-content: center;
  background-color: ${({ theme }) => theme.colors.dangerSoft};
`;
