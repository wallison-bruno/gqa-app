import { Ionicons } from '@expo/vector-icons';
import type { ComponentRef, ReactNode, RefObject } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import styled, { useTheme } from 'styled-components/native';

export type ScreenScrollRef = RefObject<ComponentRef<typeof ScrollView> | null>;

interface ScreenProps {
  children: ReactNode;
  footer?: ReactNode;
  header?: ReactNode;
  scrollRef?: ScreenScrollRef;
}

/** Container padrão: respeita safe-area, rola o conteúdo e fixa um rodapé opcional. */
export function Screen({ children, footer, header, scrollRef }: ScreenProps) {
  const insets = useSafeAreaInsets();
  return (
    <Root style={{ paddingTop: insets.top }}>
      {header}
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{ padding: 20, paddingBottom: 32, gap: 20, flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
      >
        <Content>{children}</Content>
      </ScrollView>
      {footer ? <Footer style={{ paddingBottom: Math.max(insets.bottom, 16) }}>{footer}</Footer> : null}
    </Root>
  );
}

const Root = styled.View`
  flex: 1;
  background-color: ${({ theme }) => theme.colors.background};
`;

const Content = styled.View`
  width: 100%;
  max-width: 640px;
  align-self: center;
  gap: 20px;
`;

const Footer = styled.View`
  padding: 12px 20px 0;
  border-top-width: 1px;
  border-top-color: ${({ theme }) => theme.colors.border};
  background-color: ${({ theme }) => theme.colors.surface};
  align-items: center;
`;

export const FooterInner = styled.View`
  width: 100%;
  max-width: 640px;
  gap: 8px;
`;

export const Card = styled.View`
  background-color: ${({ theme }) => theme.colors.surface};
  border-radius: ${({ theme }) => theme.radius.lg}px;
  padding: 20px;
  border-width: 1px;
  border-color: ${({ theme }) => theme.colors.border};
  gap: 12px;
`;

export const SectionTitle = styled.Text`
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.8px;
  text-transform: uppercase;
  color: ${({ theme }) => theme.colors.textMuted};
`;

interface HeaderProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  right?: ReactNode;
}

export function AppHeader({ title, subtitle, onBack, right }: HeaderProps) {
  const theme = useTheme();
  return (
    <HeaderRow>
      {onBack ? (
        <IconButton onPress={onBack} accessibilityRole="button" accessibilityLabel="Voltar" hitSlop={8}>
          <Ionicons name="chevron-back" size={24} color={theme.colors.text} />
        </IconButton>
      ) : null}
      <View style={{ flex: 1 }}>
        <HeaderTitle numberOfLines={1}>{title}</HeaderTitle>
        {subtitle ? <HeaderSubtitle numberOfLines={1}>{subtitle}</HeaderSubtitle> : null}
      </View>
      {right}
    </HeaderRow>
  );
}

export const IconButton = styled.Pressable`
  width: 44px;
  height: 44px;
  border-radius: 22px;
  align-items: center;
  justify-content: center;
  background-color: ${({ theme }) => theme.colors.surface};
  border-width: 1px;
  border-color: ${({ theme }) => theme.colors.border};
`;

const HeaderRow = styled.View`
  flex-direction: row;
  align-items: center;
  gap: 12px;
  padding: 8px 20px 4px;
`;

const HeaderTitle = styled.Text`
  font-size: 18px;
  font-weight: 800;
  color: ${({ theme }) => theme.colors.text};
`;

const HeaderSubtitle = styled.Text`
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textMuted};
`;
