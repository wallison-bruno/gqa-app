export type Difficulty = 'facil' | 'medio' | 'dificil';
export type EducationLevel = 'medio' | 'superior';
export type QuestionType = 'multipla_escolha' | 'certo_errado';

const base = {
  radius: { sm: 10, md: 16, lg: 24, pill: 999 },
  space: (n: number) => n * 4,
};

export const lightTheme = {
  ...base,
  mode: 'light' as 'light' | 'dark',
  colors: {
    background: '#F8FAFC',
    surface: '#FFFFFF',
    surfaceAlt: '#EFF6FF',
    border: '#E2E8F0',
    text: '#0F172A',
    textMuted: '#64748B',
    primary: '#1D4ED8',
    primaryPressed: '#1E40AF',
    primarySoft: '#DBEAFE',
    onPrimary: '#FFFFFF',
    success: '#16A34A',
    successSoft: '#DCFCE7',
    danger: '#DC2626',
    dangerSoft: '#FEE2E2',
    warning: '#D97706',
    warningSoft: '#FEF3C7',
    shadow: '#1E3A8A',
    skeleton: '#E2E8F0',
  },
};

export type AppTheme = typeof lightTheme;

export const darkTheme: AppTheme = {
  ...base,
  mode: 'dark',
  colors: {
    background: '#0B1120',
    surface: '#111827',
    surfaceAlt: '#1E293B',
    border: '#1E3A5F',
    text: '#F8FAFC',
    textMuted: '#94A3B8',
    primary: '#3B82F6',
    primaryPressed: '#1D4ED8',
    primarySoft: '#1E3A8A',
    onPrimary: '#FFFFFF',
    success: '#4ADE80',
    successSoft: '#12351F',
    danger: '#F87171',
    dangerSoft: '#3D1618',
    warning: '#FBBF24',
    warningSoft: '#3A2D0E',
    shadow: '#000000',
    skeleton: '#1E293B',
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

export const EDUCATION_LEVELS: {
  value: EducationLevel;
  label: string;
  hint: string;
  icon: 'school-outline' | 'ribbon-outline';
}[] = [
  { value: 'medio', label: 'Nível Médio', hint: 'Ensino médio / Técnico', icon: 'school-outline' },
  { value: 'superior', label: 'Nível Superior', hint: 'Graduação / Analista', icon: 'ribbon-outline' },
];

export const QUESTION_TYPES: {
  value: QuestionType;
  label: string;
  hint: string;
  icon: 'list-outline' | 'checkmark-done-outline';
}[] = [
  { value: 'multipla_escolha', label: 'Múltipla Escolha', hint: '5 alternativas (A–E)', icon: 'list-outline' },
  { value: 'certo_errado', label: 'Certo ou Errado', hint: '2 opções (C / E)', icon: 'checkmark-done-outline' },
];

export const EXAM_BOARDS = [
  'Padrão',
  'CEBRASPE',
  'FGV',
  'FCC',
  'Fundação Cesgranrio',
  'VUNESP',
  'Instituto AOCP',
  'IBFC',
  'IDECAN',
  'CONSULPLAN',
  'Consulpam',
  'IBADE',
  'SELECON',
  'FUNDEP',
  'IMPAX',
  'CEV',
  'NUCEPE',
  'COSEAC / UFF',
  'CPCON / UEPB',
  'COPESE / UFT',
  'COPEVE / UFAL',
  'COPS / UEL',
  'PR-4 / UFRJ',
  'FADENOR',
  'COTEC',
  'FUNCAB',
  'CEPUERJ',
  'FAPETEC',
  'IBAM',
  'OBJETIVA Concursos',
  'CETREDE',
  'CETAP',
  'IGEDUC',
  'ISCON',
  'CONSESP',
  'RBO',
  'ADM&TEC',
  'EXATUS',
] as const;

export const FEATURED_EXAM_BOARDS = [
  'Padrão',
  'CEBRASPE',
  'FGV',
  'FCC',
  'Fundação Cesgranrio',
  'VUNESP',
  'Instituto AOCP',
  'IBFC',
] as const;
