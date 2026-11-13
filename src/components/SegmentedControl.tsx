import styled from 'styled-components/native';

import { tap } from '@/utils/haptics';

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
}

interface Props<T extends string> {
  options: readonly SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
  accessibilityLabel?: string;
}

/** Seleção única entre poucas opções (2–3), com segmentos de mesma largura e texto centralizado. */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  disabled,
  accessibilityLabel,
}: Props<T>) {
  return (
    <Track accessibilityRole="radiogroup" accessibilityLabel={accessibilityLabel}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Segment
            key={option.value}
            $active={active}
            disabled={disabled}
            accessibilityRole="radio"
            accessibilityLabel={option.label}
            accessibilityState={{ selected: active, disabled: !!disabled }}
            onPress={() => {
              if (active) return;
              tap();
              onChange(option.value);
            }}
          >
            <SegmentLabel $active={active} numberOfLines={2}>
              {option.label}
            </SegmentLabel>
          </Segment>
        );
      })}
    </Track>
  );
}

const Track = styled.View`
  flex-direction: row;
  gap: 4px;
  padding: 4px;
  border-radius: ${({ theme }) => theme.radius.md}px;
  border-width: 1px;
  border-color: ${({ theme }) => theme.colors.border};
  background-color: ${({ theme }) => theme.colors.surfaceAlt};
`;

const Segment = styled.Pressable<{ $active: boolean }>`
  flex: 1;
  min-height: 46px;
  padding: 6px 8px;
  align-items: center;
  justify-content: center;
  border-radius: ${({ theme }) => theme.radius.md - 4}px;
  background-color: ${({ theme, $active }) => ($active ? theme.colors.primary : 'transparent')};
  opacity: ${({ disabled }) => (disabled ? 0.5 : 1)};
`;

const SegmentLabel = styled.Text<{ $active: boolean }>`
  font-size: 14px;
  line-height: 18px;
  font-weight: 700;
  text-align: center;
  color: ${({ theme, $active }) => ($active ? theme.colors.onPrimary : theme.colors.text)};
`;

