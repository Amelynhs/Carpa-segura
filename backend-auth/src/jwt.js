// JWT HS256 mínimo, hecho a mano (sin librerías).
import { createHmac, timingSafeEqual } from 'node:crypto';

const b64u = (buf) => Buffer.from(buf).toString('base64url');

export function signJwt(payload, secret, ttlSeconds) {
  const now = Math.floor(Date.now() / 1000);
  const body = { iat: now, exp: now + ttlSeconds, ...payload };
  const head = b64u(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const data = `${head}.${b64u(JSON.stringify(body))}`;
  const sig = createHmac('sha256', secret).update(data).digest('base64url');
  return `${data}.${sig}`;
}

/** Devuelve el payload o lanza Error('invalid' | 'expired'). */
export function verifyJwt(token, secret) {
  const parts = String(token).split('.');
  if (parts.length !== 3) throw new Error('invalid');
  const [h, p, s] = parts;
  const expected = createHmac('sha256', secret).update(`${h}.${p}`).digest();
  const given = Buffer.from(s, 'base64url');
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    throw new Error('invalid');
  }
  const header = JSON.parse(Buffer.from(h, 'base64url').toString());
  if (header.alg !== 'HS256') throw new Error('invalid');
  const payload = JSON.parse(Buffer.from(p, 'base64url').toString());
  if (payload.exp < Math.floor(Date.now() / 1000)) throw new Error('expired');
  return payload;
}
