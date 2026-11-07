import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
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
import { ApiError, generateQuestion } from '@/services/api';
import { DIFFICULTIES } from '@/theme/theme';
import type { Difficulty, Question, SessionStats } from '@/types';
import { OPTION_LETTERS } from '@/utils/format';
import * as haptics from '@/utils/haptics';

type Phase = 'idle' | 'loading' | 'answering' | 'answered' | 'error';

const normalize = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

export default function QuizScreen() {
  const theme = useTheme();
  const { apiUrl, getAccessToken } = useApp();
  const { documentId, title } = useLocalSearchParams<{ documentId: string; title?: string }>();
  const scrollRef: ScreenScrollRef = useRef(null);

  const [difficulty, setDifficulty] = useState<Difficulty>('medio');
  const [topic, setTopic] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  const [question, setQuestion] = useState<Question | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [stats, setStats] = useState<SessionStats>({ total: 0, correct: 0 });
  const [error, setError] = useState<{ message: string; network: boolean } | null>(null);
  // Parâmetros usados na questão atual (a UI pode ser alterada antes da próxima)
  const [current, setCurrent] = useState<{ difficulty: Difficulty; topic: string } | null>(null);

  const correctIndex = useMemo(() => {
    if (!question) return -1;
    const target = normalize(question.resposta_correta);
    const idx = question.alternativas.findIndex((a) => normalize(a) === target);
    if (idx >= 0) return idx;
    // Fallback: a resposta pode vir como letra ("A", "B"...)
    const letterIdx = OPTION_LETTERS.indexOf(question.resposta_correta.trim().toUpperCase().charAt(0));
    return question.resposta_correta.trim().length === 1 ? letterIdx : -1;
  }, [question]);

  const fetchQuestion = useCallback(async () => {
    if (!documentId) return;
    setPhase('loading');
    setError(null);
    setSelected(null);
    scrollRef.current?.scrollTo({ y: 0, animated: true });
    try {
      const accessToken = await getAccessToken();
      const q = await generateQuestion(
        apiUrl,
        { documentId, nivelDificuldade: difficulty, tema: topic },
        accessToken,
      );
      setQuestion(q);
      setCurrent({ difficulty, topic: topic.trim() });
      setPhase('answering');
    } catch (e) {
      haptics.error();
      const apiError = e instanceof ApiError ? e : null;
      setError({
        message: apiError?.message ?? 'Não foi possível gerar a questão.',
        network: apiError?.kind === 'network',
      });
      setPhase('error');
    }
  }, [apiUrl, documentId, difficulty, topic, getAccessToken]);

  const confirmAnswer = useCallback(() => {
    if (selected === null || !question) return;
    const hit = selected === correctIndex;
    setStats((s) => ({ total: s.total + 1, correct: s.correct + (hit ? 1 : 0) }));
    setPhase('answered');
    if (hit) haptics.success();
    else haptics.error();
  }, [selected, question, correctIndex]);

  const statusFor = (index: number): OptionStatus => {
    if (phase !== 'answered') return index === selected ? 'selected' : 'idle';
    if (index === correctIndex) return 'correct';
    if (index === selected) return 'wrong';
    return 'dimmed';
  };

  const isCorrect = phase === 'answered' && selected === correctIndex;
  const showConfig = phase === 'idle' || phase === 'answered' || phase === 'error';
  const currentDifficulty = DIFFICULTIES.find((d) => d.value === current?.difficulty);

  const header = (
    <AppHeader
      title={title || 'Questões'}
      subtitle={stats.total > 0 ? `${stats.total} ${stats.total === 1 ? 'respondida' : 'respondidas'}` : 'Pratique com o documento'}
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

  const footer = (
    <FooterInner>
      {phase === 'answering' ? (
        <Button label="Confirmar resposta" icon="checkmark-circle" disabled={selected === null} onPress={confirmAnswer} />
      ) : phase === 'answered' ? (
        <Button label="Próxima questão" icon="arrow-forward" onPress={fetchQuestion} />
      ) : (
        <Button
          label={phase === 'loading' ? 'Gerando questão…' : phase === 'error' ? 'Tentar novamente' : 'Gerar questão'}
          icon="sparkles"
          loading={phase === 'loading'}
          onPress={fetchQuestion}
        />
      )}
    </FooterInner>
  );

  return (
    <Screen header={header} footer={footer} scrollRef={scrollRef}>
      {showConfig ? (
        <Card>
          <SectionTitle>Dificuldade</SectionTitle>
          <DifficultySelector value={difficulty} onChange={setDifficulty} />
          <SectionTitle style={{ marginTop: 4 }}>Tema (opcional)</SectionTitle>
          <TopicInput
            value={topic}
            onChangeText={setTopic}
            placeholder="Ex.: Segurança da informação"
            placeholderTextColor={theme.colors.textMuted}
            returnKeyType="done"
            maxLength={120}
            accessibilityLabel="Tema da questão"
          />
          <Hint>Deixe em branco para sortear trechos variados do documento.</Hint>
        </Card>
      ) : null}

      {phase === 'idle' && !question ? (
        <EmptyState>
          <Ionicons name="school-outline" size={44} color={theme.colors.primary} />
          <EmptyTitle>Tudo pronto para praticar</EmptyTitle>
          <Hint style={{ textAlign: 'center' }}>
            Escolha a dificuldade e toque em “Gerar questão”. Cada questão é criada a partir do seu documento.
          </Hint>
        </EmptyState>
      ) : null}

      {phase === 'loading' ? <QuestionSkeleton /> : null}

      {phase === 'error' && error ? (
        <ErrorBanner
          message={error.message}
          onOpenSettings={error.network ? () => router.push('/settings') : undefined}
        />
      ) : null}

      {question && (phase === 'answering' || phase === 'answered') ? (
        <View style={{ gap: 16 }}>
          <TagRow>
            {currentDifficulty ? (
              <Tag>
                <Ionicons name={currentDifficulty.icon} size={14} color={theme.colors.primary} />
                <TagText>{currentDifficulty.label}</TagText>
              </Tag>
            ) : null}
            {current?.topic ? (
              <Tag>
                <Ionicons name="pricetag-outline" size={14} color={theme.colors.primary} />
                <TagText numberOfLines={1}>{current.topic}</TagText>
              </Tag>
            ) : null}
          </TagRow>

          <Statement selectable accessibilityRole="header">
            {question.enunciado}
          </Statement>

          <View style={{ gap: 10 }} accessibilityRole="radiogroup">
            {question.alternativas.map((alt, i) => (
              <OptionItem
                key={`${i}-${alt}`}
                letter={OPTION_LETTERS[i] ?? String(i + 1)}
                text={alt}
                status={statusFor(i)}
                disabled={phase === 'answered'}
                onPress={() => setSelected(i)}
              />
            ))}
          </View>

          {phase === 'answered' ? (
            <View style={{ gap: 12 }}>
              <Result $ok={isCorrect} accessibilityLiveRegion="polite">
                <Ionicons
                  name={isCorrect ? 'happy-outline' : 'sad-outline'}
                  size={26}
                  color={isCorrect ? theme.colors.success : theme.colors.danger}
                />
                <ResultText $ok={isCorrect}>{isCorrect ? 'Resposta correta!' : 'Resposta incorreta'}</ResultText>
              </Result>

              {!isCorrect && correctIndex >= 0 ? (
                <Hint>
                  A alternativa correta é a letra {OPTION_LETTERS[correctIndex]}.
                </Hint>
              ) : null}

              {question.comentario ? (
                <Card>
                  <Row>
                    <Ionicons name="bulb-outline" size={20} color={theme.colors.primary} />
                    <SectionTitle>Explicação</SectionTitle>
                  </Row>
                  <Explanation selectable>{question.comentario}</Explanation>
                </Card>
              ) : null}
            </View>
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

const TagRow = styled.View`
  flex-direction: row;
  flex-wrap: wrap;
  gap: 8px;
`;

const Tag = styled.View`
  flex-direction: row;
  align-items: center;
  gap: 6px;
  max-width: 70%;
  padding: 6px 12px;
  border-radius: ${({ theme }) => theme.radius.pill}px;
  background-color: ${({ theme }) => theme.colors.primarySoft};
`;

const TagText = styled.Text`
  font-size: 13px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.primary};
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
