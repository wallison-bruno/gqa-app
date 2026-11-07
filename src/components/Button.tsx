import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator } from 'react-native';
import styled, { useTheme } from 'styled-components/native';

import { tap } from '@/utils/haptics';

type Variant = 'primary' | 'secondary' | 'ghost';

interface Props {
  label: string;
  onPress: () => void;
  variant?: Variant;
  icon?: keyof typeof Ionicons.glyphMap;
  loading?: boolean;
  disabled?: boolean;
}

export function Button({ label, onPress, variant = 'primary', icon, loading, disabled }: Props) {
  const theme = useTheme();
  const inactive = disabled || loading;
  const color = variant === 'primary' ? theme.colors.onPrimary : theme.colors.primary;

  return (
    <Base
      accessibilityRole="button"
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      accessibilityLabel={label}
      disabled={inactive}
      $variant={variant}
      $inactive={!!inactive}
      onPress={() => {
        tap();
        onPress();
      }}
    >
      {loading ? (
        <ActivityIndicator color={color} />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={20} color={color} /> : null}
          <Label $color={color}>{label}</Label>
        </>
      )}
    </Base>
  );
}

const Base = styled.Pressable<{ $variant: Variant; $inactive: boolean }>`
  min-height: 54px;
  border-radius: ${({ theme }) => theme.radius.md}px;
  padding: 0 20px;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  gap: 8px;
  opacity: ${({ $inactive }) => ($inactive ? 0.5 : 1)};
  background-color: ${({ theme, $variant }) =>
    $variant === 'primary'
      ? theme.colors.primary
      : $variant === 'secondary'
        ? theme.colors.primarySoft
        : 'transparent'};
`;

const Label = styled.Text<{ $color: string }>`
  font-size: 16px;
  font-weight: 700;
  color: ${({ $color }) => $color};
`;

