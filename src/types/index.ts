import type { Difficulty, EducationLevel, QuestionType } from '@/theme/theme';

export type { Difficulty, EducationLevel, QuestionType };

/** Parâmetros enviados para POST /gerar-questao */
export interface GenerateQuestionParams {
  documentId: string;
  dificuldade: Difficulty;
  escolaridade: EducationLevel;
  tipo: QuestionType;
  banca: string;
  tema?: string;
}

/** Questão retornada por POST /gerar-questao ou GET /documentos/:documentId/questoes */
export interface Question {
  id: string;
  question_id?: string;
  document_id: string;
  enunciado: string;
  alternativas: string[];
  /** Texto exato da alternativa correta */
  resposta_correta: string;
  nivel_dificuldade?: Difficulty;
  escolaridade?: EducationLevel;
  tipo?: QuestionType;
  banca?: string;
  comentario: string;
  created_at?: string;
}

/** Resposta de POST /upload */
export interface UploadResponse {
  document_id: string;
  message: string;
}

/** Resposta de DELETE /documentos/:documentId */
export interface DeleteDocumentResponse {
  message: string;
  document_id: string;
}

/** Resposta de DELETE /questoes/:questaoId */
export interface DeleteQuestionResponse {
  message: string;
  question_id: string;
  document_id?: string;
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

/** Documento do usuário (vindo de GET /documentos ou recém-enviado). */
export interface StoredDocument {
  id: string;
  title: string;
  mimeType: string;
  size?: number;
  createdAt: number;
  status?: string;
  questionCount?: number;
}

export interface SessionStats {
  total: number;
  correct: number;
}
