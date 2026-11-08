// Recorre los escenarios de aceptación contra el servidor real (puerto efímero).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { createApp, CONFIG } from '../src/server.js';
import { totpAt } from '../src/totp.js';

let server;
let base;
const REDIRECT = 'unisabana-auth://callback';
const b64u = (b) => Buffer.from(b).toString('base64url');

before(async () => {
  server = createApp();
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

const post = (path, body) =>
  fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

/** Hace el viaje completo OAuth+PKCE como lo haría la app. */
async function login({ tamperVerifier = false } = {}) {
  const verifier = b64u(randomBytes(64));
  const challenge = b64u(createHash('sha256').update(verifier).digest());
  const state = b64u(randomBytes(16));
  const q = new URLSearchParams({
    response_type: 'code', client_id: CONFIG.clientId, redirect_uri: REDIRECT,
    code_challenge: challenge, code_challenge_method: 'S256', state,
  });
  const page = await fetch(`${base}/oauth/authorize?${q}`);
  assert.equal(page.status, 200);
  assert.match(await page.text(), /Hermenegildo/);

  const form = new URLSearchParams({ ...Object.fromEntries(q), username: CONFIG.user.email, password: CONFIG.user.password });
  const res = await fetch(`${base}/oauth/login`, { method: 'POST', body: form, redirect: 'manual' });
  assert.equal(res.status, 200);
  const html = await res.text();
  const link = /id="go"[^>]*href="([^"]+)"/.exec(html)[1].replace(/&amp;/g, '&');
  assert.match(html, /location\.href=/, 'redirige por JS además del botón');
  const loc = new URL(link);
  assert.equal(`${loc.protocol}//${loc.host}`, REDIRECT);
  assert.equal(loc.searchParams.get('state'), state, 'el state vuelve intacto');
  const code = loc.searchParams.get('code');
  const tok = await post('/auth/oauth/token', {
    grant_type: 'authorization_code', code, redirect_uri: REDIRECT,
    code_verifier: tamperVerifier ? b64u(randomBytes(64)) : verifier,
  });
  return { tok, code, verifier };
}

test('1 · OAuth + PKCE: intercambio exitoso y code de un solo uso', async () => {
  const { tok, code, verifier } = await login();
  assert.equal(tok.status, 200);
  const s = await tok.json();
  assert.ok(s.access_token && s.refresh_token);
  assert.equal(s.expires_in, 300, 'access_token de 5 min');
  assert.equal(s.refresh_expires_in, 30 * 86400, 'refresh_token de 30 días');
  const again = await post('/auth/oauth/token', { code, code_verifier: verifier, redirect_uri: REDIRECT });
  assert.equal(again.status, 400, 'reusar el code falla');
});

test('1b · PKCE: code_verifier incorrecto es rechazado', async () => {
  const { tok } = await login({ tamperVerifier: true });
  assert.equal(tok.status, 400);
  assert.match((await tok.json()).message, /PKCE/);
});

test('1c · authorize rechaza challenge plano / sin S256 / redirect no permitido', async () => {
  const bad = async (patch) => {
    const q = new URLSearchParams({
      response_type: 'code', client_id: CONFIG.clientId, redirect_uri: REDIRECT,
      code_challenge: 'x'.repeat(43), code_challenge_method: 'S256', state: 'a'.repeat(16), ...patch,
    });
    return (await fetch(`${base}/oauth/authorize?${q}`)).status;
  };
  assert.equal(await bad({}), 200);
  assert.equal(await bad({ code_challenge_method: 'plain' }), 400);
  assert.equal(await bad({ redirect_uri: 'https://evil.example/cb' }), 400);
});

test('4 · Step-Up: 403 mfa_required → TOTP → elevated_token → bóveda; 5 · replay 409', async () => {
  const { tok } = await login();
  const { access_token } = await tok.json();
  const auth = (t) => ({ headers: { Authorization: `Bearer ${t}` } });

  assert.equal((await fetch(`${base}/api/perfil`, auth(access_token))).status, 200);

  const denied = await fetch(`${base}/api/boveda-critica`, auth(access_token));
  assert.equal(denied.status, 403);
  const body = await denied.json();
  assert.equal(body.error, 'mfa_required');
  assert.ok(body.step_up_token);

  // código erróneo → 401
  const wrong = await post('/auth/mfa/verify', { step_up_token: body.step_up_token, code: '000000' });
  assert.ok([401].includes(wrong.status) || totpAt(CONFIG.totpSecret, Date.now() / 1000) === '000000');

  // código correcto → elevated_token
  const code = totpAt(CONFIG.totpSecret, Date.now() / 1000);
  const ok = await post('/auth/mfa/verify', { step_up_token: body.step_up_token, code });
  assert.equal(ok.status, 200);
  const { elevated_token } = await ok.json();
  const vault = await fetch(`${base}/api/boveda-critica`, auth(elevated_token));
  assert.equal(vault.status, 200);
  assert.equal((await vault.json()).secretos.length, 4);

  // ataque de repetición con el MISMO código
  const replay = await post('/auth/mfa/verify', { step_up_token: body.step_up_token, code });
  assert.equal(replay.status, 409);
  assert.equal((await replay.json()).message, 'Replay Attack Detected');
});

test('4b · Ventanas C-1 y C+1 aceptadas; C-2 rechazada', async () => {
  const mk = async () => {
    const { tok } = await login();
    const { access_token } = await tok.json();
    const d = await (await fetch(`${base}/api/boveda-critica`, { headers: { Authorization: `Bearer ${access_token}` } })).json();
    return d.step_up_token;
  };
  const now = Date.now() / 1000;
  const prev = totpAt(CONFIG.totpSecret, now - 30);
  const next = totpAt(CONFIG.totpSecret, now + 30);
  const far = totpAt(CONFIG.totpSecret, now - 90);
  const cur = totpAt(CONFIG.totpSecret, now);
  assert.equal((await post('/auth/mfa/verify', { step_up_token: await mk(), code: far })).status,
    [prev, next, cur].includes(far) ? 200 : 401);
  // usan códigos distintos para no chocar con el caché anti-replay del test anterior
  const candidates = [...new Set([prev, next])].filter((c) => c !== cur);
  for (const c of candidates) {
    const r = await post('/auth/mfa/verify', { step_up_token: await mk(), code: c });
    assert.ok([200, 409].includes(r.status), `ventana adyacente aceptada (status ${r.status})`);
  }
});

test('2 · Refresh rotatorio y detección de reutilización', async () => {
  const { tok } = await login();
  const s1 = await tok.json();
  const r1 = await post('/auth/refresh', { refresh_token: s1.refresh_token });
  assert.equal(r1.status, 200);
  const s2 = await r1.json();
  assert.notEqual(s2.refresh_token, s1.refresh_token, 'el refresh rota');
  // reutilizar el viejo → revoca toda la familia
  assert.equal((await post('/auth/refresh', { refresh_token: s1.refresh_token })).status, 401);
  assert.equal((await post('/auth/refresh', { refresh_token: s2.refresh_token })).status, 401, 'familia revocada');
  assert.equal((await post('/auth/refresh', { refresh_token: 'basura' })).status, 401);
});

test('Seguridad: token manipulado o ausente → 401', async () => {
  assert.equal((await fetch(`${base}/api/perfil`)).status, 401);
  assert.equal((await fetch(`${base}/api/perfil`, { headers: { Authorization: 'Bearer a.b.c' } })).status, 401);
  const { tok } = await login();
  const { access_token } = await tok.json();
  const forged = access_token.replace(/\.[^.]+$/, '.AAAA');
  assert.equal((await fetch(`${base}/api/boveda-critica`, { headers: { Authorization: `Bearer ${forged}` } })).status, 401);
});
