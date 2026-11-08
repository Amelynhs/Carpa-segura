// Ejecutar: npm test   (Node ≥ 22.6 con --experimental-strip-types)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash, createHmac, randomBytes } from 'node:crypto';
import {
  base32Decode,
  base64UrlEncode,
  buildCodeChallenge,
  buildCodeVerifier,
  counterToBytes,
  hmac,
  isValidVerifier,
  parseOtpAuthUri,
  secondsRemaining,
  totp,
  type HashFn,
} from '../src/crypto/primitives.ts';

const sha1: HashFn = async (d) => new Uint8Array(createHash('sha1').update(d).digest());
const sha256: HashFn = async (d) => new Uint8Array(createHash('sha256').update(d).digest());

// Semilla del Apéndice B de RFC 6238: ASCII "12345678901234567890"
const RFC_SECRET = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';

test('Base32 (RFC 4648): "MZXW6YTBOI======" → "foobar"', () => {
  assert.equal(Buffer.from(base32Decode('MZXW6YTBOI======')).toString(), 'foobar');
  assert.equal(Buffer.from(base32Decode('mzxw 6ytb-oi')).toString(), 'foobar');
  assert.throws(() => base32Decode('1NVAL1D'));
});

test('HMAC construido a mano == HMAC de node:crypto (claves cortas, de bloque y largas)', async () => {
  for (const len of [1, 20, 64, 65, 130]) {
    const key = randomBytes(len);
    const msg = randomBytes(37);
    const mine = await hmac(sha1, new Uint8Array(key), new Uint8Array(msg));
    const ref = createHmac('sha1', key).update(msg).digest();
    assert.deepEqual(Buffer.from(mine), ref, `clave de ${len} bytes`);
  }
});

test('contador T en 8 bytes Big-Endian', () => {
  assert.deepEqual([...counterToBytes(1)], [0, 0, 0, 0, 0, 0, 0, 1]);
  assert.deepEqual([...counterToBytes(0x0123456789)], [0, 0, 0, 1, 0x23, 0x45, 0x67, 0x89]);
});

// Vectores oficiales de RFC 6238 (SHA-1). 8 dígitos y sus últimos 6.
const VECTORS: [number, string][] = [
  [59, '94287082'],
  [1111111109, '07081804'],
  [1111111111, '14050471'],
  [1234567890, '89005924'],
  [2000000000, '69279037'],
  [20000000000, '65353130'],
];

test('TOTP: vectores oficiales RFC 6238 (8 dígitos)', async () => {
  for (const [t, expected] of VECTORS) assert.equal(await totp(sha1, RFC_SECRET, t, 8), expected, `t=${t}`);
});

test('TOTP: 6 dígitos = últimos 6 del vector y con ceros a la izquierda', async () => {
  for (const [t, expected] of VECTORS) assert.equal(await totp(sha1, RFC_SECRET, t, 6), expected.slice(-6));
  assert.equal((await totp(sha1, RFC_SECRET, 1111111109, 6)).length, 6); // 081804 conserva el 0
});

test('TOTP: el código es estable dentro de la ventana de 30 s y cambia en el límite', async () => {
  const a = await totp(sha1, 'JBSWY3DPEHPK3PXP', 1_700_000_010);
  const b = await totp(sha1, 'JBSWY3DPEHPK3PXP', 1_700_000_039);
  const c = await totp(sha1, 'JBSWY3DPEHPK3PXP', 1_700_000_040);
  assert.equal(a, b);
  assert.notEqual(b, c);
});

test('Temporizador: 30 → 1 y nunca 0', () => {
  assert.equal(secondsRemaining(60), 30);
  assert.equal(secondsRemaining(89), 1);
  assert.equal(secondsRemaining(90), 30);
});

test('Paridad app ↔ backend: ambos calculan el mismo código', async () => {
  const { totpAt } = await import('../../backend-auth/src/totp.js');
  for (let i = 0; i < 25; i++) {
    const t = 1_700_000_000 + i * 977;
    assert.equal(await totp(sha1, 'JBSWY3DPEHPK3PXP', t), totpAt('JBSWY3DPEHPK3PXP', t));
  }
});

test('otpauth:// del enunciado se interpreta correctamente', () => {
  const acc = parseOtpAuthUri(
    'otpauth://totp/UniSabana:estudiante@unisabana.edu.co?secret=JBSWY3DPEHPK3PXP&issuer=UniSabana',
  );
  assert.deepEqual(acc, { issuer: 'UniSabana', label: 'estudiante@unisabana.edu.co', secret: 'JBSWY3DPEHPK3PXP' });
  assert.throws(() => parseOtpAuthUri('https://ejemplo.com'));
  assert.throws(() => parseOtpAuthUri('otpauth://totp/x?secret=12'));
});

test('PKCE: vector del Apéndice B de RFC 7636', async () => {
  const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
  assert.equal(await buildCodeChallenge(sha256, verifier), 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
});

test('PKCE: verifier generado cumple 43–128 y es URL-safe; base64url no tiene relleno', () => {
  for (let i = 0; i < 50; i++) {
    const v = buildCodeVerifier(new Uint8Array(randomBytes(64)));
    assert.ok(isValidVerifier(v), v);
    assert.ok(v.length >= 43 && v.length <= 128);
  }
  assert.equal(base64UrlEncode(new Uint8Array([251, 255])), '-_8'); // '+/' → '-_' y sin '='
});

test('totpDebug expone los pasos y coincide con totp()', async () => {
  const { totpDebug } = await import('../src/crypto/primitives.ts');
  const d = await totpDebug(sha1, RFC_SECRET, 59);
  assert.equal(d.counter, 1);
  assert.equal(d.counterHex, '0000000000000001');
  assert.equal(d.hmacHex.length, 40);
  assert.equal(d.code, '287082');
  assert.equal(d.binCode % 1_000_000, 287082);
});
