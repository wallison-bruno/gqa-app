import type { Difficulty } from '@/theme/theme';

export type { Difficulty };

/** Resposta de POST /gerar-questao */
export interface Question {
  document_id: string;
  enunciado: string;
  alternativas: string[];
  /** Texto exato da alternativa correta */
  resposta_correta: string;
  comentario: string;
}

/** Resposta de POST /upload */
export interface UploadResponse {
  document_id: string;
  message: string;
}

/** Arquivo escolhido pelo usuário (já normalizado). */
export interface PickedFile {
  uri: string;
  name: string;
  mimeType: string;
  size?: number;
  /** Apenas web: objeto File nativo do navegador */
  file?: File;
}

/** Documento enviado (guardado localmente para reabrir depois). */
export interface StoredDocument {
  id: string;
  title: string;
  mimeType: string;
  size?: number;
  createdAt: number;
}

export interface SessionStats {
  total: number;
  correct: number;
}

