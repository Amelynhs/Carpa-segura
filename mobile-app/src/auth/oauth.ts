/**
 * Enlace del flujo OAuth+PKCE (pkceFlow.ts) con el NAVEGADOR DEL SISTEMA:
 *   iOS     → ASWebAuthenticationSession
 *   Android → Custom Tabs
 * Prohibido (y ausente en este proyecto): WebView embebida.
 */
import * as WebBrowser from 'expo-web-browser';
import { API_URL, CLIENT_ID, REDIRECT_URI } from '../config';
import { createPkcePair, createState } from '../crypto/native';
import { runAuthorizationFlow, type BrowserResult, type TokenSet } from './pkceFlow';

WebBrowser.maybeCompleteAuthSession();

export { OAuthCancelled, OAuthStateMismatch, parseQuery, type TokenSet } from './pkceFlow';

export function signInWithBrowser(onStep?: (s: string) => void): Promise<TokenSet> {
  return runAuthorizationFlow({
    apiUrl: API_URL,
    clientId: CLIENT_ID,
    redirectUri: REDIRECT_URI,
    createPkcePair,
    createState,
    // preferEphemeralSession evita compartir cookies con Safari.
    openAuthSession: (url, redirect) =>
      WebBrowser.openAuthSessionAsync(url, redirect, { preferEphemeralSession: true }) as Promise<BrowserResult>,
    closeBrowser: async () => {
      try {
        (WebBrowser as any).dismissAuthSession?.();
      } catch {}
      try {
        await WebBrowser.dismissBrowser();
      } catch {}
    },
    onStep,
  });
}
