export type Difficulty = 'facil' | 'medio' | 'dificil';

const base = {
  radius: { sm: 10, md: 16, lg: 24, pill: 999 },
  space: (n: number) => n * 4,
};

export const lightTheme = {
  ...base,
  mode: 'light' as 'light' | 'dark',
  colors: {
    background: '#F5F6FB',
    surface: '#FFFFFF',
    surfaceAlt: '#EEF0F9',
    border: '#E2E5F1',
    text: '#12152B',
    textMuted: '#6A7088',
    primary: '#5B5BF0',
    primaryPressed: '#4848D6',
    primarySoft: '#ECECFE',
    onPrimary: '#FFFFFF',
    success: '#16A34A',
    successSoft: '#DCFCE7',
    danger: '#DC2626',
    dangerSoft: '#FEE2E2',
    warning: '#D97706',
    warningSoft: '#FEF3C7',
    shadow: '#1B1F4B',
    skeleton: '#E4E7F3',
  },
};

export type AppTheme = typeof lightTheme;

export const darkTheme: AppTheme = {
  ...base,
  mode: 'dark',
  colors: {
    background: '#0C0E1A',
    surface: '#171A2B',
    surfaceAlt: '#20243A',
    border: '#2B3050',
    text: '#F2F3FA',
    textMuted: '#9AA0BC',
    primary: '#7C7CFF',
    primaryPressed: '#6A6AF0',
    primarySoft: '#25285A',
    onPrimary: '#0C0E1A',
    success: '#4ADE80',
    successSoft: '#12351F',
    danger: '#F87171',
    dangerSoft: '#3D1618',
    warning: '#FBBF24',
    warningSoft: '#3A2D0E',
    shadow: '#000000',
    skeleton: '#252A45',
  },
};

export const DIFFICULTIES: {
  value: Difficulty;
  label: string;
  hint: string;
  icon: 'leaf-outline' | 'flash-outline' | 'flame-outline';
}[] = [
  { value: 'facil', label: 'Fácil', hint: 'Conceitos diretos', icon: 'leaf-outline' },
  { value: 'medio', label: 'Médio', hint: 'Aplicação do conceito', icon: 'flash-outline' },
  { value: 'dificil', label: 'Difícil', hint: 'Estudo de caso', icon: 'flame-outline' },
];

