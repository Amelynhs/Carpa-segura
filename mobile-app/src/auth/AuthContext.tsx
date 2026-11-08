import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { API_URL } from '../config';
import { createHttpClient, type HttpClient, type HttpEvent } from '../api/httpClient';
import { signInWithBrowser } from './oauth';
import { clearRefreshToken, loadRefreshToken, saveRefreshToken } from './secureStorage';

export type SessionStatus = 'booting' | 'signedOut' | 'signedIn';
export type EventKind = 'info' | 'ok' | 'warn' | 'error';

export interface SecurityEvent {
  id: number;
  at: number;
  kind: EventKind;
  text: string;
}

interface Elevated {
  token: string;
  expiresAt: number;
}

interface AuthValue {
  status: SessionStatus;
  /** Epoch ms en que vence el access_token que vive en RAM. */
  accessExpiresAt: number | null;
  elevated: Elevated | null;
  setElevated: (e: Elevated | null) => void;
  events: SecurityEvent[];
  log: (kind: EventKind, text: string) => void;
  api: HttpClient;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  /** Solo demo: corrompe el access_token en RAM para provocar 401 reales. */
  forceExpireAccessToken: () => void;
  signInStep: string | null;
  bootNotice: string | null;
}

const Ctx = createContext<AuthValue | null>(null);
export const useAuth = () => {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth fuera de AuthProvider');
  return v;
};

let eventId = 0;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<SessionStatus>('booting');
  const [accessExpiresAt, setAccessExpiresAt] = useState<number | null>(null);
  const [elevated, setElevatedState] = useState<Elevated | null>(null);
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [signInStep, setSignInStep] = useState<string | null>(null);
  const [bootNotice, setBootNotice] = useState<string | null>(null);

  // El access_token vive SOLO en memoria volátil (ref). Nunca se escribe a disco.
  const accessRef = useRef<string | null>(null);

  const log = useCallback((kind: EventKind, text: string) => {
    setEvents((prev) => [{ id: ++eventId, at: Date.now(), kind, text }, ...prev].slice(0, 40));
  }, []);

  const setAccess = useCallback((token: string | null, expiresInSeconds?: number) => {
    accessRef.current = token;
    setAccessExpiresAt(token && expiresInSeconds ? Date.now() + expiresInSeconds * 1000 : null);
  }, []);

  const setElevated = useCallback((e: Elevated | null) => setElevatedState(e), []);

  /** POST /auth/refresh con rotación. Lanza NetworkError si no hay red (no destruye la sesión). */
  const refreshImpl = useCallback(async (): Promise<string> => {
    const rt = await loadRefreshToken();
    if (!rt) throw new Error('Sin refresh_token');
    let res: Response;
    try {
      res = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: rt }),
      });
    } catch {
      throw Object.assign(new Error('Sin conexión con el servidor'), { name: 'NetworkError' });
    }
    if (!res.ok) throw new Error('Refresh vencido o revocado');
    const s = await res.json();
    await saveRefreshToken(s.refresh_token); // rotación: reemplaza al anterior
    setAccess(s.access_token, s.expires_in);
    return s.access_token as string;
  }, [setAccess]);

  const handleEvent = useCallback(
    (e: HttpEvent) => {
      switch (e.type) {
        case 'queued':
          log('warn', `401 en ${e.path} → petición en cola (${e.queueSize})`);
          break;
        case 'refresh-start':
          log('info', 'Renovación silenciosa iniciada (1 sola petición)');
          break;
        case 'refresh-ok':
          log('ok', `Token renovado · ${e.replayed} petición(es) reintentadas sin molestar al usuario`);
          break;
        case 'refresh-fail':
          log('error', 'Renovación fallida');
          break;
        case 'response':
          if (e.status === 403) log('warn', `403 en ${e.path} → Step-Up requerido`);
          if (e.status === 409) log('error', `409 en ${e.path} → Replay Attack Detected`);
          break;
      }
    },
    [log],
  );

  const expireSession = useCallback(async () => {
    await clearRefreshToken(); // limpiar almacenamiento seguro
    setAccess(null);
    setElevatedState(null);
    setStatus('signedOut'); // → navega automáticamente a la bienvenida
    log('error', 'Sesión cerrada: refresh_token vencido o revocado');
  }, [log, setAccess]);

  const api = useMemo(
    () =>
      createHttpClient({
        baseUrl: API_URL,
        getAccessToken: () => accessRef.current,
        refresh: refreshImpl,
        onSessionExpired: expireSession,
        onEvent: handleEvent,
      }),
    [refreshImpl, expireSession, handleEvent],
  );

  // Arranque en frío: ¿hay refresh_token en el Keychain/Keystore? → sesión silenciosa.
  useEffect(() => {
    (async () => {
      const rt = await loadRefreshToken();
      if (!rt) return setStatus('signedOut');
      try {
        await refreshImpl();
        log('ok', 'Sesión restaurada desde el enclave seguro');
        setStatus('signedIn');
      } catch (e: any) {
        if (e?.name === 'NetworkError') setBootNotice('No hay conexión con el servidor; tu sesión sigue guardada.');
        else await clearRefreshToken();
        setStatus('signedOut');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signIn = useCallback(async () => {
    setBootNotice(null);
    try {
      const t = await signInWithBrowser((s) => {
        setSignInStep(s);
        log('info', s);
      });
      await saveRefreshToken(t.refresh_token);
      setAccess(t.access_token, t.expires_in);
      log('ok', 'refresh_token guardado en Keychain/Keystore · access_token solo en RAM');
      setStatus('signedIn');
    } finally {
      setSignInStep(null);
    }
  }, [log, setAccess]);

  const signOut = useCallback(async () => {
    await clearRefreshToken();
    setAccess(null);
    setElevatedState(null);
    setStatus('signedOut');
    setEvents([]);
  }, [setAccess]);

  const forceExpireAccessToken = useCallback(() => {
    accessRef.current = 'eyJhbGciOiJIUzI1NiJ9.expirado.demo';
    setAccessExpiresAt(Date.now() - 1000);
    log('warn', 'Demo: access_token invalidado en RAM');
  }, [log]);

  const value: AuthValue = {
    status,
    accessExpiresAt,
    elevated,
    setElevated,
    events,
    log,
    api,
    signIn,
    signOut,
    forceExpireAccessToken,
    signInStep,
    bootNotice,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
