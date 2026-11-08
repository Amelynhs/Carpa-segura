// El flujo completo contra el backend REAL, con un «navegador» simulado.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { createApp, CONFIG } from '../../backend-auth/src/server.js';
import { OAuthCancelled, OAuthStateMismatch, runAuthorizationFlow, type FlowDeps } from '../src/auth/pkceFlow.ts';

let server: any;
let base = '';
const REDIRECT = 'exp://192.168.5.104:8081/--/callback'; // como en Expo Go
const b64u = (b: Uint8Array) => Buffer.from(b).toString('base64url');

before(async () => {
  server = createApp();
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

/** Lo que haría el usuario en el navegador: abrir authorize, escribir credenciales, pulsar «Entrar». */
async function browserLogin(authUrl: string): Promise<string> {
  const u = new URL(authUrl);
  assert.equal((await fetch(authUrl)).status, 200);
  const form = new URLSearchParams(u.searchParams);
  form.set('username', CONFIG.user.email);
  form.set('password', CONFIG.user.password);
  const html = await (await fetch(`${base}/oauth/login`, { method: 'POST', body: form })).text();
  return /id="go"[^>]*href="([^"]+)"/.exec(html)![1].replace(/&amp;/g, '&');
}

const deps = (over: Partial<FlowDeps>): FlowDeps => ({
  apiUrl: base,
  clientId: CONFIG.clientId,
  redirectUri: REDIRECT,
  createPkcePair: async () => {
    const verifier = b64u(randomBytes(64));
    return { verifier, challenge: b64u(createHash('sha256').update(verifier).digest()) };
  },
  createState: async () => b64u(randomBytes(24)),
  openAuthSession: async () => ({ type: 'cancel' }),
  pollIntervalMs: 40,
  graceMs: 400,
  timeoutMs: 5000,
  ...over,
});

test('Expo Go: el navegador NO regresa (queda trabado) y aun así inicia sesión por sondeo', async () => {
  let closed = false;
  const steps: string[] = [];
  const t = await runAuthorizationFlow(
    deps({
      openAuthSession: (url) => {
        setTimeout(() => void browserLogin(url), 150); // el usuario escribe sus credenciales…
        return new Promise(() => {}); // …y el navegador jamás devuelve el deep link
      },
      closeBrowser: () => void (closed = true),
      onStep: (s) => steps.push(s),
    }),
  );
  assert.ok(t.access_token && t.refresh_token);
  assert.ok(closed, 'cierra el navegador al recibir el código');
  assert.ok(steps.some((s) => s.includes('sondeo')));
});

test('Development build: el deep link llega primero y se usa', async () => {
  const steps: string[] = [];
  const t = await runAuthorizationFlow(
    deps({
      openAuthSession: async (url) => ({ type: 'success', url: await browserLogin(url) }),
      onStep: (s) => steps.push(s),
    }),
  );
  assert.ok(t.access_token);
  assert.ok(steps.some((s) => s.includes('Deep link recibido')));
});

test('El usuario inicia sesión y vuelve a mano: el navegador reporta dismiss y el sondeo lo completa', async () => {
  const t = await runAuthorizationFlow(
    deps({
      openAuthSession: async (url) => {
        await browserLogin(url);
        await new Promise((r) => setTimeout(r, 100));
        return { type: 'dismiss' };
      },
    }),
  );
  assert.ok(t.access_token);
});

test('Cierra el navegador sin iniciar sesión → OAuthCancelled (tras el margen de gracia)', async () => {
  await assert.rejects(runAuthorizationFlow(deps({ openAuthSession: async () => ({ type: 'cancel' }) })), OAuthCancelled);
});

test('Deep link con state distinto → aborta con OAuthStateMismatch (anti-CSRF)', async () => {
  await assert.rejects(
    runAuthorizationFlow(deps({ openAuthSession: async () => ({ type: 'success', url: `${REDIRECT}?code=abc&state=otroestadoXXXXXXXXXXXXXXXX` }) })),
    OAuthStateMismatch,
  );
});

test('Sondeo: sin login → pending; verifier incorrecto → 400 y NO consume el code; correcto → code una sola vez', async () => {
  const verifier = b64u(randomBytes(64));
  const challenge = b64u(createHash('sha256').update(verifier).digest());
  const state = b64u(randomBytes(24));
  const poll = (v: string) =>
    fetch(`${base}/oauth/poll`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ state, code_verifier: v }) });
  assert.equal((await poll(verifier)).status, 202);

  const q = new URLSearchParams({ response_type: 'code', client_id: CONFIG.clientId, redirect_uri: REDIRECT, code_challenge: challenge, code_challenge_method: 'S256', state });
  await browserLogin(`${base}/oauth/authorize?${q}`);

  assert.equal((await poll(b64u(randomBytes(64)))).status, 400, 'un atacante sin el verifier no obtiene el code');
  const ok = await poll(verifier);
  assert.equal(ok.status, 200);
  assert.ok((await ok.json()).code);
  assert.equal((await poll(verifier)).status, 202, 'de un solo uso');
});
