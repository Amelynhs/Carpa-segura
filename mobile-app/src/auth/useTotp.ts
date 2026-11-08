import { useEffect, useRef, useState } from 'react';
import { generateTotp } from '../crypto/native';
import { TOTP_STEP_SECONDS, timeCounter } from '../crypto/primitives';

/**
 * Código TOTP vivo para una semilla. Solo usa el reloj local → funciona en Modo Avión.
 * `progress` va de 1 → 0 durante 30 s; al llegar a 0 el código se recalcula solo.
 * El código anterior permanece en pantalla hasta que el nuevo está listo (sin parpadeos).
 */
export function useTotp(secret: string | null) {
  const [code, setCode] = useState<string>('------');
  const [remaining, setRemaining] = useState(TOTP_STEP_SECONDS);
  const [progress, setProgress] = useState(1);
  const lastCounter = useRef<number>(-1);

  useEffect(() => {
    lastCounter.current = -1;
    if (!secret) return;
    let alive = true;

    const tick = () => {
      const now = Date.now();
      const counter = timeCounter(now / 1000);
      const intoWindow = (now / 1000) % TOTP_STEP_SECONDS;
      setProgress(1 - intoWindow / TOTP_STEP_SECONDS);
      setRemaining(Math.ceil(TOTP_STEP_SECONDS - intoWindow));
      if (counter !== lastCounter.current) {
        lastCounter.current = counter;
        generateTotp(secret, now)
          .then((c) => alive && setCode(c))
          .catch(() => alive && setCode('------'));
      }
    };
    tick();
    const id = setInterval(tick, 100);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [secret]);

  return { code, remaining, progress };
}
