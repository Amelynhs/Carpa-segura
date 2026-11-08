# Resumen de cumplimiento — Guía de Laboratorio Sesión 14

Cada requisito del documento, dónde está implementado y cómo se comprobó.

**Leyenda:** ✅ implementado y probado automáticamente · 📱 implementado; se demuestra en el dispositivo (no se puede probar sin teléfono/emulador) · ⚠️ nota

---

## Punto 1 — OAuth 2.0 con PKCE (RFC 7636)

| Requisito del PDF | Implementación | Estado |
|---|---|---|
| `code_verifier` aleatorio, 43–128 caracteres URL-safe | `buildCodeVerifier`: 64 bytes del CSPRNG del SO → base64url = 86 caracteres (`primitives.ts`, `native.ts`) | ✅ prueba con 50 verifiers |
| `code_challenge` = SHA-256 en Base64URL **sin relleno** | `buildCodeChallenge` + `base64UrlEncode` | ✅ vector oficial del Apéndice B de RFC 7636 |
| Navegador del sistema; **prohibida** WebView | `WebBrowser.openAuthSessionAsync` (ASWebAuthenticationSession / Custom Tabs), `preferEphemeralSession` (`auth/oauth.ts`). No hay `react-native-webview` en el proyecto | 📱 |
| Deep linking con custom URL scheme | `"scheme": "unisabana-auth"` en `app.json`; redirect `unisabana-auth://callback` en development build. ⚠️ **Expo Go no puede registrar un esquema propio**: ahí el code llega por un segundo camino, el sondeo `POST /oauth/poll` ligado a PKCE (`pkceFlow.ts`) | ✅ ambos caminos probados contra el backend real · 📱 en teléfono |
| `state` aleatorio único; abortar si no coincide | `createState()` (24 bytes) + comparación en tiempo constante; lanza `OAuthStateMismatch` antes del intercambio | 📱 lógica revisada; backend devuelve el `state` intacto ✅ |
| Intercambio `code` + `code_verifier`; backend valida `SHA256(verifier) === challenge` | `POST /auth/oauth/token` (`server.js`); code de un solo uso, 120 s | ✅ e2e (éxito, verifier alterado → 400, code reutilizado → 400) |
| Sin `client_secret` en la app | No existe en el código fuente | ✅ |

## Punto 2 — Almacenamiento seguro y Silent Refresh

| Requisito | Implementación | Estado |
|---|---|---|
| `access_token` solo en memoria, 5 min | `useRef` en `AuthContext`; `expires_in = 300` | ✅ (TTL verificado e2e) |
| `refresh_token` en Keychain/Keystore, 30 días | `expo-secure-store`, `WHEN_UNLOCKED_THIS_DEVICE_ONLY` (`secureStorage.ts`); `refresh_expires_in = 2 592 000` | ✅ TTL · 📱 persistencia |
| Interceptor HTTP con cola | `createHttpClient` (`api/httpClient.ts`) | ✅ |
| 401 → encolar peticiones en vuelo | Todas esperan la misma promesa | ✅ prueba: 3 concurrentes |
| **Una única** petición `POST /auth/refresh` | Single-flight | ✅ `refreshCalls === 1` |
| Éxito → actualizar token, reintentar original, desbloquear cola | `refreshImpl` guarda el token en RAM y rota el refresh | ✅ las 3 reintentan con 200 |
| Refresh vencido/revocado → limpiar almacenamiento y navegar a bienvenida | `expireSession`: `clearRefreshToken()` + `status = signedOut` → `WelcomeScreen` | ✅ lógica · 📱 navegación |
| (extra) Peticiones que llegan *durante* la renovación esperan | Probado | ✅ |
| (extra) Sin red ≠ sesión vencida | `NetworkError` no borra tokens | ✅ |
| (extra) Rotación con detección de reutilización | Reusar un refresh viejo revoca la familia | ✅ e2e |

## Punto 3 — Authenticator propio, TOTP (RFC 6238)

| Requisito | Implementación | Estado |
|---|---|---|
| **Prohibidas** librerías TOTP (otplib, speakeasy…) | Ninguna en `package.json`. Todo el algoritmo está en `primitives.ts` | ✅ |
| `T = floor(unix / 30)` como entero de 64 bits Big-Endian (8 bytes) | `timeCounter`, `counterToBytes` | ✅ prueba |
| `H = HMAC-SHA1(clave, T)` | HMAC (RFC 2104) escrito a mano sobre SHA-1; solo el hash base viene de `expo-crypto` (permitido) | ✅ igual a `node:crypto` con claves de 1, 20, 64, 65 y 130 bytes |
| Truncamiento: `offset = H[19] & 0x0F`; `bin_code` con `& 0x7F`/`& 0xFF`; `% 1 000 000`; ceros a la izquierda | `dynamicTruncate` — fórmula del PDF, tal cual | ✅ 6 vectores oficiales RFC 6238 (8 y 6 dígitos); `081804` conserva el 0 |
| Decodificador Base32 | `base32Decode` (RFC 4648) | ✅ |
| Ingesta A: QR `otpauth://totp/…` con cámara | `ScannerModal` (`expo-camera`) + `parseOtpAuthUri` | ✅ parser con la URI exacta del PDF · 📱 cámara |
| Ingesta B: pegar semilla Base32 con validación | `AuthenticatorScreen` (valida alfabeto y longitud, rechaza duplicados) | ✅ lógica |
| Tipografía monoespaciada grande | 52 pt, `Menlo`/`monospace`, agrupado `054 231` | 📱 |
| Temporizador gráfico 30 → 0 que refresca el código solo | Anillo SVG + barra lineal; `useTotp` recalcula al cambiar la ventana, **conserva el código anterior hasta tener el nuevo** (sin parpadeo) | ✅ lógica · 📱 visual |
| 100 % offline / Modo Avión | Solo usa `Date.now()`; ninguna llamada de red en el cálculo | ✅ (sin `fetch` en `crypto/` ni `useTotp`) · 📱 demostración |
| Paridad con Google Authenticator | Mismos parámetros (SHA-1, 6 dígitos, 30 s) y vectores oficiales; app y backend producen idénticos códigos en 25 instantes distintos | ✅ matemática · 📱 comparación visual en vivo |
| (extra) «Rayos X» del algoritmo | Muestra T, HMAC de 20 bytes con los 4 bytes resaltados, offset, bin_code | 📱 |

## Punto 4 — Step-Up Authentication y Anti-Replay

| Requisito | Implementación | Estado |
|---|---|---|
| `GET /api/boveda-critica`: access estándar → `403 mfa_required` + `step_up_token` | `server.js` (también responde en `/api/boveda`, que el PDF menciona en el flujo) | ✅ e2e |
| `POST /auth/mfa/verify` con `step_up_token` + código de 6 dígitos | `server.js` | ✅ e2e |
| Ventanas C-1, C, C+1 | `matchWindow` (`totp.js`), comparación en tiempo constante | ✅ e2e |
| Caché Anti-Replay, TTL 90 s; reenvío → `409 Conflict: Replay Attack Detected` | `replayCache` por `usuario:código` | ✅ e2e (mismo código → 409, mensaje exacto) |
| `elevated_token` con `mfa_verified: true`, 10 min | `elevatedTtl = 600` | ✅ |
| App atrapa el 403, abre modal 2FA, ingresa TOTP, abre bóveda | `VaultScreen` + `StepUpModal` (teclado numérico) | 📱 |
| (extra) Anti fuerza bruta | 5 fallos/min → `429` | ✅ lógica |

## Sección 5 — Pruebas de aceptación (sustentación)

| # | Prueba | Cómo se cubre |
|---|---|---|
| 1 | OAuth + PKCE con navegador del sistema | Botón *Iniciar sesión*; bitácora muestra cada paso · 📱 |
| 2 | Paridad con Google Authenticator | Misma semilla en ambos · 📱 |
| 3 | Cálculo offline en Modo Avión | El contador llega a 0 y el código cambia sin red · 📱 |
| 4 | Step-Up y bóveda | *Abrir la bóveda* → 403 → modal → código → abierta · 📱 |
| 5 | Anti-Replay | Botón *Reenviar el código usado* → `HTTP 409 · Replay Attack Detected` · ✅ backend / 📱 UI |

## Sección 6 — Entregables y rúbrica

| Entregable | Estado |
|---|---|
| `/mobile-app` (React Native + Expo, TypeScript estricto) | ✅ |
| `/backend-auth` | ✅ ⚠️ ver nota 1 |
| `README.md` con pasos para backend, variables de entorno y app | ✅ |
| Video 60–90 s (opcional) | ⏭️ lo grabas tú con el guion del README |

| Criterio (peso) | Dónde se cubre |
|---|---|
| TOTP RFC 6238 (25 %) | `primitives.ts`, 8 pruebas, sin libs TOTP |
| OAuth + PKCE + deep link (25 %) | `oauth.ts`, `app.json`, `server.js` |
| Almacenamiento + Silent Refresh (20 %) | `secureStorage.ts`, `httpClient.ts`, `AuthContext.tsx` |
| Step-Up + Anti-Replay (15 %) | `server.js`, `VaultScreen.tsx`, `StepUpModal.tsx` |
| UI/UX y código limpio (15 %) | Tema pastel, Hermenegildo animado, contador visual, teclado numérico, TypeScript `strict`, módulos puros testeables |

---

## Notas honestas

1. **Backend sin Express.** El PDF dice «Node.js (Express)». Lo escribí con `node:http` + `node:crypto` (cero dependencias) porque así corre con solo `npm start` y es fácil de auditar. Las rutas y reglas son idénticas; si tu profesor exige Express, portar `handle()` a `app.get/post` es mecánico.
2. **No ejecuté la app en un teléfono ni emulador** (este entorno no tiene Expo ni red para instalar paquetes). Lo que sí verifiqué: 24 pruebas automáticas (7 backend + 17 app), `tsc --strict` sobre los módulos puros, y que los 22 archivos `.ts/.tsx` parsean sin errores. Las pantallas (`.tsx`) **no pasaron typecheck completo** por falta de las dependencias de Expo: ejecuta `npm run typecheck` y `npx expo run:android|ios` tras instalar, y dime si algo falla.
3. **Versiones de paquetes:** Expo SDK 58 (RN 0.88, React 19.3) según la documentación actual; los `expo-*` van como `"*"` y `npx expo install --fix` los fija a las versiones compatibles.
4. **Expo Go no sirve** para el deep link con custom scheme: se necesita un development build (README, sección 2).
5. **QR:** el backend entrega la URI `otpauth://` y la semilla, pero no dibuja el QR (sin librerías). Genera el QR desde esa URI con cualquier herramienta para la opción A.
