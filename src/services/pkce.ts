import * as Crypto from 'expo-crypto';

export interface PkcePair {
  verifier: string;
  challenge: string;
}

function toBase64Url(base64: string): string {
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Gera o par PKCE (RFC 7636, método S256) usado nos fluxos Google, confirmação de e-mail e recuperação de senha. */
export async function createPkcePair(): Promise<PkcePair> {
  const bytes = Crypto.getRandomBytes(48);
  const verifier = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  const digest = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, verifier, {
    encoding: Crypto.CryptoEncoding.BASE64,
  });
  return { verifier, challenge: toBase64Url(digest) };
}

