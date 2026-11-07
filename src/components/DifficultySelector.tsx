import { Ionicons } from '@expo/vector-icons';
import styled, { useTheme } from 'styled-components/native';

import { DIFFICULTIES } from '@/theme/theme';
import type { Difficulty } from '@/theme/theme';
import { tap } from '@/utils/haptics';

interface Props {
  value: Difficulty;
  onChange: (value: Difficulty) => void;
  disabled?: boolean;
}

export function DifficultySelector({ value, onChange, disabled }: Props) {
  const theme = useTheme();
  return (
    <Row accessibilityRole="radiogroup">
      {DIFFICULTIES.map((d) => {
        const active = d.value === value;
        return (
          <Item
            key={d.value}
            $active={active}
            disabled={disabled}
            accessibilityRole="radio"
            accessibilityState={{ selected: active, disabled }}
            accessibilityLabel={`${d.label}: ${d.hint}`}
            onPress={() => {
              tap();
              onChange(d.value);
            }}
          >
            <Ionicons name={d.icon} size={20} color={active ? theme.colors.onPrimary : theme.colors.textMuted} />
            <ItemLabel $active={active}>{d.label}</ItemLabel>
          </Item>
        );
      })}
    </Row>
  );
}

const Row = styled.View`
  flex-direction: row;
  gap: 8px;
`;

const Item = styled.Pressable<{ $active: boolean }>`
  flex: 1;
  align-items: center;
  gap: 4px;
  padding: 12px 8px;
  border-radius: ${({ theme }) => theme.radius.md}px;
  border-width: 1px;
  border-color: ${({ theme, $active }) => ($active ? theme.colors.primary : theme.colors.border)};
  background-color: ${({ theme, $active }) => ($active ? theme.colors.primary : theme.colors.surface)};
  opacity: ${({ disabled }) => (disabled ? 0.5 : 1)};
`;

const ItemLabel = styled.Text<{ $active: boolean }>`
  font-size: 14px;
  font-weight: 700;
  color: ${({ theme, $active }) => ($active ? theme.colors.onPrimary : theme.colors.text)};
`;

