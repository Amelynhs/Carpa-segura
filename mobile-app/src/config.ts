import { Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Linking from 'expo-linking';

/** true cuando la app corre dentro de Expo Go (no en un development build). */
const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

/**
 * URL del backend (puerto 4000). Prioridad:
 *   1) EXPO_PUBLIC_API_URL del archivo .env
 *   2) la IP del PC que sirve el bundle de Metro (la misma que escaneaste en el QR)
 *   3) 10.0.2.2 en emulador Android / localhost en simulador iOS
 */
const metroHost = Constants.expoConfig?.hostUri?.split(':')[0];
const fallback = Platform.OS === 'android' ? 'http://10.0.2.2:4000' : 'http://localhost:4000';
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? (metroHost ? `http://${metroHost}:4000` : fallback);

/**
 * Redirect del flujo OAuth.
 *  - Development build / app instalada: custom URL scheme del enunciado → unisabana-auth://callback
 *  - Expo Go: no registra esquemas propios, así que se usa el exp://IP:PUERTO/--/callback
 *    que Expo calcula solo (el backend permite el prefijo exp://).
 */
export const REDIRECT_URI =
  process.env.EXPO_PUBLIC_REDIRECT_URI ?? (isExpoGo ? Linking.createURL('callback') : 'unisabana-auth://callback');

/** Cliente público: NO existe client_secret en este código fuente (a propósito). */
export const CLIENT_ID = 'unisabana-mobile';

export const ACCESS_TTL_SECONDS = 5 * 60;
