// Backend de autenticación del laboratorio (Sesión 14).
// Sin dependencias externas: node:http + node:crypto.
import { createServer } from 'node:http';
import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { signJwt, verifyJwt } from './jwt.js';
import { matchWindow } from './totp.js';
import { bridgePage, loginPage, notFoundPage, setupPage } from './pages.js';

// ───────────────────────── Configuración ─────────────────────────
export const CONFIG = {
  port: Number(process.env.PORT ?? 4000),
  jwtSecret: process.env.JWT_SECRET ?? randomBytes(32).toString('hex'),
  clientId: 'unisabana-mobile',
  // Esquemas permitidos para el deep link. exp:// permite Expo Go en desarrollo.
  redirectPrefixes: (process.env.ALLOWED_REDIRECTS ?? 'unisabana-auth://,exp://').split(','),
  user: {
    sub: 'u_estudiante',
    email: process.env.DEMO_USER ?? 'estudiante@unisabana.edu.co',
    password: process.env.DEMO_PASSWORD ?? 'Sabana2026!',
  },
  totpSecret: process.env.TOTP_SECRET ?? 'JBSWY3DPEHPK3PXP',
  issuer: 'UniSabana',
  accessTtl: 5 * 60, // 5 min
  refreshTtl: 30 * 24 * 60 * 60, // 30 días
  elevatedTtl: 10 * 60, // 10 min
  stepUpTtl: 5 * 60,
  codeTtl: 120,
  replayTtlMs: 90 * 1000, // TTL del caché Anti-Replay
  maxMfaFailures: 5,
};

// ───────────────────────── Almacenes en memoria ─────────────────────────
const authCodes = new Map(); // code -> { challenge, redirectUri, sub, exp }
const codeByState = new Map(); // state -> { code, challenge, exp }  (entrega por sondeo, Expo Go)
const refreshTokens = new Map(); // sha256(token) -> { sub, family, exp, used }
const revokedFamilies = new Set();
const replayCache = new Map(); // `${sub}:${code}` -> expiresAtMs
const mfaFailures = new Map(); // sub -> { count, resetAt }

const sha256b64u = (s) => createHash('sha256').update(s).digest('base64url');
const sweep = (map, now = Date.now(), field = (v) => v) => {
  for (const [k, v] of map) if (field(v) <= now) map.delete(k);
};

// ───────────────────────── Utilidades HTTP ─────────────────────────
function send(res, status, body, headers = {}) {
  const isObj = typeof body === 'object' && body !== null;
  res.writeHead(status, {
    'Content-Type': isObj ? 'application/json; charset=utf-8' : 'text/html; charset=utf-8',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    ...headers,
  });
  res.end(isObj ? JSON.stringify(body) : body);
}

async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const c of req) {
    size += c.length;
    if (size > 64 * 1024) throw Object.assign(new Error('too_large'), { status: 413 });
    chunks.push(c);
  }
  const raw = Buffer.concat(chunks).toString();
  if (!raw) return {};
  const type = req.headers['content-type'] ?? '';
  if (type.includes('application/json')) return JSON.parse(raw);
  return Object.fromEntries(new URLSearchParams(raw));
}

function bearer(req) {
  const h = req.headers.authorization ?? '';
  return h.startsWith('Bearer ') ? h.slice(7) : null;
}

/** Devuelve el payload del access token, o responde 401 y devuelve null. */
function requireAccess(req, res) {
  const token = bearer(req);
  if (!token) return send(res, 401, { error: 'unauthorized', message: 'Falta el access_token' }), null;
  try {
    const p = verifyJwt(token, CONFIG.jwtSecret);
    if (p.typ !== 'access') throw new Error('invalid');
    return p;
  } catch (e) {
    return send(res, 401, { error: e.message === 'expired' ? 'token_expired' : 'invalid_token' }), null;
  }
}

const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

// ───────────────────────── Emisión de tokens ─────────────────────────
function issueSession(sub, family = randomUUID()) {
  const accessToken = signJwt({ typ: 'access', sub, mfa_verified: false }, CONFIG.jwtSecret, CONFIG.accessTtl);
  const refreshToken = randomBytes(48).toString('base64url');
  refreshTokens.set(sha256b64u(refreshToken), {
    sub,
    family,
    exp: Date.now() + CONFIG.refreshTtl * 1000,
    used: false,
  });
  return {
    token_type: 'Bearer',
    access_token: accessToken,
    expires_in: CONFIG.accessTtl,
    refresh_token: refreshToken,
    refresh_expires_in: CONFIG.refreshTtl,
  };
}

// ───────────────────────── Rutas ─────────────────────────
async function handle(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const path = url.pathname;

  if (req.method === 'OPTIONS') return send(res, 204, '');
  if (req.method === 'GET' && path === '/health') return send(res, 200, { ok: true });

  // ── GET /oauth/authorize → página de login en el navegador del sistema
  if (req.method === 'GET' && path === '/oauth/authorize') {
    const q = Object.fromEntries(url.searchParams);
    const problem = validateAuthorize(q);
    if (problem) return send(res, 400, { error: 'invalid_request', message: problem });
    return send(res, 200, loginPage(q));
  }

  // ── POST /oauth/login → valida credenciales, emite code y redirige por deep link
  if (req.method === 'POST' && path === '/oauth/login') {
    const f = await readBody(req);
    const problem = validateAuthorize(f);
    if (problem) return send(res, 400, { error: 'invalid_request', message: problem });
    const ok =
      f.username === CONFIG.user.email && safeEqual(String(f.password ?? ''), CONFIG.user.password);
    if (!ok) return send(res, 401, loginPage(f, 'Correo o contraseña incorrectos 🙈'));
    const code = randomBytes(24).toString('base64url');
    authCodes.set(code, {
      challenge: f.code_challenge,
      redirectUri: f.redirect_uri,
      sub: CONFIG.user.sub,
      exp: Date.now() + CONFIG.codeTtl * 1000,
    });
    const target = new URL(f.redirect_uri);
    target.searchParams.set('code', code);
    target.searchParams.set('state', f.state);
    codeByState.set(f.state, { code, challenge: f.code_challenge, exp: Date.now() + CONFIG.codeTtl * 1000 });
    log('🔑 authorization_code emitido');
    return send(res, 200, bridgePage(target.href));
  }

  // ── POST /oauth/poll → la app recupera el code SIN deep link (Expo Go no puede registrar un esquema propio).
  //    Sigue siendo PKCE: solo lo entrega a quien demuestre el code_verifier, y es de un solo uso.
  if (req.method === 'POST' && path === '/oauth/poll') {
    const b = await readBody(req);
    sweep(codeByState, Date.now(), (v) => v.exp);
    const e = codeByState.get(String(b.state ?? ''));
    if (!e) return send(res, 202, { status: 'pending' });
    const v = String(b.code_verifier ?? '');
    if (!/^[A-Za-z0-9\-._~]{43,128}$/.test(v) || !safeEqual(sha256b64u(v), e.challenge)) {
      return send(res, 400, { error: 'invalid_request', message: 'PKCE: code_verifier no coincide' });
    }
    codeByState.delete(b.state);
    log('📮 code entregado por sondeo (PKCE verificado)');
    return send(res, 200, { status: 'ready', code: e.code, state: b.state });
  }

  // ── POST /auth/oauth/token → intercambio code + code_verifier (PKCE)
  if (req.method === 'POST' && path === '/auth/oauth/token') {
    const b = await readBody(req);
    if (b.grant_type && b.grant_type !== 'authorization_code') {
      return send(res, 400, { error: 'unsupported_grant_type' });
    }
    sweep(authCodes, Date.now(), (v) => v.exp);
    const entry = authCodes.get(b.code);
    authCodes.delete(b.code); // un solo uso, falle o no
    if (!entry) return send(res, 400, { error: 'invalid_grant', message: 'Código inválido o expirado' });
    if (b.redirect_uri && b.redirect_uri !== entry.redirectUri) {
      return send(res, 400, { error: 'invalid_grant', message: 'redirect_uri no coincide' });
    }
    if (!/^[A-Za-z0-9\-._~]{43,128}$/.test(String(b.code_verifier ?? ''))) {
      return send(res, 400, { error: 'invalid_request', message: 'code_verifier fuera de formato (43–128, URL-safe)' });
    }
    // SHA256(code_verifier) === code_challenge
    if (!safeEqual(sha256b64u(b.code_verifier), entry.challenge)) {
      log('⛔ PKCE: verifier no coincide con challenge');
      return send(res, 400, { error: 'invalid_grant', message: 'PKCE: code_verifier no coincide' });
    }
    log('✅ PKCE verificado, sesión emitida');
    return send(res, 200, issueSession(entry.sub));
  }

  // ── POST /auth/refresh → rotación de refresh_token con detección de reutilización
  if (req.method === 'POST' && path === '/auth/refresh') {
    const b = await readBody(req);
    const key = sha256b64u(String(b.refresh_token ?? ''));
    const rec = refreshTokens.get(key);
    if (!rec || rec.exp < Date.now() || revokedFamilies.has(rec.family)) {
      return send(res, 401, { error: 'invalid_refresh', message: 'Refresh token vencido o revocado' });
    }
    if (rec.used) {
      revokedFamilies.add(rec.family); // alguien reutilizó un token ya rotado
      log('🚨 reutilización de refresh_token: familia revocada');
      return send(res, 401, { error: 'invalid_refresh', message: 'Refresh token reutilizado: familia revocada' });
    }
    rec.used = true;
    log('♻️  refresh rotado');
    return send(res, 200, issueSession(rec.sub, rec.family));
  }

  // ── GET /api/perfil → recurso normal (basta un access_token estándar)
  if (req.method === 'GET' && path === '/api/perfil') {
    const p = requireAccess(req, res);
    if (!p) return;
    return send(res, 200, {
      email: CONFIG.user.email,
      mfa_verified: p.mfa_verified === true,
      access_expira_en: p.exp - Math.floor(Date.now() / 1000),
    });
  }

  // ── GET /api/boveda-critica (alias /api/boveda) → requiere mfa_verified
  if (req.method === 'GET' && (path === '/api/boveda-critica' || path === '/api/boveda')) {
    const p = requireAccess(req, res);
    if (!p) return;
    if (p.mfa_verified !== true) {
      const stepUp = signJwt({ typ: 'step_up', sub: p.sub }, CONFIG.jwtSecret, CONFIG.stepUpTtl);
      log('🔒 403 mfa_required');
      return send(res, 403, {
        error: 'mfa_required',
        message: 'Esta bóveda requiere un segundo factor',
        step_up_token: stepUp,
      });
    }
    return send(res, 200, {
      titulo: 'Bóveda Crítica',
      elevada_hasta: p.exp,
      secretos: [
        { id: 1, etiqueta: 'Notas finales Q4', valor: 'Promedio: 4.8 🌟', color: 'mint' },
        { id: 2, etiqueta: 'Llave de laboratorio', valor: 'LAB-SABANA-7731', color: 'lavender' },
        { id: 3, etiqueta: 'Plan secreto', valor: 'Dominar el mundo con Hermenegildo 🤡', color: 'pink' },
        { id: 4, etiqueta: 'Contraseña del WiFi', valor: 'carpa-de-circo-2026', color: 'sky' },
      ],
    });
  }

  // ── POST /auth/mfa/verify → TOTP con ventanas C-1/C/C+1 + caché Anti-Replay
  if (req.method === 'POST' && path === '/auth/mfa/verify') {
    const b = await readBody(req);
    let step;
    try {
      step = verifyJwt(b.step_up_token, CONFIG.jwtSecret);
      if (step.typ !== 'step_up') throw new Error('invalid');
    } catch {
      return send(res, 401, { error: 'invalid_step_up_token' });
    }
    const code = String(b.code ?? '');
    if (!/^\d{6}$/.test(code)) return send(res, 400, { error: 'invalid_code_format', message: 'El código tiene 6 dígitos' });

    const now = Date.now();
    sweep(replayCache, now);
    const fails = mfaFailures.get(step.sub);
    if (fails && fails.resetAt > now && fails.count >= CONFIG.maxMfaFailures) {
      return send(res, 429, { error: 'too_many_attempts', retry_after_s: Math.ceil((fails.resetAt - now) / 1000) });
    }

    const window = matchWindow(CONFIG.totpSecret, code, now / 1000);
    if (window === null) {
      const f = fails && fails.resetAt > now ? fails : { count: 0, resetAt: now + 60_000 };
      f.count++;
      mfaFailures.set(step.sub, f);
      log('❌ TOTP inválido');
      return send(res, 401, { error: 'invalid_code', message: 'Código incorrecto o fuera de ventana' });
    }

    const replayKey = `${step.sub}:${code}`;
    if (replayCache.has(replayKey)) {
      log('🛑 409 Replay Attack Detected');
      return send(res, 409, { error: 'replay_detected', message: 'Replay Attack Detected' });
    }
    replayCache.set(replayKey, now + CONFIG.replayTtlMs); // TTL 90 s
    mfaFailures.delete(step.sub);

    const elevated = signJwt({ typ: 'access', sub: step.sub, mfa_verified: true }, CONFIG.jwtSecret, CONFIG.elevatedTtl);
    log(`🎟️  elevated_token emitido (ventana ${['C-1', 'C', 'C+1'][window - Math.floor(now / 30000) + 1] ?? 'C'})`);
    return send(res, 200, { elevated_token: elevated, expires_in: CONFIG.elevatedTtl, mfa_verified: true });
  }

  // ── Enrolamiento (solo laboratorio)
  if (req.method === 'GET' && (path === '/mfa/setup' || path === '/auth/mfa/enroll')) {
    const account = CONFIG.user.email;
    const uri =
      `otpauth://totp/${CONFIG.issuer}:${encodeURIComponent(account)}` +
      `?secret=${CONFIG.totpSecret}&issuer=${CONFIG.issuer}&algorithm=SHA1&digits=6&period=30`;
    if (path === '/auth/mfa/enroll') return send(res, 200, { secret: CONFIG.totpSecret, otpauth_uri: uri });
    return send(res, 200, setupPage({ secret: CONFIG.totpSecret, uri, issuer: CONFIG.issuer, account }));
  }

  return send(res, 404, notFoundPage);
}

function validateAuthorize(q) {
  if (q.response_type !== 'code') return 'response_type debe ser "code"';
  if (q.client_id !== CONFIG.clientId) return 'client_id desconocido';
  if (!CONFIG.redirectPrefixes.some((p) => String(q.redirect_uri ?? '').startsWith(p))) return 'redirect_uri no permitido';
  if (q.code_challenge_method !== 'S256') return 'Solo se acepta code_challenge_method=S256';
  if (!/^[A-Za-z0-9_-]{43}$/.test(String(q.code_challenge ?? ''))) return 'code_challenge inválido (SHA-256 base64url sin relleno)';
  if (!/^[A-Za-z0-9_-]{16,}$/.test(String(q.state ?? ''))) return 'state ausente o muy corto';
  return null;
}

function safeEqual(a, b) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export function createApp() {
  return createServer((req, res) => {
    handle(req, res).catch((err) => {
      const status = err.status ?? (err instanceof SyntaxError ? 400 : 500);
      if (status === 500) console.error(err);
      if (!res.headersSent) send(res, status, { error: status === 500 ? 'server_error' : 'bad_request' });
    });
  });
}
