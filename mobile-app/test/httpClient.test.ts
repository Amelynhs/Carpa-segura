import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHttpClient, SessionExpiredError } from '../src/api/httpClient.ts';

/** Servidor falso: solo acepta el token "fresh". */
function fakeFetch(log: string[]) {
  return (async (url: string, init: any) => {
    const auth = init.headers.Authorization;
    log.push(`${url.split('/').pop()}:${auth}`);
    await new Promise((r) => setTimeout(r, 5));
    const ok = auth === 'Bearer fresh';
    return {
      status: ok ? 200 : 401,
      ok,
      json: async () => (ok ? { fine: true } : { error: 'token_expired' }),
    } as Response;
  }) as unknown as typeof fetch;
}

test('3 peticiones concurrentes con 401 → UNA sola renovación y las 3 se reintentan', async () => {
  const log: string[] = [];
  let token = 'stale';
  let refreshCalls = 0;
  let expired = 0;
  const client = createHttpClient({
    baseUrl: 'http://x',
    fetchImpl: fakeFetch(log),
    getAccessToken: () => token,
    refresh: async () => {
      refreshCalls++;
      await new Promise((r) => setTimeout(r, 20));
      token = 'fresh';
      return token;
    },
    onSessionExpired: () => void expired++,
  });

  const results = await Promise.all([client.request('/a'), client.request('/b'), client.request('/c')]);
  assert.deepEqual(results.map((r) => r.status), [200, 200, 200]);
  assert.equal(refreshCalls, 1, 'debe haber un único POST /auth/refresh');
  assert.equal(expired, 0, 'no se cierra la sesión');
});

test('peticiones que llegan MIENTRAS se renueva esperan en la cola (no salen con el token viejo)', async () => {
  const log: string[] = [];
  let token = 'stale';
  const client = createHttpClient({
    baseUrl: 'http://x',
    fetchImpl: fakeFetch(log),
    getAccessToken: () => token,
    refresh: async () => {
      await new Promise((r) => setTimeout(r, 30));
      return (token = 'fresh');
    },
    onSessionExpired: () => {},
  });
  const first = client.request('/uno');
  await new Promise((r) => setTimeout(r, 12)); // /uno ya recibió su 401 y la renovación está en curso
  const late = await client.request('/tarde');
  await first;
  assert.equal(late.status, 200);
  assert.ok(!log.includes('tarde:Bearer stale'), 'la petición tardía no debió salir con el token viejo');
});

test('si el refresh falla → limpia sesión una vez y todas las peticiones rechazan', async () => {
  let expired = 0;
  const client = createHttpClient({
    baseUrl: 'http://x',
    fetchImpl: fakeFetch([]),
    getAccessToken: () => 'stale',
    refresh: async () => {
      throw new Error('revocado');
    },
    onSessionExpired: () => void expired++,
  });
  const r = await Promise.allSettled([client.request('/a'), client.request('/b')]);
  assert.ok(r.every((x) => x.status === 'rejected' && x.reason instanceof SessionExpiredError));
  assert.equal(expired, 1);
});

test('403 mfa_required NO dispara renovación (es Step-Up, no sesión vencida)', async () => {
  let refreshCalls = 0;
  const client = createHttpClient({
    baseUrl: 'http://x',
    fetchImpl: (async () =>
      ({ status: 403, ok: false, json: async () => ({ error: 'mfa_required', step_up_token: 't' }) }) as Response) as any,
    getAccessToken: () => 'fresh',
    refresh: async () => (refreshCalls++, 'x'),
    onSessionExpired: () => {},
  });
  const r = await client.request('/api/boveda-critica');
  assert.equal(r.status, 403);
  assert.equal(r.data.error, 'mfa_required');
  assert.equal(refreshCalls, 0);
});

test('sin red durante el refresh NO borra la sesión', async () => {
  let expired = 0;
  const client = createHttpClient({
    baseUrl: 'http://x',
    fetchImpl: fakeFetch([]),
    getAccessToken: () => 'stale',
    refresh: async () => {
      throw Object.assign(new Error('offline'), { name: 'NetworkError' });
    },
    onSessionExpired: () => void expired++,
  });
  await assert.rejects(client.request('/a'), /offline/);
  assert.equal(expired, 0);
});
