import * as DocumentPicker from 'expo-document-picker';

import type { PickedFile } from '@/types';

export const MAX_FILE_MB = 15;

const MIME_BY_EXTENSION: Record<string, string> = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  txt: 'text/plain',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  bmp: 'image/bmp',
};

export const SUPPORTED_LABEL = 'PDF, DOCX, TXT ou imagem (PNG, JPG, WEBP)';

export function resolveMimeType(name: string, mimeType?: string | null): string | null {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  // O servidor só entende os MIME types exatos; a extensão é mais confiável que "octet-stream".
  if (MIME_BY_EXTENSION[ext]) return MIME_BY_EXTENSION[ext];
  if (mimeType && Object.values(MIME_BY_EXTENSION).includes(mimeType)) return mimeType;
  return null;
}

export class FilePickError extends Error {}

/** Abre o seletor de documentos e valida o arquivo. Retorna null se o usuário cancelar. */
export async function pickDocument(): Promise<PickedFile | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: '*/*',
    copyToCacheDirectory: true,
    multiple: false,
  });

  if (result.canceled || !result.assets?.length) return null;

  const asset = result.assets[0];
  const mimeType = resolveMimeType(asset.name, asset.mimeType);
  if (!mimeType) {
    throw new FilePickError(`Formato não suportado. Envie ${SUPPORTED_LABEL}.`);
  }
  if (asset.size && asset.size > MAX_FILE_MB * 1024 * 1024) {
    throw new FilePickError(`O arquivo excede o limite de ${MAX_FILE_MB} MB.`);
  }

  return {
    uri: asset.uri,
    name: asset.name,
    mimeType,
    size: asset.size,
    file: asset.file,
  };
}

export function fileIcon(mimeType: string): 'document-text' | 'document' | 'image' {
  if (mimeType === 'application/pdf') return 'document-text';
  if (mimeType.startsWith('image/')) return 'image';
  return 'document';
}

