import { Ionicons } from '@expo/vector-icons';
import styled, { useTheme } from 'styled-components/native';

import { tap } from '@/utils/haptics';

export type OptionStatus = 'idle' | 'selected' | 'correct' | 'wrong' | 'dimmed';

interface Props {
  letter: string;
  text: string;
  status: OptionStatus;
  disabled?: boolean;
  onPress: () => void;
}

export function OptionItem({ letter, text, status, disabled, onPress }: Props) {
  const theme = useTheme();
  const iconName = status === 'correct' ? 'checkmark' : status === 'wrong' ? 'close' : null;
  const iconColor = status === 'correct' ? theme.colors.success : theme.colors.danger;

  return (
    <Box
      $status={status}
      disabled={disabled}
      accessibilityRole="radio"
      accessibilityState={{ selected: status === 'selected', disabled }}
      accessibilityLabel={`Alternativa ${letter}: ${text}`}
      onPress={() => {
        tap();
        onPress();
      }}
    >
      <Badge $status={status}>
        {iconName ? (
          <Ionicons name={iconName} size={18} color="#FFFFFF" />
        ) : (
          <BadgeText $status={status}>{letter}</BadgeText>
        )}
      </Badge>
      <Text $status={status}>{text}</Text>
      {iconName ? <Ionicons name={status === 'correct' ? 'checkmark-circle' : 'close-circle'} size={22} color={iconColor} /> : null}
    </Box>
  );
}

const borderColor = (theme: import('styled-components/native').DefaultTheme, s: OptionStatus) =>
  s === 'selected'
    ? theme.colors.primary
    : s === 'correct'
      ? theme.colors.success
      : s === 'wrong'
        ? theme.colors.danger
        : theme.colors.border;

const Box = styled.Pressable<{ $status: OptionStatus }>`
  flex-direction: row;
  align-items: center;
  gap: 12px;
  padding: 14px;
  border-radius: ${({ theme }) => theme.radius.md}px;
  border-width: 2px;
  border-color: ${({ theme, $status }) => borderColor(theme, $status)};
  opacity: ${({ $status }) => ($status === 'dimmed' ? 0.55 : 1)};
  background-color: ${({ theme, $status }) =>
    $status === 'selected'
      ? theme.colors.primarySoft
      : $status === 'correct'
        ? theme.colors.successSoft
        : $status === 'wrong'
          ? theme.colors.dangerSoft
          : theme.colors.surface};
`;

const Badge = styled.View<{ $status: OptionStatus }>`
  width: 32px;
  height: 32px;
  border-radius: 16px;
  align-items: center;
  justify-content: center;
  background-color: ${({ theme, $status }) =>
    $status === 'selected'
      ? theme.colors.primary
      : $status === 'correct'
        ? theme.colors.success
        : $status === 'wrong'
          ? theme.colors.danger
          : theme.colors.surfaceAlt};
`;

const BadgeText = styled.Text<{ $status: OptionStatus }>`
  font-size: 14px;
  font-weight: 800;
  color: ${({ theme, $status }) => ($status === 'selected' ? theme.colors.onPrimary : theme.colors.textMuted)};
`;

const Text = styled.Text<{ $status: OptionStatus }>`
  flex: 1;
  font-size: 16px;
  line-height: 22px;
  font-weight: ${({ $status }) => ($status === 'correct' || $status === 'selected' ? '600' : '400')};
  color: ${({ theme }) => theme.colors.text};
`;

