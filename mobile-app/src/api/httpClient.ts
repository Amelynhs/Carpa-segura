/**
 * Cliente HTTP con interceptor de 401 y COLA SILENCIOSA (Silent Refresh Queue).
 * Es puro (todo se inyecta) para poder probarlo sin React Native.
 *
 * Comportamiento ante un 401:
 *   1. Las peticiones que fallan se ENCOLAN (todas esperan la misma promesa).
 *   2. Se dispara UNA sola renovación (single-flight).
 *   3. Éxito  → se actualiza el access_token en memoria, se reintenta cada petición original.
 *   4. Fallo  → se limpia el almacenamiento seguro y se navega a la bienvenida (onSessionExpired).
 */

export class SessionExpiredError extends Error {
  constructor() {
    super('La sesión expiró');
    this.name = 'SessionExpiredError';
  }
}

export interface HttpDeps {
  baseUrl: string;
  fetchImpl?: typeof fetch;
  getAccessToken: () => string | null;
  /** Debe devolver el nuevo access_token o lanzar si el refresh falló. */
  refresh: () => Promise<string>;
  onSessionExpired: () => void | Promise<void>;
  onEvent?: (e: HttpEvent) => void;
}

export type HttpEvent =
  | { type: 'request'; method: string; path: string }
  | { type: 'response'; path: string; status: number }
  | { type: 'queued'; path: string; queueSize: number }
  | { type: 'refresh-start' }
  | { type: 'refresh-ok'; replayed: number }
  | { type: 'refresh-fail' };

export interface RequestOptions {
  method?: string;
  body?: unknown;
  /** Token a usar en lugar del de memoria (p. ej. el elevated_token). */
  tokenOverride?: string | null;
  /** Rutas públicas (sin Authorization ni interceptor 401). */
  skipAuth?: boolean;
}

export interface ApiResponse<T = any> {
  status: number;
  ok: boolean;
  data: T;
}

export function createHttpClient(deps: HttpDeps) {
  const f = deps.fetchImpl ?? fetch;
  let refreshing: Promise<string> | null = null;
  let waiting = 0;
  // Ciclos de renovación terminados. Una petición que salió ANTES de que terminara un ciclo
  // no debe disparar otro: reutiliza el resultado de ese ciclo (token nuevo o sesión muerta).
  let epoch = 0;
  let lastCycle: { ok: true; token: string } | { ok: false } | null = null;

  async function raw<T>(path: string, opts: RequestOptions, token: string | null): Promise<ApiResponse<T>> {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
    if (token && !opts.skipAuth) headers.Authorization = `Bearer ${token}`;
    deps.onEvent?.({ type: 'request', method: opts.method ?? 'GET', path });
    const res = await f(`${deps.baseUrl}${path}`, {
      method: opts.method ?? 'GET',
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
    let data: any = null;
    try {
      data = await res.json();
    } catch {
      /* cuerpo vacío */
    }
    deps.onEvent?.({ type: 'response', path, status: res.status });
    return { status: res.status, ok: res.ok, data };
  }

  function renewOnce(): Promise<string> {
    if (!refreshing) {
      deps.onEvent?.({ type: 'refresh-start' });
      refreshing = deps
        .refresh()
        .then((t) => {
          lastCycle = { ok: true, token: t };
          deps.onEvent?.({ type: 'refresh-ok', replayed: waiting });
          return t;
        })
        .catch(async (e) => {
          deps.onEvent?.({ type: 'refresh-fail' });
          // Sin red NO es sesión vencida: no se borra nada, el error sube tal cual.
          if (e?.name === 'NetworkError') {
            lastCycle = null;
            throw e;
          }
          lastCycle = { ok: false };
          await deps.onSessionExpired();
          throw new SessionExpiredError();
        })
        .finally(() => {
          epoch++;
          refreshing = null;
          waiting = 0;
        });
    }
    return refreshing;
  }

  async function request<T = any>(path: string, opts: RequestOptions = {}): Promise<ApiResponse<T>> {
    const token = opts.tokenOverride ?? deps.getAccessToken();

    // Si ya hay una renovación en vuelo, esta petición espera en la cola antes de salir.
    if (refreshing && !opts.skipAuth) {
      waiting++;
      deps.onEvent?.({ type: 'queued', path, queueSize: waiting });
      const fresh = await refreshing;
      return raw<T>(path, opts, opts.tokenOverride ?? fresh);
    }

    const startedAtEpoch = epoch;
    const first = await raw<T>(path, opts, token);
    // Un elevated_token vencido (tokenOverride) no se arregla con refresh: lo maneja el llamador.
    const expired = first.status === 401 && !opts.skipAuth && !opts.tokenOverride;
    if (!expired) return first;

    // Ya terminó un ciclo de renovación mientras esta petición viajaba: reutilizar su resultado.
    if (epoch !== startedAtEpoch && !refreshing && lastCycle) {
      if (!lastCycle.ok) throw new SessionExpiredError();
      return raw<T>(path, opts, lastCycle.token);
    }

    waiting++;
    deps.onEvent?.({ type: 'queued', path, queueSize: waiting });
    const fresh = await renewOnce();
    return raw<T>(path, opts, fresh);
  }

  return { request };
}

export type HttpClient = ReturnType<typeof createHttpClient>;
