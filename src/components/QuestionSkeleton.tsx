import { useEffect, useState } from 'react';
import { Animated, Easing } from 'react-native';
import styled from 'styled-components/native';

const MESSAGES = [
  'Buscando trechos relevantes do documento…',
  'Elaborando o enunciado…',
  'Criando alternativas plausíveis…',
  'Revisando a questão…',
];

/** Placeholder pulsante exibido enquanto a IA gera a questão. */
export function QuestionSkeleton() {
  const [pulse] = useState(() => new Animated.Value(0.4));
  const [step, setStep] = useState(0);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.4, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    const timer = setInterval(() => setStep((s) => (s + 1) % MESSAGES.length), 2500);
    return () => {
      loop.stop();
      clearInterval(timer);
    };
  }, [pulse]);

  return (
    <Wrapper accessibilityRole="progressbar" accessibilityLabel="Gerando questão">
      <Status>{MESSAGES[step]}</Status>
      <Animated.View style={{ opacity: pulse, gap: 12 }}>
        <Line style={{ width: '95%' }} />
        <Line style={{ width: '80%' }} />
        <Line style={{ width: '60%' }} />
        <Block />
        <Block />
        <Block />
        <Block />
      </Animated.View>
    </Wrapper>
  );
}

const Wrapper = styled.View`
  gap: 16px;
`;

const Status = styled.Text`
  font-size: 14px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.primary};
  text-align: center;
`;

const Line = styled.View`
  height: 16px;
  border-radius: 8px;
  background-color: ${({ theme }) => theme.colors.skeleton};
`;

const Block = styled.View`
  height: 58px;
  border-radius: ${({ theme }) => theme.radius.md}px;
  background-color: ${({ theme }) => theme.colors.skeleton};
`;

