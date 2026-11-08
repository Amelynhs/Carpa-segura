// RFC 6238 en el servidor (usa node:crypto solo para HMAC-SHA1).
import { createHmac } from 'node:crypto';

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32Decode(input) {
  const clean = input.toUpperCase().replace(/[\s=-]/g, '');
  let bits = 0;
  let value = 0;
  const out = [];
  for (const ch of clean) {
    const idx = B32.indexOf(ch);
    if (idx === -1) throw new Error('Base32 inválido');
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

export function hotp(secretBytes, counter, digits = 6) {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const h = createHmac('sha1', secretBytes).update(msg).digest();
  const offset = h[19] & 0x0f;
  const bin =
    ((h[offset] & 0x7f) << 24) |
    ((h[offset + 1] & 0xff) << 16) |
    ((h[offset + 2] & 0xff) << 8) |
    (h[offset + 3] & 0xff);
  return String(bin % 10 ** digits).padStart(digits, '0');
}

export const STEP = 30;

export function totpAt(secretB32, unixSeconds, digits = 6) {
  return hotp(base32Decode(secretB32), Math.floor(unixSeconds / STEP), digits);
}

/**
 * Valida en las tres ventanas (C-1, C, C+1).
 * Devuelve el contador T que coincidió, o null.
 * Comparación en tiempo constante para no filtrar información por timing.
 */
export function matchWindow(secretB32, code, unixSeconds = Date.now() / 1000) {
  const secret = base32Decode(secretB32);
  const c = Math.floor(unixSeconds / STEP);
  let matched = null;
  for (const delta of [-1, 0, 1]) {
    const expected = hotp(secret, c + delta);
    const a = Buffer.from(expected);
    const b = Buffer.from(String(code).padStart(6, '0'));
    if (a.length === b.length && timingSafe(a, b)) matched = c + delta;
  }
  return matched;
}

function timingSafe(a, b) {
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}
