import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState } from 'react';

import { DIFFICULTIES, EDUCATION_LEVELS, EXAM_BOARDS, QUESTION_TYPES } from '@/theme/theme';
import type { Difficulty, EducationLevel, QuestionType } from '@/types';

/** Configurações usadas para gerar questões (enviadas em POST /gerar-questao). */
export interface GeneratorSettings {
  educationLevel: EducationLevel;
  questionType: QuestionType;
  board: string;
  difficulty: Difficulty;
  topic: string;
}

export const DEFAULT_GENERATOR_SETTINGS: GeneratorSettings = {
  educationLevel: 'superior',
  questionType: 'multipla_escolha',
  board: 'Padrão',
  difficulty: 'medio',
  topic: '',
};

const STORAGE_KEY = '@gqa/generatorSettings';

/** Garante que valores salvos (possivelmente antigos/corrompidos) sejam válidos. */
function sanitize(raw: unknown): GeneratorSettings {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<GeneratorSettings>;
  const d = DEFAULT_GENERATOR_SETTINGS;
  return {
    educationLevel: EDUCATION_LEVELS.some((e) => e.value === r.educationLevel)
      ? (r.educationLevel as EducationLevel)
      : d.educationLevel,
    questionType: QUESTION_TYPES.some((q) => q.value === r.questionType)
      ? (r.questionType as QuestionType)
      : d.questionType,
    board: (EXAM_BOARDS as readonly string[]).includes(r.board ?? '') ? (r.board as string) : d.board,
    difficulty: DIFFICULTIES.some((x) => x.value === r.difficulty) ? (r.difficulty as Difficulty) : d.difficulty,
    topic: typeof r.topic === 'string' ? r.topic.slice(0, 120) : d.topic,
  };
}

/**
 * Configurações do gerador de questões, mantidas durante toda a sessão e salvas no aparelho:
 * não são redefinidas ao gerar novas questões, navegar entre elas ou reabrir o app.
 */
export function useGeneratorSettings() {
  const [settings, setSettings] = useState<GeneratorSettings>(DEFAULT_GENERATOR_SETTINGS);
  const [loaded, setLoaded] = useState(false);
  const latest = useRef<GeneratorSettings>(DEFAULT_GENERATOR_SETTINGS);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (cancelled) return;
        if (raw) {
          try {
            const parsed = sanitize(JSON.parse(raw));
            latest.current = parsed;
            setSettings(parsed);
          } catch {
            // mantém os padrões
          }
        }
        setLoaded(true);
      })
      .catch(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const update = useCallback((patch: Partial<GeneratorSettings>) => {
    const next = { ...latest.current, ...patch };
    latest.current = next;
    setSettings(next);
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
  }, []);

  return { settings, loaded, update };
}

