import { Ionicons } from '@expo/vector-icons';
import { forwardRef, useState } from 'react';
import type { ComponentProps, ComponentRef } from 'react';
import { TextInput, View } from 'react-native';
import styled, { useTheme } from 'styled-components/native';

export const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());

export function AuthHero({
  icon = 'sparkles',
  title,
  subtitle,
}: {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
}) {
  const theme = useTheme();
  return (
    <Hero>
      <Logo>
        <Ionicons name={icon} size={34} color={theme.colors.onPrimary} />
      </Logo>
      <Title accessibilityRole="header">{title}</Title>
      {subtitle ? <Subtitle>{subtitle}</Subtitle> : null}
    </Hero>
  );
}

type InputProps = ComponentProps<typeof TextInput>;
type InputRef = ComponentRef<typeof TextInput>;

interface FieldProps extends InputProps {
  label: string;
  error?: string | null;
}

export const Field = forwardRef<InputRef, FieldProps>(function Field({ label, error, ...props }, ref) {
  const theme = useTheme();
  return (
    <View style={{ gap: 6 }}>
      <Label>{label}</Label>
      <Input
        ref={ref as never}
        placeholderTextColor={theme.colors.textMuted}
        accessibilityLabel={label}
        $error={!!error}
        {...props}
      />
      {error ? <FieldError accessibilityLiveRegion="polite">{error}</FieldError> : null}
    </View>
  );
});

export const PasswordField = forwardRef<InputRef, FieldProps>(function PasswordField(
  { label, error, ...props },
  ref,
) {
  const theme = useTheme();
  const [visible, setVisible] = useState(false);
  return (
    <View style={{ gap: 6 }}>
      <Label>{label}</Label>
      <PasswordRow $error={!!error}>
        <PasswordInput
          ref={ref as never}
          placeholderTextColor={theme.colors.textMuted}
          secureTextEntry={!visible}
          autoCapitalize="none"
          autoCorrect={false}
          accessibilityLabel={label}
          {...props}
        />
        <Toggle
          onPress={() => setVisible((v) => !v)}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={visible ? 'Ocultar senha' : 'Mostrar senha'}
        >
          <Ionicons name={visible ? 'eye-off-outline' : 'eye-outline'} size={22} color={theme.colors.textMuted} />
        </Toggle>
      </PasswordRow>
      {error ? <FieldError accessibilityLiveRegion="polite">{error}</FieldError> : null}
    </View>
  );
});

export function OrDivider() {
  return (
    <DividerRow>
      <Line />
      <DividerText>ou</DividerText>
      <Line />
    </DividerRow>
  );
}

export function LinkButton({
  label,
  onPress,
  align = 'center',
}: {
  label: string;
  onPress: () => void;
  align?: 'center' | 'flex-end';
}) {
  return (
    <LinkWrap onPress={onPress} accessibilityRole="link" accessibilityLabel={label} style={{ alignSelf: align }}>
      <LinkText>{label}</LinkText>
    </LinkWrap>
  );
}

export function FooterLink({ prefix, label, onPress }: { prefix: string; label: string; onPress: () => void }) {
  return (
    <FooterRow>
      <Muted>{prefix}</Muted>
      <LinkButton label={label} onPress={onPress} />
    </FooterRow>
  );
}

const Hero = styled.View`
  align-items: center;
  gap: 10px;
  padding: 16px 0 4px;
`;

const Logo = styled.View`
  width: 72px;
  height: 72px;
  border-radius: 22px;
  align-items: center;
  justify-content: center;
  background-color: ${({ theme }) => theme.colors.primary};
`;

const Title = styled.Text`
  font-size: 26px;
  font-weight: 800;
  text-align: center;
  color: ${({ theme }) => theme.colors.text};
`;

const Subtitle = styled.Text`
  font-size: 15px;
  line-height: 22px;
  text-align: center;
  color: ${({ theme }) => theme.colors.textMuted};
`;

const Label = styled.Text`
  font-size: 13px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.textMuted};
`;

const Input = styled.TextInput<{ $error: boolean }>`
  min-height: 52px;
  padding: 0 14px;
  font-size: 16px;
  border-radius: ${({ theme }) => theme.radius.md}px;
  border-width: 1px;
  border-color: ${({ theme, $error }) => ($error ? theme.colors.danger : theme.colors.border)};
  background-color: ${({ theme }) => theme.colors.surface};
  color: ${({ theme }) => theme.colors.text};
`;

const PasswordRow = styled.View<{ $error: boolean }>`
  flex-direction: row;
  align-items: center;
  border-radius: ${({ theme }) => theme.radius.md}px;
  border-width: 1px;
  border-color: ${({ theme, $error }) => ($error ? theme.colors.danger : theme.colors.border)};
  background-color: ${({ theme }) => theme.colors.surface};
`;

const PasswordInput = styled.TextInput`
  flex: 1;
  min-height: 52px;
  padding: 0 14px;
  font-size: 16px;
  color: ${({ theme }) => theme.colors.text};
`;

const Toggle = styled.Pressable`
  padding: 0 14px;
`;

const FieldError = styled.Text`
  font-size: 13px;
  color: ${({ theme }) => theme.colors.danger};
`;

const DividerRow = styled.View`
  flex-direction: row;
  align-items: center;
  gap: 12px;
`;

const Line = styled.View`
  flex: 1;
  height: 1px;
  background-color: ${({ theme }) => theme.colors.border};
`;

const DividerText = styled.Text`
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textMuted};
`;

const LinkWrap = styled.Pressable`
  padding: 8px 4px;
`;

const LinkText = styled.Text`
  font-size: 15px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.primary};
`;

const FooterRow = styled.View`
  flex-direction: row;
  align-items: center;
  justify-content: center;
  gap: 4px;
`;

const Muted = styled.Text`
  font-size: 15px;
  color: ${({ theme }) => theme.colors.textMuted};
`;
