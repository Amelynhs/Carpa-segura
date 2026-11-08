/**
 * Enlace de las primitivas puras con el hashing NATIVO de expo-crypto.
 * Permitido por el enunciado: «expo-crypto, CryptoKit, javax.crypto.Mac».
 * HMAC, Base32, truncamiento dinámico y TOTP siguen siendo código propio (primitives.ts).
 */
import * as Crypto from 'expo-crypto';
import {
  base64UrlEncode,
  buildCodeChallenge,
  buildCodeVerifier,
  totp,
  totpDebug,
  type HashFn,
} from './primitives';

const digestWith =
  (alg: Crypto.CryptoDigestAlgorithm): HashFn =>
  async (data) =>
    new Uint8Array(await Crypto.digest(alg, data));

export const sha1 = digestWith(Crypto.CryptoDigestAlgorithm.SHA1);
export const sha256 = digestWith(Crypto.CryptoDigestAlgorithm.SHA256);

/** Par PKCE con 64 bytes aleatorios del CSPRNG del sistema operativo. */
export async function createPkcePair() {
  const bytes = await Crypto.getRandomBytesAsync(64);
  const verifier = buildCodeVerifier(bytes);
  const challenge = await buildCodeChallenge(sha256, verifier);
  return { verifier, challenge };
}

/** `state` anti-CSRF único por solicitud (24 bytes → 32 caracteres). */
export async function createState() {
  return base64UrlEncode(await Crypto.getRandomBytesAsync(24));
}

/** TOTP del Authenticator propio. Opera 100 % offline: solo usa el reloj del dispositivo. */
export const generateTotp = (secretBase32: string, nowMs: number = Date.now()) =>
  totp(sha1, secretBase32, nowMs / 1000);

export const explainTotp = (secretBase32: string, nowMs: number = Date.now()) =>
  totpDebug(sha1, secretBase32, nowMs / 1000);
