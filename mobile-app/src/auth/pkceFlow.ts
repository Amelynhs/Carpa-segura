/**
 * Flujo OAuth 2.0 Authorization Code + PKCE, puro e inyectable (se prueba sin React Native).
 *
 * El código de autorización puede llegar por DOS caminos y gana el primero:
 *   1) Deep link (unisabana-auth://callback en un development build, exp://… en Expo Go):
 *      el navegador del sistema devuelve la URL con ?code=…&state=…
 *   2) Sondeo seguro: mientras el navegador está abierto, la app consulta POST /oauth/poll con
 *      {state, code_verifier}. El backend solo entrega el code a quien demuestre el verifier (PKCE).
 *      Es lo que permite funcionar en Expo Go, donde el salto a un esquema propio lo bloquean
 *      muchos navegadores del teléfono.
 */

export class OAuthCancelled extends Error {
  constructor() {
    super('Inicio de sesión cancelado');
    this.name = 'OAuthCancelled';
  }
}
export class OAuthStateMismatch extends Error {
  constructor() {
    super('El parámetro state no coincide: intercambio abortado (posible CSRF)');
    this.name = 'OAuthStateMismatch';
  }
}

export interface TokenSet {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

export interface BrowserResult {
  type: string;
  url?: string;
}

export interface FlowDeps {
  apiUrl: string;
  clientId: string;
  redirectUri: string;
  createPkcePair: () => Promise<{ verifier: string; challenge: string }>;
  createState: () => Promise<string>;
  /** Abre el navegador del sistema y resuelve cuando éste devuelve una URL o se cierra. */
  openAuthSession: (authUrl: string, redirectUri: string) => Promise<BrowserResult>;
  /** Cierra el navegador si el code llegó por sondeo. */
  closeBrowser?: () => void | Promise<void>;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  pollIntervalMs?: number;
  /** Tiempo extra de sondeo tras cerrarse el navegador (el usuario volvió a mano). */
  graceMs?: number;
  timeoutMs?: number;
  onStep?: (s: string) => void;
}

const enc = encodeURIComponent;

export function parseQuery(url: string): Record<string, string> {
  const q = url.split('#')[0].split('?')[1] ?? '';
  const out: Record<string, string> = {};
  for (const part of q.split('&')) {
    if (!part) continue;
    const [k, v = ''] = part.split('=');
    out[decodeURIComponent(k)] = decodeURIComponent(v.replace(/\+/g, ' '));
  }
  return out;
}

/** Comparación en tiempo constante. */
export function constantTimeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function runAuthorizationFlow(d: FlowDeps): Promise<TokenSet> {
  const f = d.fetchImpl ?? fetch;
  const sleep = d.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const now = d.now ?? Date.now;
  const interval = d.pollIntervalMs ?? 1200;
  const grace = d.graceMs ?? 8000;
  const timeout = d.timeoutMs ?? 180_000;

  // PKCE + state por solicitud; viven solo en memoria (closure).
  const { verifier, challenge } = await d.createPkcePair();
  const state = await d.createState();
  d.onStep?.('PKCE generado (S256)');

  const authUrl =
    `${d.apiUrl}/oauth/authorize?response_type=code` +
    `&client_id=${enc(d.clientId)}&redirect_uri=${enc(d.redirectUri)}` +
    `&code_challenge=${enc(challenge)}&code_challenge_method=S256&state=${enc(state)}`;

  const st: { result: BrowserResult | null; closedAt: number | null } = { result: null, closedAt: null };
  d.onStep?.('Abriendo el navegador del sistema');
  const browser = d
    .openAuthSession(authUrl, d.redirectUri)
    .then((r) => {
      st.result = r;
      if (r.type !== 'success') st.closedAt = now();
      d.onStep?.(`Navegador devolvió: ${r.type}`);
    })
    .catch(() => {
      st.result = { type: 'error' };
      st.closedAt = now();
    });

  async function pollOnce(): Promise<string | null> {
    try {
      const res = await f(`${d.apiUrl}/oauth/poll`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state, code_verifier: verifier }),
      });
      if (res.status !== 200) return null; // 202 = todavía no inicia sesión
      const b = await res.json();
      if (b.state && !constantTimeEqual(b.state, state)) throw new OAuthStateMismatch();
      return b.code ?? null;
    } catch (e) {
      if (e instanceof OAuthStateMismatch) throw e;
      return null; // sin red momentánea: se reintenta
    }
  }

  const started = now();
  let code: string | null = null;
  let via: 'deep-link' | 'sondeo' = 'deep-link';

  for (;;) {
    // Camino 1: deep link
    if (st.result?.type === 'success' && st.result.url) {
      const q = parseQuery(st.result.url);
      if (q.error) throw new Error(q.error_description ?? q.error);
      if (!q.state || !constantTimeEqual(q.state, state)) throw new OAuthStateMismatch();
      if (!q.code) throw new Error('El callback no trae authorization_code');
      code = q.code;
      via = 'deep-link';
      break;
    }
    // Camino 2: sondeo seguro
    const polled = await pollOnce();
    if (polled) {
      code = polled;
      via = 'sondeo';
      break;
    }
    const t = now();
    if (t - started > timeout) break;
    if (st.closedAt !== null && t - st.closedAt > grace) break;
    await (st.result ? sleep(interval) : Promise.race([sleep(interval), browser]));
  }

  if (!code) throw new OAuthCancelled();
  if (via === 'sondeo') {
    try {
      await d.closeBrowser?.();
    } catch {
      /* el navegador ya estaba cerrado */
    }
  }
  d.onStep?.(via === 'deep-link' ? 'Deep link recibido · state validado' : 'Código recibido por sondeo seguro (PKCE) · state validado');

  // Intercambio code + code_verifier. El backend comprueba SHA256(verifier) === challenge.
  const res = await f(`${d.apiUrl}/auth/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      code,
      code_verifier: verifier,
      redirect_uri: d.redirectUri,
      client_id: d.clientId,
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.message ?? 'No se pudo intercambiar el código');
  d.onStep?.('Tokens recibidos');
  return body as TokenSet;
}
