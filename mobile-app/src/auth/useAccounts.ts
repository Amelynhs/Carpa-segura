import { useCallback, useEffect, useState } from 'react';
import { loadAccounts, saveAccounts, type TotpAccount } from './secureStorage';
import { base32Decode, isValidBase32, parseOtpAuthUri } from '../crypto/primitives';

/** Cuentas del Authenticator propio, persistidas en el enclave seguro. */
export function useAccounts() {
  const [accounts, setAccounts] = useState<TotpAccount[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    loadAccounts().then((a) => {
      setAccounts(a);
      setReady(true);
    });
  }, []);

  const persist = useCallback(async (next: TotpAccount[]) => {
    setAccounts(next);
    await saveAccounts(next);
  }, []);

  /** Opción A: contenido del QR (otpauth://…). Lanza Error con mensaje legible. */
  const addFromUri = useCallback(
    async (uri: string) => {
      const a = parseOtpAuthUri(uri);
      return add(a.issuer, a.label, a.secret);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [accounts],
  );

  /** Opción B: semilla Base32 pegada a mano, con validación. */
  const addFromSeed = useCallback(
    async (seed: string, issuer = 'UniSabana', label = 'Cuenta manual') => {
      return add(issuer, label, seed);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [accounts],
  );

  async function add(issuer: string, label: string, seed: string) {
    const secret = seed.toUpperCase().replace(/[\s=-]/g, '');
    if (!isValidBase32(secret)) throw new Error('La semilla debe ser Base32 (A–Z, 2–7) de al menos 16 caracteres');
    base32Decode(secret); // lanza si hay caracteres inválidos
    if (accounts.some((x) => x.secret === secret)) throw new Error('Esa semilla ya está registrada');
    const acc: TotpAccount = { id: `${Date.now()}`, issuer, label, secret };
    await persist([...accounts, acc]);
    return acc;
  }

  const remove = useCallback(
    (id: string) => persist(accounts.filter((a) => a.id !== id)),
    [accounts, persist],
  );

  return { accounts, ready, addFromUri, addFromSeed, remove };
}
