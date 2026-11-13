import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Platform, ScrollView, View } from 'react-native';
import styled, { useTheme } from 'styled-components/native';

import { Button } from '@/components/Button';
import { ErrorBanner } from '@/components/ErrorBanner';
import { GeneratorSettingsPanel } from '@/components/GeneratorSettingsPanel';
import { AppHeader, Card, FooterInner, Screen, SectionTitle } from '@/components/Layout';
import type { ScreenScrollRef } from '@/components/Layout';
import { DiscreteSpinner, FadeInView } from '@/components/LoadingPrimitives';
import { OptionItem } from '@/components/OptionItem';
import type { OptionStatus } from '@/components/OptionItem';
import { QuestionSkeleton } from '@/components/QuestionSkeleton';
import { useApp } from '@/context/AppContext';
import { useGeneratorSettings } from '@/hooks/useGeneratorSettings';
import {
  ApiError,
  deleteQuestion as deleteQuestionRemote,
  generateQuestion,
  listDocumentQuestions,
} from '@/services/api';
import { DIFFICULTIES, EDUCATION_LEVELS, QUESTION_TYPES } from '@/theme/theme';
import type { Question } from '@/types';
import { OPTION_LETTERS, decodeFileName } from '@/utils/format';
import * as haptics from '@/utils/haptics';

interface AnswerState {
  selected: number | null;
  confirmed: boolean;
}

const stripLeadingLetter = (s: string) => s.replace(/^[A-Fa-f]\s*[)\].:-]\s*/, '').trim();
const normalize = (s: string) => stripLeadingLetter(s).toLowerCase().replace(/\s+/g, ' ');

function isCertoErradoQuestion(question: Question | null): boolean {
  if (!question) return false;
  if (question.tipo === 'certo_errado') return true;
  if (question.alternativas.length !== 2) return false;
  const norms = question.alternativas.map((a) => normalize(a));
  return norms.includes('certo') && norms.includes('errado');
}

function getOptionBadgeLetter(question: Question | null, index: number): string {
  if (question && isCertoErradoQuestion(question)) {
    const norm = normalize(question.alternativas[index] ?? '');
    if (norm.startsWith('certo')) return 'C';
    if (norm.startsWith('errado')) return 'E';
  }
  return OPTION_LETTERS[index] ?? String(index + 1);
}

function getCorrectIndex(question: Question | null): number {
  if (!question) return -1;
  const rawTarget = question.resposta_correta.trim();
  const target = normalize(rawTarget);

  const exactIdx = question.alternativas.findIndex(
    (a) => normalize(a) === target || a.trim().toLowerCase() === rawTarget.toLowerCase(),
  );
  if (exactIdx >= 0) return exactIdx;

  if (isCertoErradoQuestion(question)) {
    if (target === 'c' || target.startsWith('certo')) {
      return question.alternativas.findIndex((a) => normalize(a).startsWith('certo'));
    }
    if (target === 'e' || target.startsWith('errado')) {
      return question.alternativas.findIndex((a) => normalize(a).startsWith('errado'));
    }
  }

  const letterMatch = rawTarget.match(/^([A-Fa-f])(?:$|\s|[)\].:-])/);
  if (letterMatch) {
    const letterIdx = OPTION_LETTERS.indexOf(letterMatch[1].toUpperCase());
    if (letterIdx >= 0 && letterIdx < question.alternativas.length) return letterIdx;
  }
  return -1;
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
  const [manualRefreshing, setManualRefreshing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showGenerator, setShowGenerator] = useState(false);

  // Configurações do gerador: persistem entre gerações, navegação entre questões e reaberturas do app
  const { settings, loaded: settingsLoaded, update: updateSettings } = useGeneratorSettings();
  const { educationLevel, questionType, board: selectedBoard, difficulty, topic } = settings;

  const [error, setError] = useState<{ message: string; network: boolean } | null>(null);
  // Origem do último erro, para o "Tentar novamente" repetir a ação correta
  const [errorSource, setErrorSource] = useState<'load' | 'generate'>('load');

  const loadSavedQuestions = async (silent = false) => {
    if (!documentId) return;
    if (!silent) {
      setLoadingList(true);
      setError(null);
    }
    try {
      const accessToken = await getAccessToken();
      const saved = await listDocumentQuestions(apiUrl, documentId, accessToken);
      setQuestions((prev) => {
        const prevById = new Map(prev.map((item) => [item.id || item.question_id, item]));
        return saved.map((item) => {
          const existing = prevById.get(item.id || item.question_id);
          return existing
            ? {
                ...item,
                banca: item.banca ?? existing.banca,
                escolaridade: item.escolaridade ?? existing.escolaridade,
                tipo: item.tipo ?? existing.tipo,
              }
            : item;
        });
      });
      updateDocumentQuestionCount(documentId, { count: saved.length });
      if (!silent) {
        if (saved.length > 0) {
          setActiveIndex(saved.length - 1);
          setShowGenerator(false);
        } else {
          setShowGenerator(true);
        }
      }
    } catch (e) {
      if (!silent) {
        const apiError = e instanceof ApiError ? e : null;
        setErrorSource('load');
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

  const handlePullRefresh = async () => {
    setManualRefreshing(true);
    try {
      await loadSavedQuestions(false);
    } finally {
      setManualRefreshing(false);
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

  /** Gera uma questão com as configurações atualmente salvas (sem pedir nada de novo ao usuário). */
  const handleGenerate = async () => {
    if (!documentId || generating || !settingsLoaded) return;
    setGenerating(true);
    setError(null);
    setErrorSource('generate');
    scrollRef.current?.scrollTo({ y: 0, animated: true });
    try {
      const accessToken = await getAccessToken();
      const created = await generateQuestion(
        apiUrl,
        {
          documentId,
          dificuldade: difficulty,
          escolaridade: educationLevel,
          tipo: questionType,
          banca: selectedBoard,
          tema: topic,
        },
        accessToken,
      );

      const next = [...questions, created];
      setQuestions(next);
      setActiveIndex(next.length - 1);
      updateDocumentQuestionCount(documentId, { count: next.length });
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
  const currentEducation = EDUCATION_LEVELS.find((e) => e.value === activeQuestion?.escolaridade);
  const isActiveCertoErrado = isCertoErradoQuestion(activeQuestion);
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

    // Enquanto gera (de qualquer lugar da tela), o botão principal mostra o progresso
    if (generating) {
      return (
        <FooterInner>
          <Button label="Gerando questão…" icon="sparkles" loading onPress={handleGenerate} />
        </FooterInner>
      );
    }

    // Painel de configurações aberto (ou documento ainda sem questões)
    if (showGenerator || !activeQuestion) {
      return (
        <FooterInner>
          <Button
            label={questions.length > 0 ? 'Gerar questão com estas configurações' : 'Gerar questão com IA'}
            icon="sparkles"
            disabled={!settingsLoaded}
            onPress={handleGenerate}
          />
          {questions.length > 0 ? (
            <Button
              label="Confirmar configurações"
              variant="secondary"
              icon="checkmark"
              onPress={() => {
                haptics.tap();
                setShowGenerator(false);
              }}
            />
          ) : null}
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

    // Última questão respondida: gera a próxima direto, reaproveitando as configurações salvas
    return (
      <FooterInner>
        <Button label="Gerar nova questão" icon="sparkles" disabled={!settingsLoaded} onPress={handleGenerate} />
      </FooterInner>
    );
  };

  return (
    <Screen
      header={header}
      footer={renderFooter()}
      scrollRef={scrollRef}
      refreshing={manualRefreshing}
      onRefresh={handlePullRefresh}
    >
      {/* Barra de navegação entre as questões salvas do documento */}
      {questions.length > 0 ? (
        <DeckBar>
          <DeckHeaderRow>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 }}>
              <SectionTitle style={{ flexShrink: 1 }}>Questões do documento ({questions.length})</SectionTitle>
              {loadingList ? (
                <SyncBadge accessibilityRole="progressbar" accessibilityLabel="Atualizando questões">
                  <DiscreteSpinner size="sm" />
                  <SyncBadgeText>Sincronizando…</SyncBadgeText>
                </SyncBadge>
              ) : null}
            </View>
            <NewQuestionToggle
              $active={false}
              disabled={generating || !settingsLoaded}
              onPress={() => {
                haptics.tap();
                handleGenerate();
              }}
              accessibilityRole="button"
              accessibilityLabel="Gerar nova questão com as configurações atuais"
            >
              <Ionicons name="add" size={16} color={theme.colors.primary} />
              <NewQuestionToggleText $active={false}>Nova questão</NewQuestionToggleText>
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

      {/* Resumo das configurações em uso + atalho para alterá-las (as novas questões usam estas opções) */}
      {!loadingList && !showGenerator && questions.length > 0 ? (
        <SettingsSummaryCard>
          <SettingsSummaryHeader>
            <SectionTitle>Configurações em uso</SectionTitle>
            <SettingsSummarySubtitle>
              Aplicadas automaticamente ao gerar novas questões.
            </SettingsSummarySubtitle>
          </SettingsSummaryHeader>
          <TagRow>
            <Tag>
              <TagText numberOfLines={1} ellipsizeMode="tail">
                {selectedBoard}
              </TagText>
            </Tag>
            <Tag>
              <TagText numberOfLines={1} ellipsizeMode="tail">
                {EDUCATION_LEVELS.find((e) => e.value === educationLevel)?.label}
              </TagText>
            </Tag>
            <Tag>
              <TagText numberOfLines={1} ellipsizeMode="tail">
                {QUESTION_TYPES.find((t) => t.value === questionType)?.label}
              </TagText>
            </Tag>
            <Tag>
              <TagText numberOfLines={1} ellipsizeMode="tail">
                {DIFFICULTIES.find((d) => d.value === difficulty)?.label}
              </TagText>
            </Tag>
            {topic.trim() ? (
              <Tag>
                <TagText numberOfLines={1} ellipsizeMode="tail">
                  Tema: {topic.trim()}
                </TagText>
              </Tag>
            ) : null}
          </TagRow>
          <Button
            label="Alterar configurações"
            variant="secondary"
            icon="options-outline"
            disabled={generating || !settingsLoaded}
            onPress={() => {
              setError(null);
              setShowGenerator(true);
              scrollRef.current?.scrollTo({ y: 0, animated: true });
            }}
          />
        </SettingsSummaryCard>
      ) : null}

      {/* Estado inicial: buscando questões salvas no banco */}
      {loadingList && questions.length === 0 ? <QuestionSkeleton mode="fetch" /> : null}

      {/* Gerando a partir da visualização (sem abrir o painel) */}
      {generating && !showGenerator ? (
        <QuestionSkeleton
          mode="generate"
          questionType={questionType}
          board={selectedBoard}
          difficultyLabel={DIFFICULTIES.find((d) => d.value === difficulty)?.label}
          educationLabel={EDUCATION_LEVELS.find((e) => e.value === educationLevel)?.label}
        />
      ) : null}

      {/* Painel de configuração e geração de nova questão */}
      {!loadingList && (showGenerator || questions.length === 0) ? (
        <>
          <GeneratorSettingsPanel
            settings={settings}
            onChange={updateSettings}
            disabled={generating || !settingsLoaded}
            hasQuestions={questions.length > 0}
            onClose={() => setShowGenerator(false)}
          />

          {generating ? (
            <QuestionSkeleton
              mode="generate"
              questionType={questionType}
              board={selectedBoard}
              difficultyLabel={DIFFICULTIES.find((d) => d.value === difficulty)?.label}
              educationLabel={EDUCATION_LEVELS.find((e) => e.value === educationLevel)?.label}
            />
          ) : questions.length === 0 ? (
            <FadeInView>
              <EmptyState>
                <Ionicons name="school-outline" size={44} color={theme.colors.primary} />
                <EmptyTitle>Nenhuma questão salva ainda</EmptyTitle>
                <Hint style={{ textAlign: 'center' }}>
                  Configure a escolaridade, a banca e a dificuldade acima e toque em “Gerar questão com IA”.
                </Hint>
              </EmptyState>
            </FadeInView>
          ) : null}
        </>
      ) : null}

      {error ? (
        <ErrorBanner
          message={error.message}
          onRetry={errorSource === 'generate' ? handleGenerate : () => loadSavedQuestions(false)}
          onOpenSettings={error.network ? () => router.push('/settings') : undefined}
        />
      ) : null}

      {/* Visualização da questão ativa */}
      {!loadingList && !showGenerator && activeQuestion && !generating ? (
        <FadeInView key={activeKey} style={{ gap: 16 }}>
          <QuestionTopBar>
            <TagRow style={{ flex: 1, minWidth: 180 }}>
              <PositionBadge>
                <PositionBadgeText numberOfLines={1}>
                  Questão {activeIndex + 1} de {questions.length}
                </PositionBadgeText>
              </PositionBadge>

              {activeQuestion.banca && activeQuestion.banca !== 'Padrão' ? (
                <Tag>
                  <Ionicons name="business-outline" size={13} color={theme.colors.primary} />
                  <TagText numberOfLines={1} ellipsizeMode="tail">
                    {activeQuestion.banca}
                  </TagText>
                </Tag>
              ) : null}

              {currentEducation ? (
                <Tag>
                  <Ionicons name={currentEducation.icon} size={13} color={theme.colors.primary} />
                  <TagText numberOfLines={1}>{currentEducation.label}</TagText>
                </Tag>
              ) : null}

              {currentDifficulty ? (
                <Tag>
                  <Ionicons name={currentDifficulty.icon} size={14} color={theme.colors.primary} />
                  <TagText numberOfLines={1}>{currentDifficulty.label}</TagText>
                </Tag>
              ) : null}

              {isActiveCertoErrado ? (
                <Tag>
                  <Ionicons name="checkmark-done-outline" size={14} color={theme.colors.primary} />
                  <TagText numberOfLines={1}>Certo / Errado</TagText>
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
                <>
                  <DiscreteSpinner size="sm" color={theme.colors.danger} />
                  <DeleteQuestionText>Apagando…</DeleteQuestionText>
                </>
              ) : (
                <>
                  <Ionicons name="trash-outline" size={16} color={theme.colors.danger} />
                  <DeleteQuestionText>Apagar</DeleteQuestionText>
                </>
              )}
            </DeleteQuestionButton>
          </QuestionTopBar>

          <Statement accessibilityRole="header">
            {activeQuestion.enunciado.trim()}
          </Statement>

          <View style={{ gap: 10 }} accessibilityRole="radiogroup">
            {activeQuestion.alternativas.map((alt, i) => (
              <OptionItem
                key={`${i}-${alt}`}
                letter={getOptionBadgeLetter(activeQuestion, i)}
                text={isActiveCertoErrado ? alt.trim() : stripLeadingLetter(alt)}
                status={statusFor(i)}
                disabled={activeAnswer.confirmed || isDeletingActive}
                onPress={() => selectOption(i)}
              />
            ))}
          </View>

          {activeAnswer.confirmed ? (
            <FadeInView style={{ gap: 12 }}>
              <Result $ok={isCorrect} accessibilityLiveRegion="polite">
                <Ionicons
                  name={isCorrect ? 'happy-outline' : 'sad-outline'}
                  size={26}
                  color={isCorrect ? theme.colors.success : theme.colors.danger}
                />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <ResultText $ok={isCorrect}>
                    {isCorrect ? 'Resposta correta!' : 'Resposta incorreta'}
                  </ResultText>
                  {!isCorrect && correctIndex >= 0 ? (
                    <CorrectAnswerHint>
                      {isActiveCertoErrado
                        ? `Gabarito: ${activeQuestion.alternativas[correctIndex]?.trim()}`
                        : `Alternativa correta: letra ${getOptionBadgeLetter(activeQuestion, correctIndex)}`}
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
                  <Explanation>{activeQuestion.comentario.trim()}</Explanation>
                </Card>
              ) : null}
            </FadeInView>
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
        </FadeInView>
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

const SettingsSummaryCard = styled.View`
  gap: 12px;
  padding: 16px;
  border-radius: ${({ theme }) => theme.radius.lg}px;
  border-width: 1px;
  border-color: ${({ theme }) => theme.colors.border};
  background-color: ${({ theme }) => theme.colors.surface};
`;

const SettingsSummaryHeader = styled.View`
  gap: 2px;
`;

const SettingsSummarySubtitle = styled.Text`
  font-size: 13px;
  line-height: 18px;
  color: ${({ theme }) => theme.colors.textMuted};
`;

const DeckHeaderRow = styled.View`
  flex-direction: row;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
`;

const SyncBadge = styled.View`
  flex-direction: row;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: ${({ theme }) => theme.radius.pill}px;
  background-color: ${({ theme }) => theme.colors.surfaceAlt};
`;

const SyncBadgeText = styled.Text`
  font-size: 12px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.primary};
`;

const NewQuestionToggle = styled.Pressable<{ $active: boolean; disabled?: boolean }>`
  flex-direction: row;
  align-items: center;
  min-height: 36px;
  gap: 4px;
  padding: 6px 12px;
  border-radius: ${({ theme }) => theme.radius.pill}px;
  background-color: ${({ theme, $active }) => ($active ? theme.colors.primary : theme.colors.primarySoft)};
  opacity: ${({ disabled }) => (disabled ? 0.5 : 1)};
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
  flex-wrap: wrap;
  align-items: flex-start;
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
  max-width: 100%;
  padding: 6px 12px;
  border-radius: ${({ theme }) => theme.radius.pill}px;
  background-color: ${({ theme }) => theme.colors.surfaceAlt};
`;

const PositionBadgeText = styled.Text`
  flex-shrink: 1;
  font-size: 13px;
  font-weight: 800;
  color: ${({ theme }) => theme.colors.text};
`;

const Tag = styled.View`
  flex-direction: row;
  align-items: center;
  max-width: 100%;
  gap: 6px;
  padding: 6px 12px;
  border-radius: ${({ theme }) => theme.radius.pill}px;
  background-color: ${({ theme }) => theme.colors.primarySoft};
`;

const TagText = styled.Text`
  flex-shrink: 1;
  font-size: 13px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.primary};
`;

const DeleteQuestionButton = styled.Pressable`
  flex-direction: row;
  align-items: center;
  min-height: 36px;
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
  width: 100%;
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
  min-height: 36px;
  gap: 4px;
  padding: 6px 12px;
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
  width: 100%;
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
  flex: 1;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  min-height: 46px;
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
