import { SegmentedControl } from '@/components/SegmentedControl';
import { DIFFICULTIES } from '@/theme/theme';
import type { Difficulty } from '@/theme/theme';

interface Props {
  value: Difficulty;
  onChange: (value: Difficulty) => void;
  disabled?: boolean;
}

export function DifficultySelector({ value, onChange, disabled }: Props) {
  return (
    <SegmentedControl
      options={DIFFICULTIES}
      value={value}
      onChange={onChange}
      disabled={disabled}
      accessibilityLabel="Dificuldade"
    />
  );
}
