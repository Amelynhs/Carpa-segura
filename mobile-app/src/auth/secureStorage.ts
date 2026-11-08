/**
 * Enclave seguro: iOS Keychain (kSecClassGenericPassword) / Android Keystore,
 * a través de expo-secure-store. NUNCA AsyncStorage.
 */
import * as SecureStore from 'expo-secure-store';

const OPTS: SecureStore.SecureStoreOptions = {
  // Disponible solo con el dispositivo desbloqueado y sin migrar a otros dispositivos/backups.
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

const REFRESH_KEY = 'unisabana.refresh_token';
const ACCOUNTS_KEY = 'unisabana.totp.accounts';

export const saveRefreshToken = (t: string) => SecureStore.setItemAsync(REFRESH_KEY, t, OPTS);
export const loadRefreshToken = () => SecureStore.getItemAsync(REFRESH_KEY, OPTS);
export const clearRefreshToken = () => SecureStore.deleteItemAsync(REFRESH_KEY, OPTS);

export interface TotpAccount {
  id: string;
  issuer: string;
  label: string;
  secret: string; // Base32
}

export async function loadAccounts(): Promise<TotpAccount[]> {
  try {
    const raw = await SecureStore.getItemAsync(ACCOUNTS_KEY, OPTS);
    return raw ? (JSON.parse(raw) as TotpAccount[]) : [];
  } catch {
    return [];
  }
}

export const saveAccounts = (list: TotpAccount[]) =>
  SecureStore.setItemAsync(ACCOUNTS_KEY, JSON.stringify(list), OPTS);
