import { useEffect, useState } from 'react';
import { Animated, Easing, Platform, View } from 'react-native';
import styled, { useTheme } from 'styled-components/native';

import { DiscreteSpinner, FadeInView, IndeterminateBar } from '@/components/LoadingPrimitives';

const USE_NATIVE_DRIVER = Platform.OS !== 'web';

const PREPARING_STAGES = [
  {
    title: 'Preparando seu material…',
    hint: 'Estamos deixando tudo pronto para gerar suas questões.',
  },
  {
    title: 'Organizando o conteúdo…',
    hint: 'Ajustando os detalhes finais do seu arquivo.',
  },
  {
    title: 'Quase pronto…',
    hint: 'Arquivos maiores podem levar mais alguns instantes.',
  },
] as const;

interface Props {
  phase: 'uploading' | 'processing';
  progress: number;
}

/**
 * Indicador limpo e amigável para envio e preparação do arquivo,
 * sem expor detalhes técnicos de processamento interno.
 */
export function UploadStatusPanel({ phase, progress }: Props) {
  const theme = useTheme();
  const clamped = Math.min(1, Math.max(0, progress));
  const percent = Math.round(clamped * 100);

  const [trackWidth, setTrackWidth] = useState(0);
  const [prepStage, setPrepStage] = useState(0);
  const [animatedFill] = useState(() => new Animated.Value(clamped));

  useEffect(() => {
    if (phase !== 'uploading') return;
    Animated.timing(animatedFill, {
      toValue: clamped,
      duration: 180,
      easing: Easing.out(Easing.quad),
      useNativeDriver: USE_NATIVE_DRIVER,
    }).start();
  }, [animatedFill, clamped, phase]);

  useEffect(() => {
    if (phase !== 'processing') return;
    const t1 = setTimeout(() => setPrepStage(1), 3500);
    const t2 = setTimeout(() => setPrepStage(2), 7500);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [phase]);

  const translateX = animatedFill.interpolate({
    inputRange: [0, 1],
    outputRange: [-Math.max(trackWidth, 1), 0],
  });

  if (phase === 'uploading') {
    return (
      <FadeInView>
        <Container
          accessibilityRole="progressbar"
          accessibilityLabel="Enviando arquivo"
          accessibilityValue={{ min: 0, max: 100, now: percent }}
        >
          <HeaderRow>
            <TitleGroup>
              <DiscreteSpinner size="sm" />
              <StatusTitle>Enviando arquivo…</StatusTitle>
            </TitleGroup>
            <PercentBadge>
              <PercentText>{percent}%</PercentText>
            </PercentBadge>
          </HeaderRow>

          <Track
            onLayout={(e) => {
              const w = e.nativeEvent.layout.width;
              if (w > 0 && Math.abs(w - trackWidth) > 2) setTrackWidth(w);
            }}
          >
            {trackWidth > 0 ? (
              <Animated.View
                style={{
                  width: '100%',
                  height: '100%',
                  borderRadius: 4,
                  backgroundColor: theme.colors.primary,
                  transform: [{ translateX }],
                }}
              />
            ) : (
              <View
                style={{
                  width: `${percent}%`,
                  height: '100%',
                  borderRadius: 4,
                  backgroundColor: theme.colors.primary,
                }}
              />
            )}
          </Track>

          <StatusHint>Aguarde enquanto transferimos seu material.</StatusHint>
        </Container>
      </FadeInView>
    );
  }

  const currentStage = PREPARING_STAGES[prepStage];

  return (
    <FadeInView>
      <Container accessibilityRole="progressbar" accessibilityLabel={currentStage.title}>
        <HeaderRow>
          <TitleGroup>
            <DiscreteSpinner size="sm" />
            <StatusTitle>{currentStage.title}</StatusTitle>
          </TitleGroup>
        </HeaderRow>

        <IndeterminateBar height={6} />

        <StatusHint>{currentStage.hint}</StatusHint>
      </Container>
    </FadeInView>
  );
}

const Container = styled.View`
  gap: 10px;
  padding: 14px;
  border-radius: ${({ theme }) => theme.radius.md}px;
  border-width: 1px;
  border-color: ${({ theme }) => theme.colors.border};
  background-color: ${({ theme }) => theme.colors.background};
`;

const HeaderRow = styled.View`
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
`;

const TitleGroup = styled.View`
  flex: 1;
  min-width: 0;
  flex-direction: row;
  align-items: center;
  gap: 8px;
`;

const StatusTitle = styled.Text`
  flex-shrink: 1;
  font-size: 14px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.text};
`;

const PercentBadge = styled.View`
  padding: 3px 10px;
  border-radius: ${({ theme }) => theme.radius.pill}px;
  background-color: ${({ theme }) => theme.colors.primarySoft};
`;

const PercentText = styled.Text`
  font-size: 12px;
  font-weight: 800;
  color: ${({ theme }) => theme.colors.primary};
`;

const Track = styled.View`
  width: 100%;
  height: 6px;
  border-radius: 3px;
  overflow: hidden;
  background-color: ${({ theme }) => theme.colors.surfaceAlt};
`;

const StatusHint = styled.Text`
  font-size: 13px;
  line-height: 18px;
  color: ${({ theme }) => theme.colors.textMuted};
`;
