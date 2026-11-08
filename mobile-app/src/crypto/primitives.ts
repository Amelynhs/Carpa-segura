/**
 * Primitivas criptográficas PURAS (sin dependencias, sin I/O).
 * Todo el Authenticator (RFC 6238) y el generador PKCE (RFC 7636) se construyen aquí.
 * El único insumo externo es una función de hash (SHA-1 / SHA-256) que se inyecta:
 * en la app viene de expo-crypto (nativo); en las pruebas viene de node:crypto.
 */

export type HashFn = (data: Uint8Array) => Promise<Uint8Array>;

/* ────────────────────────── Base32 (RFC 4648) ────────────────────────── */

const B32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32Decode(input: string): Uint8Array {
  const clean = input.toUpperCase().replace(/[\s=-]/g, '');
  if (clean.length === 0) throw new Error('La semilla está vacía');
  const out: number[] = [];
  let bits = 0;
  let value = 0;
  for (const ch of clean) {
    const idx = B32_ALPHABET.indexOf(ch);
    if (idx === -1) throw new Error(`Carácter Base32 inválido: "${ch}"`);
    value = ((value << 5) | idx) & 0xffff;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Uint8Array.from(out);
}

export function isValidBase32(input: string): boolean {
  const clean = input.toUpperCase().replace(/[\s=-]/g, '');
  return clean.length >= 16 && /^[A-Z2-7]+$/.test(clean);
}

/* ────────────────────────── Base64URL (sin relleno) ────────────────────────── */

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

export function base64UrlEncode(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    out += B64[(n >>> 18) & 63] + B64[(n >>> 12) & 63];
    if (i + 1 < bytes.length) out += B64[(n >>> 6) & 63];
    if (i + 2 < bytes.length) out += B64[n & 63];
  }
  return out; // sin '=' (unpadded)
}

export const utf8 = (s: string): Uint8Array => new TextEncoder().encode(s);

/* ────────────────────────── HMAC (RFC 2104) sobre un hash inyectado ────────────────────────── */

const SHA1_BLOCK = 64;

export async function hmac(hash: HashFn, key: Uint8Array, message: Uint8Array): Promise<Uint8Array> {
  let k = key;
  if (k.length > SHA1_BLOCK) k = await hash(k);
  const padded = new Uint8Array(SHA1_BLOCK);
  padded.set(k);

  const ipad = new Uint8Array(SHA1_BLOCK + message.length);
  const opad = new Uint8Array(SHA1_BLOCK + 20);
  for (let i = 0; i < SHA1_BLOCK; i++) {
    ipad[i] = padded[i] ^ 0x36;
    opad[i] = padded[i] ^ 0x5c;
  }
  ipad.set(message, SHA1_BLOCK);
  opad.set(await hash(ipad), SHA1_BLOCK);
  return hash(opad);
}

/* ────────────────────────── HOTP / TOTP (RFC 4226 / RFC 6238) ────────────────────────── */

export const TOTP_STEP_SECONDS = 30;

/** Ventana T = floor(UnixTime / 30). */
export const timeCounter = (unixSeconds: number, step = TOTP_STEP_SECONDS): number =>
  Math.floor(unixSeconds / step);

/** T como entero de 64 bits Big-Endian (buffer de 8 bytes). */
export function counterToBytes(counter: number): Uint8Array {
  const buf = new Uint8Array(8);
  const hi = Math.floor(counter / 0x100000000);
  const lo = counter >>> 0;
  new DataView(buf.buffer).setUint32(0, hi, false);
  new DataView(buf.buffer).setUint32(4, lo, false);
  return buf;
}

/** Truncamiento dinámico → código de `digits` cifras con ceros a la izquierda. */
export function dynamicTruncate(h: Uint8Array, digits = 6): string {
  const offset = h[19] & 0x0f;
  const binCode =
    ((h[offset] & 0x7f) << 24) |
    ((h[offset + 1] & 0xff) << 16) |
    ((h[offset + 2] & 0xff) << 8) |
    (h[offset + 3] & 0xff);
  return String(binCode % 10 ** digits).padStart(digits, '0');
}

export async function totp(
  sha1: HashFn,
  secretBase32: string,
  unixSeconds: number,
  digits = 6,
): Promise<string> {
  const key = base32Decode(secretBase32);
  const T = counterToBytes(timeCounter(unixSeconds));
  const H = await hmac(sha1, key, T); // HMAC-SHA1(secret, T)
  return dynamicTruncate(H, digits);
}

export interface TotpDebug {
  counter: number;
  counterHex: string;
  hmacHex: string;
  offset: number;
  binCode: number;
  code: string;
}

/** Igual que totp(), pero expone cada paso intermedio (para la pantalla «Rayos X»). */
export async function totpDebug(sha1: HashFn, secretBase32: string, unixSeconds: number): Promise<TotpDebug> {
  const counter = timeCounter(unixSeconds);
  const T = counterToBytes(counter);
  const H = await hmac(sha1, base32Decode(secretBase32), T);
  const offset = H[19] & 0x0f;
  const binCode =
    (((H[offset] & 0x7f) << 24) | ((H[offset + 1] & 0xff) << 16) | ((H[offset + 2] & 0xff) << 8) | (H[offset + 3] & 0xff)) >>> 0;
  const hex = (b: Uint8Array) => [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return { counter, counterHex: hex(T), hmacHex: hex(H), offset, binCode, code: String(binCode % 1_000_000).padStart(6, '0') };
}

/** Segundos que le quedan al código actual (30 → 1). */
export const secondsRemaining = (unixSeconds: number, step = TOTP_STEP_SECONDS): number =>
  step - (Math.floor(unixSeconds) % step);

/* ────────────────────────── URI otpauth:// ────────────────────────── */

export interface OtpAuthAccount {
  issuer: string;
  label: string;
  secret: string;
}

export function parseOtpAuthUri(uri: string): OtpAuthAccount {
  const m = /^otpauth:\/\/totp\/([^?]*)\?(.*)$/i.exec(uri.trim());
  if (!m) throw new Error('No es un código otpauth://totp válido');
  const params = new Map<string, string>();
  for (const part of m[2].split('&')) {
    const [k, v = ''] = part.split('=');
    params.set(decodeURIComponent(k), decodeURIComponent(v.replace(/\+/g, ' ')));
  }
  const secret = params.get('secret');
  if (!secret || !isValidBase32(secret)) throw new Error('El QR no trae una semilla Base32 válida');
  const rawLabel = decodeURIComponent(m[1]);
  const [maybeIssuer, ...rest] = rawLabel.split(':');
  const issuer = params.get('issuer') ?? (rest.length ? maybeIssuer : 'Cuenta');
  const label = (rest.length ? rest.join(':') : maybeIssuer).trim();
  return { issuer, label, secret: secret.toUpperCase().replace(/[\s=-]/g, '') };
}

/* ────────────────────────── PKCE (RFC 7636) ────────────────────────── */

/** code_verifier: base64url de 64 bytes aleatorios → 86 caracteres URL-safe (rango 43–128). */
export function buildCodeVerifier(randomBytes64: Uint8Array): string {
  return base64UrlEncode(randomBytes64);
}

/** code_challenge = BASE64URL(SHA256(ASCII(code_verifier))), sin relleno. */
export async function buildCodeChallenge(sha256: HashFn, verifier: string): Promise<string> {
  return base64UrlEncode(await sha256(utf8(verifier)));
}

export const isValidVerifier = (v: string): boolean => /^[A-Za-z0-9\-._~]{43,128}$/.test(v);
