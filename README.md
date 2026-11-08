# 🎪 La Carpa Segura — Laboratorio de Seguridad Móvil

**Desarrollo Móvil (React Native) · Universidad de La Sabana · Sesión 14**
OAuth 2.0 + PKCE · Almacenamiento cifrado + Silent Refresh Queue · Authenticator TOTP propio (RFC 6238) · Step-Up 2FA + Anti-Replay

Hermenegildo, el payaso, custodia las llaves. 🤡

```
.
├── backend-auth/      Node.js, SIN dependencias (node:http + node:crypto)
│   ├── src/server.js  OAuth/PKCE, refresh rotatorio, Step-Up, Anti-Replay
│   ├── src/totp.js    RFC 6238 del lado servidor (ventanas C-1/C/C+1)
│   ├── src/jwt.js     JWT HS256 hecho a mano
│   ├── src/pages.js   Login y enrolamiento (navegador del sistema)
│   └── test/          7 pruebas end-to-end contra el servidor real
└── mobile-app/        React Native (Expo SDK 58) + TypeScript estricto
    ├── App.tsx
    ├── src/crypto/    primitives.ts (Base32, HMAC, TOTP, PKCE) · native.ts
    ├── src/api/       httpClient.ts (interceptor 401 + cola silenciosa)
    ├── src/auth/      AuthContext, oauth, secureStorage, useTotp, useAccounts
    ├── src/screens/   Welcome · Home · Authenticator · Vault · StepUpModal · Scanner
    ├── src/components Hermenegildo (SVG), CircusTent, PastelBackground, ui
    └── test/          17 pruebas (vectores oficiales RFC 6238 y RFC 7636)
```

## 1 · Backend

Requiere **Node ≥ 20**. No hay `npm install`: no usa paquetes externos.

```bash
cd backend-auth
npm start
```

Al arrancar imprime el usuario demo y la semilla TOTP:

| Dato | Valor por defecto | Variable de entorno |
|---|---|---|
| Usuario | `estudiante@unisabana.edu.co` | `DEMO_USER` |
| Contraseña | `Sabana2026!` | `DEMO_PASSWORD` |
| Semilla TOTP (Base32) | `JBSWY3DPEHPK3PXP` | `TOTP_SECRET` |
| Puerto | `4000` | `PORT` |
| Secreto de firma JWT | aleatorio en cada arranque | `JWT_SECRET` |
| Redirects permitidos | `unisabana-auth://,exp://` | `ALLOWED_REDIRECTS` |

> Si no defines `JWT_SECRET`, reiniciar el servidor invalida todas las sesiones (comportamiento útil en laboratorio).

**Enrolamiento del segundo factor:** abre `http://localhost:4000/mfa/setup`. Muestra la semilla Base32 y la URI
`otpauth://totp/UniSabana:estudiante@unisabana.edu.co?secret=JBSWY3DPEHPK3PXP&issuer=UniSabana`.
Pega la semilla en la app (opción B) y en Google Authenticator (*Introducir clave de configuración*). Para la opción A (cámara)
genera un QR a partir de esa URI con cualquier generador.

```bash
npm test   # 7 pruebas e2e: PKCE, refresh rotatorio, 403→TOTP→bóveda, 409 de replay
```

## 2 · App móvil

### Ruta rápida: Expo Go (Windows)

1. `0_PERMITIR_FIREWALL…bat` → clic derecho → **Ejecutar como administrador** (una vez; también elimina reglas que bloqueen `node.exe`).
2. `1_INICIAR_BACKEND.bat` → debe decir «escuchando en el puerto 4000» y listar tu IP. Déjalo abierto.
3. En el **navegador del teléfono** (misma WiFi) abre `http://<tu-IP>:4000/health` → debe responder `{"ok":true}`.
4. `2_INICIAR_APP_EXPO_GO.bat` → detecta tu IP solo, instala dependencias la primera vez y muestra el QR.
5. Escanea el QR con Expo Go. Si algo falla, `3_DIAGNOSTICO.bat` dice qué es.

No hay IP que editar: los `.bat` la detectan en cada arranque (ignorando las redes virtuales de VMware).

### Ruta completa (development build)

```bash
cd mobile-app
npm install
npx expo install --fix        # alinea las versiones de los paquetes expo-* con el SDK
cp .env.example .env          # y ajusta EXPO_PUBLIC_API_URL
```

### ⚠️ Development build, no Expo Go

El enunciado exige un **custom URL scheme** (`unisabana-auth://callback`). **Expo Go no registra esquemas propios**, así que
para probar el deep link real se necesita un development build:

```bash
npx expo run:android     # o: npx expo run:ios   (requiere Android Studio / Xcode)
npx expo start --dev-client
```

Alternativa rápida con Expo Go (solo desarrollo): define en `.env` `EXPO_PUBLIC_REDIRECT_URI=exp://<IP>:8081/--/callback`
(el backend ya permite `exp://`). Para la sustentación usa el development build.

### URL del backend según dónde corras la app

| Entorno | `EXPO_PUBLIC_API_URL` |
|---|---|
| Emulador Android | `http://10.0.2.2:4000` (por defecto) |
| Simulador iOS | `http://localhost:4000` (por defecto) |
| Teléfono físico | `http://<IP-LAN-de-tu-PC>:4000` (misma red WiFi) |

HTTP en claro está habilitado **solo para desarrollo** (`usesCleartextTraffic` / `NSAllowsLocalNetworking`). En producción: HTTPS.

```bash
npm test         # 17 pruebas: vectores RFC 6238 / RFC 7636, HMAC vs node:crypto, cola de refresh
npm run typecheck
```

## 3 · Guion de sustentación (5 min, 5 escenarios)

| # | Qué hacer | Dónde mirar |
|---|---|---|
| 1 | **Iniciar sesión** → se abre el navegador nativo, login con Hermenegildo, regresa por deep link | Inicio: *Bitácora de seguridad* («state validado», «refresh_token guardado en Keychain/Keystore») |
| 2 | Agrega la semilla en la app y en Google Authenticator | Tab *Authenticator*: mismos 6 dígitos al mismo tiempo |
| 3 | Activa **Modo Avión** y espera a que el contador llegue a 0 | El código cambia sin errores ni red; abre los *Rayos X* para mostrar HMAC, offset y bin_code |
| 4 | Tab *Bóveda* → **Abrir la bóveda** → 403 → modal 2FA → código → se abre | Bitácora: `403 … Step-Up requerido` → `elevated_token recibido` |
| 5 | En la bóveda abierta: **Reenviar el código usado** | `HTTP 409 · Replay Attack Detected` |

Extra para el criterio *Silent Refresh Queue*: Inicio → **1 · Vencer el access_token** → **2 · Disparar 3 peticiones**.
La bitácora muestra tres 401 en cola, **una sola** renovación y tres reintentos exitosos, sin cerrar sesión.

## 4 · Decisiones de seguridad

- **Cliente público:** no existe `client_secret` en el código de la app.
- **PKCE S256** únicamente; el backend rechaza `plain`, valida formato de `code_verifier` y compara en tiempo constante.
- **`state`** aleatorio por solicitud, comparado en tiempo constante; si no coincide, la app aborta antes del intercambio.
- **Authorization code** de un solo uso y 120 s de vida (se consume aunque el intercambio falle).
- **Entrega del code por dos caminos:** deep link (`unisabana-auth://` en development build) y, en Expo Go —que no puede registrar un esquema propio—, sondeo seguro `POST /oauth/poll` con `{state, code_verifier}`: el backend solo lo entrega a quien demuestre el verifier (PKCE) y una sola vez.
- **access_token** solo en RAM (5 min). **refresh_token** en Keychain/Keystore con `WHEN_UNLOCKED_THIS_DEVICE_ONLY` (30 días).
- **Refresh rotatorio** con detección de reutilización: si alguien presenta un refresh ya usado, se revoca toda la familia.
- **Silent Refresh Queue** single-flight; si no hay red, la sesión **no** se destruye.
- **TOTP:** HMAC-SHA1 y truncamiento dinámico implementados a mano; solo el hash SHA-1 base viene de `expo-crypto` (permitido por el enunciado).
- **Anti-Replay:** caché `usuario:código` con TTL de 90 s → `409`. Límite de 5 intentos fallidos por minuto → `429`.
- Comparaciones de código TOTP en tiempo constante en el backend.
