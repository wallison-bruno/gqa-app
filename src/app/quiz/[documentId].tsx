import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Platform, ScrollView, View } from 'react-native';
import styled, { useTheme } from 'styled-components/native';

import { Button } from '@/components/Button';
import { DifficultySelector } from '@/components/DifficultySelector';
import { ErrorBanner } from '@/components/ErrorBanner';
import { AppHeader, Card, FooterInner, Screen, SectionTitle } from '@/components/Layout';
import type { ScreenScrollRef } from '@/components/Layout';
import { OptionItem } from '@/components/OptionItem';
import type { OptionStatus } from '@/components/OptionItem';
import { QuestionSkeleton } from '@/components/QuestionSkeleton';
import { useApp } from '@/context/AppContext';
import {
  ApiError,
  deleteQuestion as deleteQuestionRemote,
  generateQuestion,
  listDocumentQuestions,
} from '@/services/api';
import { DIFFICULTIES } from '@/theme/theme';
import type { Difficulty, Question } from '@/types';
import { OPTION_LETTERS, decodeFileName } from '@/utils/format';
import * as haptics from '@/utils/haptics';

interface AnswerState {
  selected: number | null;
  confirmed: boolean;
}

const normalize = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

function getCorrectIndex(question: Question | null): number {
  if (!question) return -1;
  const target = normalize(question.resposta_correta);
  const idx = question.alternativas.findIndex((a) => normalize(a) === target);
  if (idx >= 0) return idx;
  const letterIdx = OPTION_LETTERS.indexOf(question.resposta_correta.trim().toUpperCase().charAt(0));
  return question.resposta_correta.trim().length === 1 ? letterIdx : -1;
}

function getQuestionKey(q: Question, fallbackIndex: number): string {
  return q.id || q.question_id || `${fallbackIndex}-${q.enunciado.slice(0, 32)}`;
}

export default function QuizScreen() {
  const theme = useTheme();
  const { apiUrl, getAccessToken, updateDocumentQuestionCount } = useApp();
  const { documentId, title } = useLocalSearchParams<{ documentId: string; title?: string }>();
  const scrollRef: ScreenScrollRef = useRef(null);

  const [questions, setQuestions] = useState<Question[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, AnswerState>>({});

  const [loadingList, setLoadingList] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showGenerator, setShowGenerator] = useState(false);

  const [difficulty, setDifficulty] = useState<Difficulty>('medio');
  const [topic, setTopic] = useState('');
  const [error, setError] = useState<{ message: string; network: boolean } | null>(null);

  const loadSavedQuestions = async (silent = false) => {
    if (!documentId) return;
    if (!silent) {
      setLoadingList(true);
      setError(null);
    }
    try {
      const accessToken = await getAccessToken();
      const saved = await listDocumentQuestions(apiUrl, documentId, accessToken);
      setQuestions(saved);
      updateDocumentQuestionCount(documentId, { count: saved.length });
      if (!silent) {
        if (saved.length > 0) {
          setActiveIndex(0);
          setShowGenerator(false);
        } else {
          setShowGenerator(true);
        }
      }
    } catch (e) {
      if (!silent) {
        const apiError = e instanceof ApiError ? e : null;
        setError({
          message: apiError?.message ?? 'Não foi possível carregar as questões deste documento.',
          network: apiError?.kind === 'network',
        });
        setShowGenerator(true);
      }
    } finally {
      if (!silent) setLoadingList(false);
    }
  };

  useEffect(() => {
    if (!documentId) return;
    let cancelled = false;
    (async () => {
      try {
        const accessToken = await getAccessToken();
        const saved = await listDocumentQuestions(apiUrl, documentId, accessToken);
        if (cancelled) return;
        setQuestions(saved);
        updateDocumentQuestionCount(documentId, { count: saved.length });
        if (saved.length > 0) {
          setActiveIndex(0);
          setShowGenerator(false);
        } else {
          setShowGenerator(true);
        }
      } catch (e) {
        if (cancelled) return;
        const apiError = e instanceof ApiError ? e : null;
        setError({
          message: apiError?.message ?? 'Não foi possível carregar as questões deste documento.',
          network: apiError?.kind === 'network',
        });
        setShowGenerator(true);
      } finally {
        if (!cancelled) setLoadingList(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [apiUrl, documentId, getAccessToken, updateDocumentQuestionCount]);

  const activeQuestion = questions[activeIndex] ?? null;
  const activeKey = activeQuestion ? getQuestionKey(activeQuestion, activeIndex) : '';
  const activeAnswer: AnswerState = (activeKey && answers[activeKey]) || {
    selected: null,
    confirmed: false,
  };

  const correctIndex = useMemo(() => getCorrectIndex(activeQuestion), [activeQuestion]);

  const stats = useMemo(() => {
    let total = 0;
    let correct = 0;
    questions.forEach((q, idx) => {
      const key = getQuestionKey(q, idx);
      const ans = answers[key];
      if (ans?.confirmed && ans.selected !== null) {
        total += 1;
        if (ans.selected === getCorrectIndex(q)) correct += 1;
      }
    });
    return { total, correct };
  }, [questions, answers]);

  const selectOption = (optionIndex: number) => {
    if (!activeKey || activeAnswer.confirmed) return;
    setAnswers((prev) => ({
      ...prev,
      [activeKey]: { selected: optionIndex, confirmed: false },
    }));
  };

  const confirmAnswer = () => {
    if (!activeQuestion || !activeKey || activeAnswer.selected === null || activeAnswer.confirmed) return;
    const hit = activeAnswer.selected === correctIndex;
    setAnswers((prev) => ({
      ...prev,
      [activeKey]: { selected: activeAnswer.selected, confirmed: true },
    }));
    if (hit) haptics.success();
    else haptics.error();
  };

  const resetActiveAnswer = () => {
    if (!activeKey) return;
    setAnswers((prev) => {
      const next = { ...prev };
      delete next[activeKey];
      return next;
    });
  };

  const selectQuestionIndex = (idx: number) => {
    if (idx < 0 || idx >= questions.length) return;
    setActiveIndex(idx);
    setShowGenerator(false);
    setError(null);
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  };

  const handleGenerate = async () => {
    if (!documentId || generating) return;
    setGenerating(true);
    setError(null);
    scrollRef.current?.scrollTo({ y: 0, animated: true });
    try {
      const accessToken = await getAccessToken();
      const created = await generateQuestion(
        apiUrl,
        { documentId, nivelDificuldade: difficulty, tema: topic },
        accessToken,
      );

      const nextCount = questions.length + 1;
      setQuestions((prev) => [...prev, created]);
      setActiveIndex(nextCount - 1);
      updateDocumentQuestionCount(documentId, { count: nextCount });
      setShowGenerator(false);
      haptics.success();

      // Se por algum motivo a resposta não trouxe o `id` da questão, sincroniza silenciosamente com o banco
      if (!created.id) {
        loadSavedQuestions(true);
      }
    } catch (e) {
      haptics.error();
      const apiError = e instanceof ApiError ? e : null;
      setError({
        message: apiError?.message ?? 'Não foi possível gerar a questão.',
        network: apiError?.kind === 'network',
      });
    } finally {
      setGenerating(false);
    }
  };

  const executeDeleteQuestion = async (q: Question, indexToDelete: number) => {
    if (!documentId || deletingId) return;
    const qId = q.id || q.question_id;
    if (!qId) {
      setError({
        message: 'Esta questão ainda está sincronizando seu identificador. Atualize a tela e tente novamente.',
        network: false,
      });
      return;
    }

    setDeletingId(qId);
    setError(null);
    try {
      const accessToken = await getAccessToken();
      await deleteQuestionRemote(apiUrl, qId, accessToken);
      haptics.success();

      const next = questions.filter((_, idx) => idx !== indexToDelete);
      setQuestions(next);
      updateDocumentQuestionCount(documentId, { count: next.length });
      if (next.length === 0) {
        setActiveIndex(0);
        setShowGenerator(true);
      } else if (indexToDelete >= next.length) {
        setActiveIndex(next.length - 1);
      }
    } catch (e) {
      haptics.error();
      const apiError = e instanceof ApiError ? e : null;
      setError({
        message: apiError?.message ?? 'Não foi possível apagar a questão.',
        network: apiError?.kind === 'network',
      });
    } finally {
      setDeletingId(null);
    }
  };

  const confirmDeleteQuestion = (q: Question, idx: number) => {
    if (deletingId || generating) return;
    if (Platform.OS === 'web') {
      const ok =
        typeof window !== 'undefined'
          ? window.confirm('Apagar esta questão permanentemente do documento?')
          : true;
      if (ok) executeDeleteQuestion(q, idx);
      return;
    }
    Alert.alert(
      'Apagar questão?',
      'Esta questão será removida permanentemente deste documento.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Apagar',
          style: 'destructive',
          onPress: () => executeDeleteQuestion(q, idx),
        },
      ],
    );
  };

  const statusFor = (index: number): OptionStatus => {
    if (!activeAnswer.confirmed) return index === activeAnswer.selected ? 'selected' : 'idle';
    if (index === correctIndex) return 'correct';
    if (index === activeAnswer.selected) return 'wrong';
    return 'dimmed';
  };

  const isCorrect = activeAnswer.confirmed && activeAnswer.selected === correctIndex;
  const currentDifficulty = DIFFICULTIES.find(
    (d) => d.value === (activeQuestion?.nivel_dificuldade ?? difficulty),
  );
  const hasNextSaved = activeIndex < questions.length - 1;
  const isDeletingActive = Boolean(
    activeQuestion && deletingId && (deletingId === activeQuestion.id || deletingId === activeQuestion.question_id),
  );

  const header = (
    <AppHeader
      title={decodeFileName(title) || 'Questões'}
      subtitle={
        questions.length > 0
          ? `${questions.length} ${questions.length === 1 ? 'questão salva' : 'questões salvas'}`
          : 'Pratique com o documento'
      }
      onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))}
      right={
        stats.total > 0 ? (
          <ScoreChip accessibilityLabel={`${stats.correct} acertos de ${stats.total}`}>
            <Ionicons name="trophy" size={16} color={theme.colors.warning} />
            <ScoreText>
              {stats.correct}/{stats.total}
            </ScoreText>
          </ScoreChip>
        ) : null
      }
    />
  );

  const renderFooter = () => {
    if (loadingList) return null;

    if (showGenerator || !activeQuestion) {
      return (
        <FooterInner>
          <Button
            label={generating ? 'Gerando questão…' : 'Gerar questão com IA'}
            icon="sparkles"
            loading={generating}
            onPress={handleGenerate}
          />
        </FooterInner>
      );
    }

    if (!activeAnswer.confirmed) {
      return (
        <FooterInner>
          <Button
            label="Confirmar resposta"
            icon="checkmark-circle"
            disabled={activeAnswer.selected === null || isDeletingActive}
            onPress={confirmAnswer}
          />
        </FooterInner>
      );
    }

    if (hasNextSaved) {
      return (
        <FooterInner>
          <Button
            label={`Próxima questão (${activeIndex + 2}/${questions.length})`}
            icon="arrow-forward"
            onPress={() => selectQuestionIndex(activeIndex + 1)}
          />
        </FooterInner>
      );
    }

    return (
      <FooterInner>
        <Button
          label="Gerar nova questão"
          icon="sparkles"
          onPress={() => {
            setShowGenerator(true);
            scrollRef.current?.scrollTo({ y: 0, animated: true });
          }}
        />
      </FooterInner>
    );
  };

  return (
    <Screen
      header={header}
      footer={renderFooter()}
      scrollRef={scrollRef}
      refreshing={loadingList && questions.length > 0}
      onRefresh={() => loadSavedQuestions(false)}
    >
      {/* Barra de navegação entre as questões salvas do documento */}
      {questions.length > 0 ? (
        <DeckBar>
          <DeckHeaderRow>
            <SectionTitle>Questões do documento ({questions.length})</SectionTitle>
            <NewQuestionToggle
              $active={showGenerator}
              onPress={() => {
                setShowGenerator((v) => !v);
                setError(null);
              }}
              accessibilityRole="button"
              accessibilityLabel={showGenerator ? 'Voltar para a questão selecionada' : 'Gerar nova questão'}
            >
              <Ionicons
                name={showGenerator ? 'close' : 'add'}
                size={16}
                color={showGenerator ? theme.colors.onPrimary : theme.colors.primary}
              />
              <NewQuestionToggleText $active={showGenerator}>
                {showGenerator ? 'Fechar gerador' : 'Nova questão'}
              </NewQuestionToggleText>
            </NewQuestionToggle>
          </DeckHeaderRow>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8, paddingVertical: 2 }}
          >
            {questions.map((q, idx) => {
              const key = getQuestionKey(q, idx);
              const ans = answers[key];
              const isSelected = !showGenerator && idx === activeIndex;
              const isAnswered = Boolean(ans?.confirmed && ans.selected !== null);
              const isHit = isAnswered && ans.selected === getCorrectIndex(q);

              return (
                <QuestionPill
                  key={key}
                  $active={isSelected}
                  $answered={isAnswered}
                  $correct={isHit}
                  onPress={() => selectQuestionIndex(idx)}
                  accessibilityRole="button"
                  accessibilityLabel={`Questão ${idx + 1}`}
                >
                  <QuestionPillText $active={isSelected} $answered={isAnswered} $correct={isHit}>
                    {idx + 1}
                  </QuestionPillText>
                  {isAnswered ? (
                    <Ionicons
                      name={isHit ? 'checkmark-circle' : 'close-circle'}
                      size={13}
                      color={
                        isSelected
                          ? theme.colors.onPrimary
                          : isHit
                            ? theme.colors.success
                            : theme.colors.danger
                      }
                    />
                  ) : null}
                </QuestionPill>
              );
            })}
          </ScrollView>
        </DeckBar>
      ) : null}

      {/* Estado inicial: buscando questões salvas no banco */}
      {loadingList && questions.length === 0 ? <QuestionSkeleton /> : null}

      {/* Painel de geração de nova questão */}
      {!loadingList && (showGenerator || questions.length === 0) ? (
        <>
          <Card>
            <Row style={{ justifyContent: 'space-between' }}>
              <Row>
                <Ionicons name="sparkles" size={18} color={theme.colors.primary} />
                <SectionTitle>Nova questão com IA</SectionTitle>
              </Row>
              {questions.length > 0 ? (
                <CloseGeneratorLink onPress={() => setShowGenerator(false)} accessibilityRole="button">
                  <CloseGeneratorText>Ver salvas</CloseGeneratorText>
                </CloseGeneratorLink>
              ) : null}
            </Row>

            <SectionTitle style={{ marginTop: 4 }}>Dificuldade</SectionTitle>
            <DifficultySelector value={difficulty} onChange={setDifficulty} disabled={generating} />

            <SectionTitle style={{ marginTop: 4 }}>Tema (opcional)</SectionTitle>
            <TopicInput
              value={topic}
              onChangeText={setTopic}
              placeholder="Ex.: Segurança da informação"
              placeholderTextColor={theme.colors.textMuted}
              returnKeyType="done"
              maxLength={120}
              editable={!generating}
              accessibilityLabel="Tema da questão"
            />
            <Hint>
              Cada questão gerada fica salva automaticamente neste documento para você estudar quando quiser.
            </Hint>
          </Card>

          {generating ? (
            <QuestionSkeleton />
          ) : questions.length === 0 ? (
            <EmptyState>
              <Ionicons name="school-outline" size={44} color={theme.colors.primary} />
              <EmptyTitle>Nenhuma questão salva ainda</EmptyTitle>
              <Hint style={{ textAlign: 'center' }}>
                Escolha a dificuldade acima e toque em “Gerar questão com IA” para criar a primeira questão deste
                documento.
              </Hint>
            </EmptyState>
          ) : null}
        </>
      ) : null}

      {error ? (
        <ErrorBanner
          message={error.message}
          onRetry={showGenerator ? handleGenerate : () => loadSavedQuestions(false)}
          onOpenSettings={error.network ? () => router.push('/settings') : undefined}
        />
      ) : null}

      {/* Visualização da questão ativa */}
      {!loadingList && !showGenerator && activeQuestion ? (
        <View style={{ gap: 16 }}>
          <QuestionTopBar>
            <TagRow style={{ flex: 1 }}>
              <PositionBadge>
                <PositionBadgeText>
                  Questão {activeIndex + 1} de {questions.length}
                </PositionBadgeText>
              </PositionBadge>

              {currentDifficulty ? (
                <Tag>
                  <Ionicons name={currentDifficulty.icon} size={14} color={theme.colors.primary} />
                  <TagText>{currentDifficulty.label}</TagText>
                </Tag>
              ) : null}
            </TagRow>

            <DeleteQuestionButton
              onPress={() => confirmDeleteQuestion(activeQuestion, activeIndex)}
              disabled={isDeletingActive}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Apagar esta questão"
            >
              {isDeletingActive ? (
                <ActivityIndicator size="small" color={theme.colors.danger} />
              ) : (
                <>
                  <Ionicons name="trash-outline" size={16} color={theme.colors.danger} />
                  <DeleteQuestionText>Apagar</DeleteQuestionText>
                </>
              )}
            </DeleteQuestionButton>
          </QuestionTopBar>

          <Statement selectable accessibilityRole="header">
            {activeQuestion.enunciado}
          </Statement>

          <View style={{ gap: 10 }} accessibilityRole="radiogroup">
            {activeQuestion.alternativas.map((alt, i) => (
              <OptionItem
                key={`${i}-${alt}`}
                letter={OPTION_LETTERS[i] ?? String(i + 1)}
                text={alt}
                status={statusFor(i)}
                disabled={activeAnswer.confirmed || isDeletingActive}
                onPress={() => selectOption(i)}
              />
            ))}
          </View>

          {activeAnswer.confirmed ? (
            <View style={{ gap: 12 }}>
              <Result $ok={isCorrect} accessibilityLiveRegion="polite">
                <Ionicons
                  name={isCorrect ? 'happy-outline' : 'sad-outline'}
                  size={26}
                  color={isCorrect ? theme.colors.success : theme.colors.danger}
                />
                <View style={{ flex: 1 }}>
                  <ResultText $ok={isCorrect}>
                    {isCorrect ? 'Resposta correta!' : 'Resposta incorreta'}
                  </ResultText>
                  {!isCorrect && correctIndex >= 0 ? (
                    <CorrectAnswerHint>
                      Alternativa correta: letra {OPTION_LETTERS[correctIndex]}
                    </CorrectAnswerHint>
                  ) : null}
                </View>
                <RetryQuestionButton
                  onPress={resetActiveAnswer}
                  accessibilityRole="button"
                  accessibilityLabel="Responder esta questão novamente"
                >
                  <Ionicons name="refresh" size={16} color={theme.colors.text} />
                  <RetryQuestionText>Refazer</RetryQuestionText>
                </RetryQuestionButton>
              </Result>

              {activeQuestion.comentario ? (
                <Card>
                  <Row>
                    <Ionicons name="bulb-outline" size={20} color={theme.colors.primary} />
                    <SectionTitle>Explicação</SectionTitle>
                  </Row>
                  <Explanation selectable>{activeQuestion.comentario}</Explanation>
                </Card>
              ) : null}
            </View>
          ) : null}

          {questions.length > 1 ? (
            <StepNavRow>
              <StepNavButton
                disabled={activeIndex === 0}
                onPress={() => selectQuestionIndex(activeIndex - 1)}
                accessibilityRole="button"
                accessibilityLabel="Questão anterior"
              >
                <Ionicons
                  name="chevron-back"
                  size={18}
                  color={activeIndex === 0 ? theme.colors.textMuted : theme.colors.text}
                />
                <StepNavText $disabled={activeIndex === 0}>Anterior</StepNavText>
              </StepNavButton>

              <StepNavButton
                disabled={!hasNextSaved}
                onPress={() => selectQuestionIndex(activeIndex + 1)}
                accessibilityRole="button"
                accessibilityLabel="Próxima questão"
              >
                <StepNavText $disabled={!hasNextSaved}>Próxima</StepNavText>
                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={!hasNextSaved ? theme.colors.textMuted : theme.colors.text}
                />
              </StepNavButton>
            </StepNavRow>
          ) : null}
        </View>
      ) : null}
    </Screen>
  );
}

const ScoreChip = styled.View`
  flex-direction: row;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  border-radius: ${({ theme }) => theme.radius.pill}px;
  background-color: ${({ theme }) => theme.colors.warningSoft};
`;

const ScoreText = styled.Text`
  font-size: 14px;
  font-weight: 800;
  color: ${({ theme }) => theme.colors.warning};
`;

const DeckBar = styled.View`
  gap: 10px;
  padding: 14px 16px;
  border-radius: ${({ theme }) => theme.radius.lg}px;
  border-width: 1px;
  border-color: ${({ theme }) => theme.colors.border};
  background-color: ${({ theme }) => theme.colors.surface};
`;

const DeckHeaderRow = styled.View`
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
`;

const NewQuestionToggle = styled.Pressable<{ $active: boolean }>`
  flex-direction: row;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  border-radius: ${({ theme }) => theme.radius.pill}px;
  background-color: ${({ theme, $active }) => ($active ? theme.colors.primary : theme.colors.primarySoft)};
`;

const NewQuestionToggleText = styled.Text<{ $active: boolean }>`
  font-size: 13px;
  font-weight: 700;
  color: ${({ theme, $active }) => ($active ? theme.colors.onPrimary : theme.colors.primary)};
`;

const QuestionPill = styled.Pressable<{ $active: boolean; $answered: boolean; $correct: boolean }>`
  flex-direction: row;
  align-items: center;
  justify-content: center;
  gap: 4px;
  min-width: 42px;
  height: 38px;
  padding: 0 12px;
  border-radius: ${({ theme }) => theme.radius.pill}px;
  border-width: 1.5px;
  border-color: ${({ theme, $active, $answered, $correct }) =>
    $active
      ? theme.colors.primary
      : $answered
        ? $correct
          ? theme.colors.success
          : theme.colors.danger
        : theme.colors.border};
  background-color: ${({ theme, $active, $answered, $correct }) =>
    $active
      ? theme.colors.primary
      : $answered
        ? $correct
          ? theme.colors.successSoft
          : theme.colors.dangerSoft
        : theme.colors.surfaceAlt};
`;

const QuestionPillText = styled.Text<{ $active: boolean; $answered: boolean; $correct: boolean }>`
  font-size: 14px;
  font-weight: 800;
  color: ${({ theme, $active, $answered, $correct }) =>
    $active
      ? theme.colors.onPrimary
      : $answered
        ? $correct
          ? theme.colors.success
          : theme.colors.danger
        : theme.colors.text};
`;

const CloseGeneratorLink = styled.Pressable`
  padding: 4px 8px;
`;

const CloseGeneratorText = styled.Text`
  font-size: 13px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.primary};
`;

const TopicInput = styled.TextInput`
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

const EmptyState = styled.View`
  align-items: center;
  gap: 8px;
  padding: 24px 12px;
`;

const EmptyTitle = styled.Text`
  font-size: 18px;
  font-weight: 800;
  color: ${({ theme }) => theme.colors.text};
`;

const QuestionTopBar = styled.View`
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
`;

const TagRow = styled.View`
  flex-direction: row;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
`;

const PositionBadge = styled.View`
  padding: 6px 12px;
  border-radius: ${({ theme }) => theme.radius.pill}px;
  background-color: ${({ theme }) => theme.colors.surfaceAlt};
`;

const PositionBadgeText = styled.Text`
  font-size: 13px;
  font-weight: 800;
  color: ${({ theme }) => theme.colors.text};
`;

const Tag = styled.View`
  flex-direction: row;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: ${({ theme }) => theme.radius.pill}px;
  background-color: ${({ theme }) => theme.colors.primarySoft};
`;

const TagText = styled.Text`
  font-size: 13px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.primary};
`;

const DeleteQuestionButton = styled.Pressable`
  flex-direction: row;
  align-items: center;
  gap: 5px;
  padding: 6px 12px;
  border-radius: ${({ theme }) => theme.radius.pill}px;
  background-color: ${({ theme }) => theme.colors.dangerSoft};
`;

const DeleteQuestionText = styled.Text`
  font-size: 13px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.danger};
`;

const Statement = styled.Text`
  font-size: 19px;
  line-height: 28px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.text};
`;

const Result = styled.View<{ $ok: boolean }>`
  flex-direction: row;
  align-items: center;
  gap: 10px;
  padding: 14px 16px;
  border-radius: ${({ theme }) => theme.radius.md}px;
  background-color: ${({ theme, $ok }) => ($ok ? theme.colors.successSoft : theme.colors.dangerSoft)};
`;

const ResultText = styled.Text<{ $ok: boolean }>`
  font-size: 17px;
  font-weight: 800;
  color: ${({ theme, $ok }) => ($ok ? theme.colors.success : theme.colors.danger)};
`;

const CorrectAnswerHint = styled.Text`
  font-size: 13px;
  margin-top: 2px;
  color: ${({ theme }) => theme.colors.text};
`;

const RetryQuestionButton = styled.Pressable`
  flex-direction: row;
  align-items: center;
  gap: 4px;
  padding: 6px 10px;
  border-radius: ${({ theme }) => theme.radius.pill}px;
  background-color: ${({ theme }) => theme.colors.surface};
`;

const RetryQuestionText = styled.Text`
  font-size: 12px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.text};
`;

const Row = styled.View`
  flex-direction: row;
  align-items: center;
  gap: 8px;
`;

const Explanation = styled.Text`
  font-size: 16px;
  line-height: 24px;
  color: ${({ theme }) => theme.colors.text};
`;

const StepNavRow = styled.View`
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding-top: 4px;
`;

const StepNavButton = styled.Pressable<{ disabled?: boolean }>`
  flex-direction: row;
  align-items: center;
  gap: 6px;
  padding: 10px 14px;
  border-radius: ${({ theme }) => theme.radius.md}px;
  border-width: 1px;
  border-color: ${({ theme }) => theme.colors.border};
  background-color: ${({ theme }) => theme.colors.surface};
  opacity: ${({ disabled }) => (disabled ? 0.45 : 1)};
`;

const StepNavText = styled.Text<{ $disabled?: boolean }>`
  font-size: 14px;
  font-weight: 700;
  color: ${({ theme, $disabled }) => ($disabled ? theme.colors.textMuted : theme.colors.text)};
`;
