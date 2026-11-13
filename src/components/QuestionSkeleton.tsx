import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import styled, { useTheme } from 'styled-components/native';

import { DiscreteSpinner, FadeInView, SkeletonBox, SkeletonGroup } from '@/components/LoadingPrimitives';
import type { QuestionType } from '@/types';

const GENERATE_STEPS = [
  'Buscando trechos relevantes do documento…',
  'Contextualizando para a banca e o nível…',
  'Formulando o enunciado e as alternativas…',
  'Validando o gabarito e a explicação…',
];

interface Props {
  mode?: 'generate' | 'fetch';
  questionType?: QuestionType;
  board?: string;
  difficultyLabel?: string;
  educationLabel?: string;
}

/**
 * Placeholder estruturado com shimmer sincronizado.
 * Diferencia visualmente geração por IA (`generate`) de consulta ao banco (`fetch`).
 */
export function QuestionSkeleton({
  mode = 'generate',
  questionType = 'multipla_escolha',
  board,
  difficultyLabel,
  educationLabel,
}: Props) {
  const theme = useTheme();
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (mode !== 'generate') return;
    const timer = setInterval(() => {
      setStep((s) => (s + 1) % GENERATE_STEPS.length);
    }, 2400);
    return () => clearInterval(timer);
  }, [mode]);

  if (mode === 'fetch') {
    return (
      <FadeInView>
        <SkeletonGroup style={{ gap: 16 }}>
          <StatusBanner
            accessibilityRole="progressbar"
            accessibilityLabel="Carregando questões salvas do documento"
          >
            <StatusHeader>
              <StatusTitleGroup>
                <IconChip>
                  <Ionicons name="server-outline" size={16} color={theme.colors.primary} />
                </IconChip>
                <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                  <StatusTitle>Carregando questões salvas…</StatusTitle>
                  <StatusSubtitle>
                    Consultando o histórico deste documento no banco de dados.
                  </StatusSubtitle>
                </View>
              </StatusTitleGroup>
              <DiscreteSpinner size="sm" />
            </StatusHeader>
          </StatusBanner>

          {/* Simulação do DeckBar */}
          <DeckSkeletonCard>
            <RowBetween>
              <SkeletonBox width={156} height={14} />
              <SkeletonBox width={108} height={32} radius={999} />
            </RowBetween>
            <PillStrip>
              {[0, 1, 2, 3, 4].map((idx) => (
                <SkeletonBox key={idx} width={44} height={36} radius={999} />
              ))}
            </PillStrip>
          </DeckSkeletonCard>

          {/* Simulação da questão ativa */}
          <View style={{ gap: 14 }}>
            <PillStrip>
              <SkeletonBox width={118} height={28} radius={999} />
              <SkeletonBox width={88} height={28} radius={999} />
              <SkeletonBox width={76} height={28} radius={999} />
            </PillStrip>

            <View style={{ gap: 10 }}>
              <SkeletonBox width="98%" height={18} />
              <SkeletonBox width="90%" height={18} />
              <SkeletonBox width="64%" height={18} />
            </View>

            <View style={{ gap: 10 }}>
              {[0, 1, 2, 3].map((idx) => (
                <OptionSkeleton key={idx}>
                  <SkeletonBox width={32} height={32} radius={16} />
                  <View style={{ flex: 1, gap: 6 }}>
                    <SkeletonBox width={idx % 2 === 0 ? '88%' : '76%'} height={14} />
                    <SkeletonBox width={idx % 2 === 0 ? '54%' : '62%'} height={14} />
                  </View>
                </OptionSkeleton>
              ))}
            </View>
          </View>
        </SkeletonGroup>
      </FadeInView>
    );
  }

  const contextSummary = [board, educationLabel, difficultyLabel]
    .filter((item): item is string => Boolean(item && item.trim()))
    .join(' · ');
  const optionCount = questionType === 'certo_errado' ? 2 : 5;
  const lineWidths: `${number}%`[] = ['90%', '78%', '86%', '72%', '82%'];

  return (
    <FadeInView>
      <SkeletonGroup style={{ gap: 16 }}>
        <StatusBanner accessibilityRole="progressbar" accessibilityLabel="Gerando questão com IA">
          <StatusHeader>
            <StatusTitleGroup>
              <IconChip>
                <DiscreteSpinner size="sm" />
              </IconChip>
              <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                <StatusTitle>Elaborando questão com IA</StatusTitle>
                <StatusSubtitle>{GENERATE_STEPS[step]}</StatusSubtitle>
              </View>
            </StatusTitleGroup>
            <StepCounter>
              Etapa {step + 1}/{GENERATE_STEPS.length}
            </StepCounter>
          </StatusHeader>

          {contextSummary ? (
            <ContextRow>
              <Ionicons name="sparkles-outline" size={13} color={theme.colors.primary} />
              <ContextText numberOfLines={1} ellipsizeMode="tail">
                {contextSummary}
              </ContextText>
            </ContextRow>
          ) : null}

          <StepBarRow>
            {GENERATE_STEPS.map((label, idx) => (
              <StepBarSegment key={label} $active={idx <= step} />
            ))}
          </StepBarRow>
        </StatusBanner>

        {/* Estrutura espelhada da questão enquanto a IA responde */}
        <View style={{ gap: 14 }}>
          <PillStrip>
            <SkeletonBox width={116} height={28} radius={999} />
            <SkeletonBox width={94} height={28} radius={999} />
            <SkeletonBox width={80} height={28} radius={999} />
          </PillStrip>

          <View style={{ gap: 10 }}>
            <SkeletonBox width="97%" height={18} />
            <SkeletonBox width="91%" height={18} />
            <SkeletonBox width="78%" height={18} />
            <SkeletonBox width="48%" height={18} />
          </View>

          <View style={{ gap: 10 }}>
            {Array.from({ length: optionCount }).map((_, idx) => (
              <OptionSkeleton key={idx}>
                <SkeletonBox width={32} height={32} radius={16} />
                <View style={{ flex: 1, gap: 6 }}>
                  <SkeletonBox width={lineWidths[idx % lineWidths.length]} height={14} />
                  {questionType !== 'certo_errado' ? (
                    <SkeletonBox width={idx % 2 === 0 ? '46%' : '58%'} height={14} />
                  ) : null}
                </View>
              </OptionSkeleton>
            ))}
          </View>
        </View>
      </SkeletonGroup>
    </FadeInView>
  );
}

const StatusBanner = styled.View`
  gap: 12px;
  padding: 16px;
  border-radius: ${({ theme }) => theme.radius.lg}px;
  border-width: 1px;
  border-color: ${({ theme }) => theme.colors.border};
  background-color: ${({ theme }) => theme.colors.surface};
`;

const StatusHeader = styled.View`
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
`;

const StatusTitleGroup = styled.View`
  flex: 1;
  min-width: 0;
  flex-direction: row;
  align-items: center;
  gap: 12px;
`;

const IconChip = styled.View`
  width: 36px;
  height: 36px;
  border-radius: 12px;
  align-items: center;
  justify-content: center;
  background-color: ${({ theme }) => theme.colors.primarySoft};
`;

const StatusTitle = styled.Text`
  font-size: 15px;
  font-weight: 800;
  color: ${({ theme }) => theme.colors.text};
`;

const StatusSubtitle = styled.Text`
  font-size: 13px;
  line-height: 18px;
  color: ${({ theme }) => theme.colors.textMuted};
`;

const StepCounter = styled.Text`
  font-size: 12px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.primary};
`;

const ContextRow = styled.View`
  flex-direction: row;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border-radius: ${({ theme }) => theme.radius.sm}px;
  background-color: ${({ theme }) => theme.colors.surfaceAlt};
`;

const ContextText = styled.Text`
  flex: 1;
  font-size: 12px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.primary};
`;

const StepBarRow = styled.View`
  flex-direction: row;
  gap: 6px;
`;

const StepBarSegment = styled.View<{ $active: boolean }>`
  flex: 1;
  height: 4px;
  border-radius: 2px;
  background-color: ${({ theme, $active }) => ($active ? theme.colors.primary : theme.colors.surfaceAlt)};
`;

const DeckSkeletonCard = styled.View`
  gap: 12px;
  padding: 14px 16px;
  border-radius: ${({ theme }) => theme.radius.lg}px;
  border-width: 1px;
  border-color: ${({ theme }) => theme.colors.border};
  background-color: ${({ theme }) => theme.colors.surface};
`;

const RowBetween = styled.View`
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
`;

const PillStrip = styled.View`
  flex-direction: row;
  flex-wrap: wrap;
  gap: 8px;
`;

const OptionSkeleton = styled.View`
  flex-direction: row;
  align-items: center;
  gap: 12px;
  padding: 14px;
  border-radius: ${({ theme }) => theme.radius.md}px;
  border-width: 1px;
  border-color: ${({ theme }) => theme.colors.border};
  background-color: ${({ theme }) => theme.colors.surface};
`;
