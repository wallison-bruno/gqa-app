import { Ionicons } from '@expo/vector-icons';
import styled, { useTheme } from 'styled-components/native';

import { DiscreteSpinner } from '@/components/LoadingPrimitives';
import { tap } from '@/utils/haptics';

type Variant = 'primary' | 'secondary' | 'ghost';

interface Props {
  label: string;
  loadingLabel?: string;
  onPress: () => void;
  variant?: Variant;
  icon?: keyof typeof Ionicons.glyphMap;
  loading?: boolean;
  disabled?: boolean;
}

export function Button({ label, loadingLabel, onPress, variant = 'primary', icon, loading, disabled }: Props) {
  const theme = useTheme();
  const inactive = disabled || loading;
  const color = variant === 'primary' ? theme.colors.onPrimary : theme.colors.primary;
  const displayLabel = loading ? (loadingLabel ?? label) : label;

  return (
    <Base
      accessibilityRole="button"
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      accessibilityLabel={displayLabel}
      disabled={inactive}
      $variant={variant}
      $inactive={!!inactive}
      onPress={() => {
        tap();
        onPress();
      }}
    >
      {loading ? (
        <>
          <DiscreteSpinner size="sm" color={color} />
          <Label $color={color} numberOfLines={1}>
            {displayLabel}
          </Label>
        </>
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={20} color={color} /> : null}
          <Label $color={color} numberOfLines={1}>
            {displayLabel}
          </Label>
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
  flex-shrink: 1;
  font-size: 16px;
  font-weight: 700;
  color: ${({ $color }) => $color};
`;

