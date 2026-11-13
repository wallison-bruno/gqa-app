import { Ionicons } from '@expo/vector-icons';
import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Animated, Easing, Platform, View } from 'react-native';
import type { DimensionValue, StyleProp, ViewStyle } from 'react-native';
import styled, { useTheme } from 'styled-components/native';

const USE_NATIVE_DRIVER = Platform.OS !== 'web';

// ---------------------------------------------------------------------------
// Transição suave de entrada (sucesso / conteúdo / erro)
// ---------------------------------------------------------------------------

interface FadeInViewProps {
  children: ReactNode;
  delay?: number;
  offset?: number;
  style?: StyleProp<ViewStyle>;
}

/** Suaviza a entrada de blocos recém-carregados, alertas de erro ou banners de resultado. */
export function FadeInView({ children, delay = 0, offset = 6, style }: FadeInViewProps) {
  const [opacity] = useState(() => new Animated.Value(0));
  const [translateY] = useState(() => new Animated.Value(offset));

  useEffect(() => {
    const anim = Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 240,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 240,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
    ]);
    anim.start();
    return () => anim.stop();
  }, [delay, opacity, translateY]);

  return (
    <Animated.View style={[{ opacity, transform: [{ translateY }] }, style]}>
      {children}
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Indicador giratório moderno e discreto
// ---------------------------------------------------------------------------

type SpinnerSize = 'sm' | 'md' | 'lg';

const SPINNER_METRICS: Record<SpinnerSize, { box: number; stroke: number }> = {
  sm: { box: 16, stroke: 2 },
  md: { box: 22, stroke: 2.5 },
  lg: { box: 32, stroke: 3 },
};

interface DiscreteSpinnerProps {
  size?: SpinnerSize;
  color?: string;
  accessibilityLabel?: string;
}

/** Anel rotativo minimalista de espessura uniforme e movimento contínuo. */
export function DiscreteSpinner({ size = 'md', color, accessibilityLabel }: DiscreteSpinnerProps) {
  const theme = useTheme();
  const activeColor = color ?? theme.colors.primary;
  const { box, stroke } = SPINNER_METRICS[size];
  const [spin] = useState(() => new Animated.Value(0));

  useEffect(() => {
    spin.setValue(0);
    const loop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 850,
        easing: Easing.linear,
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [spin]);

  const rotate = spin.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const radius = box / 2;

  return (
    <View
      style={{ width: box, height: box, alignItems: 'center', justifyContent: 'center' }}
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
    >
      <View
        style={{
          position: 'absolute',
          width: box,
          height: box,
          borderRadius: radius,
          borderWidth: stroke,
          borderColor: activeColor,
          opacity: 0.2,
        }}
      />
      <Animated.View
        style={{
          width: box,
          height: box,
          borderRadius: radius,
          borderWidth: stroke,
          borderColor: 'transparent',
          borderTopColor: activeColor,
          borderRightColor: activeColor,
          transform: [{ rotate }],
        }}
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Skeleton sincronizado com brilho horizontal sutil (shimmer)
// ---------------------------------------------------------------------------

const ShimmerContext = createContext<Animated.Value | null>(null);

function useShimmerDriver() {
  const [shimmer] = useState(() => new Animated.Value(0));

  useEffect(() => {
    shimmer.setValue(0);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, {
          toValue: 1,
          duration: 1350,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.delay(220),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [shimmer]);

  return shimmer;
}

/** Compartilha um único driver de animação entre vários blocos de Skeleton da mesma área. */
export function SkeletonGroup({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const shimmer = useShimmerDriver();
  return (
    <ShimmerContext.Provider value={shimmer}>
      <View style={style}>{children}</View>
    </ShimmerContext.Provider>
  );
}

interface SkeletonBoxProps {
  width?: DimensionValue;
  height: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}

/** Superfície de Skeleton com varredura suave de brilho e adaptação automática a tema claro/escuro. */
export function SkeletonBox({ width = '100%', height, radius, style }: SkeletonBoxProps) {
  const theme = useTheme();
  const sharedShimmer = useContext(ShimmerContext);
  const [localShimmer] = useState(() => new Animated.Value(0));
  const [boxWidth, setBoxWidth] = useState(0);

  useEffect(() => {
    if (sharedShimmer) return;
    localShimmer.setValue(0);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(localShimmer, {
          toValue: 1,
          duration: 1350,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.delay(220),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [localShimmer, sharedShimmer]);

  const driver = sharedShimmer ?? localShimmer;
  const effectiveRadius = radius ?? Math.min(theme.radius.sm, Math.round(height / 2));
  const bandWidth = Math.max(68, Math.round(boxWidth * 0.55));
  const translateX = driver.interpolate({
    inputRange: [0, 1],
    outputRange: [-bandWidth, Math.max(boxWidth, 160) + 16],
  });

  const outerAlpha = theme.mode === 'dark' ? 'rgba(255, 255, 255, 0.04)' : 'rgba(255, 255, 255, 0.35)';
  const centerAlpha = theme.mode === 'dark' ? 'rgba(255, 255, 255, 0.09)' : 'rgba(255, 255, 255, 0.65)';

  return (
    <View
      onLayout={(e) => {
        const nextWidth = e.nativeEvent.layout.width;
        if (nextWidth > 0 && Math.abs(nextWidth - boxWidth) > 2) {
          setBoxWidth(nextWidth);
        }
      }}
      style={[
        {
          width,
          height,
          borderRadius: effectiveRadius,
          backgroundColor: theme.colors.skeleton,
          overflow: 'hidden',
        },
        style,
      ]}
    >
      {boxWidth > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            width: bandWidth,
            backgroundColor: outerAlpha,
            alignItems: 'center',
            justifyContent: 'center',
            transform: [{ translateX }],
          }}
        >
          <View style={{ width: '48%', height: '100%', backgroundColor: centerAlpha }} />
        </Animated.View>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Barra indeterminada discreta (para processamentos sem porcentagem exata)
// ---------------------------------------------------------------------------

/** Barra de progresso contínua para operações de banco ou indexação no servidor. */
export function IndeterminateBar({ height = 6, color }: { height?: number; color?: string }) {
  const theme = useTheme();
  const activeColor = color ?? theme.colors.primary;
  const [trackWidth, setTrackWidth] = useState(0);
  const [travel] = useState(() => new Animated.Value(0));

  useEffect(() => {
    travel.setValue(0);
    const loop = Animated.loop(
      Animated.timing(travel, {
        toValue: 1,
        duration: 1400,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [travel]);

  const segmentWidth = Math.max(56, Math.round(trackWidth * 0.38));
  const translateX = travel.interpolate({
    inputRange: [0, 1],
    outputRange: [-segmentWidth, Math.max(trackWidth, 120)],
  });

  return (
    <View
      onLayout={(e) => {
        const w = e.nativeEvent.layout.width;
        if (w > 0 && Math.abs(w - trackWidth) > 2) setTrackWidth(w);
      }}
      style={{
        width: '100%',
        height,
        borderRadius: height / 2,
        backgroundColor: theme.colors.surfaceAlt,
        overflow: 'hidden',
      }}
      accessibilityRole="progressbar"
    >
      {trackWidth > 0 ? (
        <Animated.View
          style={{
            width: segmentWidth,
            height: '100%',
            borderRadius: height / 2,
            backgroundColor: activeColor,
            transform: [{ translateX }],
          }}
        />
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Card de carregamento centralizado (verificações de link, OAuth e conta)
// ---------------------------------------------------------------------------

interface StatusLoadingCardProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  badgeText?: string;
}

/** Estado de carregamento elegante e informativo para fluxos de autenticação e validação. */
export function StatusLoadingCard({ icon, title, subtitle, badgeText }: StatusLoadingCardProps) {
  const theme = useTheme();
  const [haloScale] = useState(() => new Animated.Value(1));
  const [haloOpacity] = useState(() => new Animated.Value(0.35));

  useEffect(() => {
    const loop = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(haloScale, {
            toValue: 1.14,
            duration: 1100,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: USE_NATIVE_DRIVER,
          }),
          Animated.timing(haloScale, {
            toValue: 1,
            duration: 1100,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: USE_NATIVE_DRIVER,
          }),
        ]),
        Animated.sequence([
          Animated.timing(haloOpacity, {
            toValue: 0.12,
            duration: 1100,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: USE_NATIVE_DRIVER,
          }),
          Animated.timing(haloOpacity, {
            toValue: 0.35,
            duration: 1100,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: USE_NATIVE_DRIVER,
          }),
        ]),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [haloOpacity, haloScale]);

  return (
    <FadeInView>
      <StatusWrap>
        <StatusCard>
          <IconHaloGroup>
            <Animated.View
              style={{
                position: 'absolute',
                width: 84,
                height: 84,
                borderRadius: 42,
                backgroundColor: theme.colors.primary,
                opacity: haloOpacity,
                transform: [{ scale: haloScale }],
              }}
            />
            <IconCircle>
              <Ionicons name={icon} size={32} color={theme.colors.primary} />
            </IconCircle>
          </IconHaloGroup>

          {badgeText ? (
            <StatusBadge>
              <DiscreteSpinner size="sm" />
              <StatusBadgeText>{badgeText}</StatusBadgeText>
            </StatusBadge>
          ) : (
            <DiscreteSpinner size="md" accessibilityLabel={title} />
          )}

          <View style={{ gap: 6, alignItems: 'center' }}>
            <StatusTitle>{title}</StatusTitle>
            <StatusSubtitle>{subtitle}</StatusSubtitle>
          </View>

          <IndeterminateBar height={5} />
        </StatusCard>
      </StatusWrap>
    </FadeInView>
  );
}

const StatusWrap = styled.View`
  padding: 40px 0;
  justify-content: center;
`;

const StatusCard = styled.View`
  align-items: center;
  gap: 18px;
  padding: 28px 22px;
  border-radius: ${({ theme }) => theme.radius.lg}px;
  border-width: 1px;
  border-color: ${({ theme }) => theme.colors.border};
  background-color: ${({ theme }) => theme.colors.surface};
`;

const IconHaloGroup = styled.View`
  width: 84px;
  height: 84px;
  align-items: center;
  justify-content: center;
`;

const IconCircle = styled.View`
  width: 66px;
  height: 66px;
  border-radius: 33px;
  align-items: center;
  justify-content: center;
  background-color: ${({ theme }) => theme.colors.primarySoft};
`;

const StatusBadge = styled.View`
  flex-direction: row;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  border-radius: ${({ theme }) => theme.radius.pill}px;
  background-color: ${({ theme }) => theme.colors.surfaceAlt};
`;

const StatusBadgeText = styled.Text`
  font-size: 13px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.primary};
`;

const StatusTitle = styled.Text`
  font-size: 20px;
  font-weight: 800;
  text-align: center;
  color: ${({ theme }) => theme.colors.text};
`;

const StatusSubtitle = styled.Text`
  font-size: 14px;
  line-height: 21px;
  text-align: center;
  color: ${({ theme }) => theme.colors.textMuted};
`;
