import { HERMENEGILDO_SVG } from './clown.js';

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const CSS = `
:root{--ink:#4a3f6b;--soft:#8c7fb0;--mint:#b9e6d3;--lav:#cdb4f6;--pink:#ffc2dc;--sky:#bfe3ff;--butter:#ffe8a3;--cream:#fff9f3}
*{box-sizing:border-box}
body{margin:0;min-height:100vh;display:grid;place-items:center;font-family:ui-rounded,"Nunito","Segoe UI",system-ui,sans-serif;color:var(--ink);
background:linear-gradient(160deg,#ffe3f0 0%,#e6dcff 45%,#d6f2ff 100%);overflow-x:hidden}
.cloud{position:fixed;background:#fff;border-radius:999px;opacity:.7;filter:blur(1px);animation:drift 22s linear infinite}
.cloud::before,.cloud::after{content:"";position:absolute;background:#fff;border-radius:50%}
.c1{width:150px;height:44px;top:9%;left:-200px}.c1::before{width:70px;height:70px;top:-34px;left:22px}.c1::after{width:52px;height:52px;top:-22px;left:76px}
.c2{width:120px;height:36px;top:70%;left:-160px;animation-duration:30s;animation-delay:-9s}.c2::before{width:56px;height:56px;top:-26px;left:18px}.c2::after{width:42px;height:42px;top:-16px;left:60px}
@keyframes drift{to{transform:translateX(calc(100vw + 400px))}}
.card{position:relative;width:min(92vw,420px);background:rgba(255,255,255,.82);backdrop-filter:blur(10px);border:3px solid #fff;border-radius:34px;
padding:92px 28px 30px;box-shadow:0 24px 60px -18px rgba(120,90,190,.45);margin-top:70px}
.clown{position:absolute;width:150px;left:50%;top:-84px;transform:translateX(-50%);animation:bob 3.2s ease-in-out infinite;filter:drop-shadow(0 8px 10px rgba(120,90,190,.25))}
@keyframes bob{50%{transform:translateX(-50%) translateY(-8px) rotate(2deg)}}
h1{font-size:22px;margin:0 0 4px;text-align:center}.sub{margin:0 0 18px;text-align:center;color:var(--soft);font-size:14px}
label{display:block;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;margin:14px 0 6px;color:var(--soft)}
input{width:100%;padding:14px 16px;border-radius:18px;border:2px solid #e8def9;background:var(--cream);font-size:16px;color:var(--ink);outline:none;transition:.2s}
input:focus{border-color:var(--lav);box-shadow:0 0 0 5px rgba(205,180,246,.35)}
button{width:100%;margin-top:22px;padding:15px;border:0;border-radius:20px;font-size:16px;font-weight:800;color:#fff;cursor:pointer;
background:linear-gradient(120deg,#c3a5f5,#ff9fc6);box-shadow:0 10px 22px -8px rgba(201,120,200,.7);transition:.2s}
button:active{transform:scale(.98)}
.err{background:#ffe1e8;color:#b0405f;border-radius:14px;padding:10px 14px;font-size:14px;margin-bottom:6px;text-align:center}
.pill{display:inline-block;padding:4px 12px;border-radius:999px;background:var(--mint);font-size:12px;font-weight:800;color:#3d7a63}
.mono{font-family:ui-monospace,Menlo,Consolas,monospace;word-break:break-all;background:var(--cream);border:2px dashed var(--lav);border-radius:16px;padding:12px;font-size:13px;margin:6px 0}
.btn{display:block;text-align:center;text-decoration:none;margin-top:22px;padding:15px;border-radius:20px;font-size:16px;font-weight:800;color:#fff;background:linear-gradient(120deg,#c3a5f5,#ff9fc6);box-shadow:0 10px 22px -8px rgba(201,120,200,.7)}
.foot{margin-top:18px;text-align:center;font-size:12px;color:var(--soft)}
`;

const shell = (title, body) => `<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><style>${CSS}</style></head>
<body><div class="cloud c1"></div><div class="cloud c2"></div><main class="card">${HERMENEGILDO_SVG}${body}</main></body></html>`;

export function loginPage(params, error) {
  const hidden = ['client_id', 'redirect_uri', 'state', 'code_challenge', 'code_challenge_method', 'response_type']
    .map((k) => `<input type="hidden" name="${k}" value="${esc(params[k])}">`)
    .join('');
  return shell(
    'Ingreso UniSabana',
    `<h1>¡Hola! Soy Hermenegildo 🎪</h1>
<p class="sub">Inicia sesión para continuar en la app. Este navegador es del sistema, tu contraseña nunca pasa por la app.</p>
${error ? `<div class="err">${esc(error)}</div>` : ''}
<form method="POST" action="/oauth/login">${hidden}
<label for="u">Correo institucional</label><input id="u" name="username" type="email" autocomplete="username" required placeholder="estudiante@unisabana.edu.co">
<label for="p">Contraseña</label><input id="p" name="password" type="password" autocomplete="current-password" required placeholder="••••••••">
<button type="submit">Entrar a la carpa ✨</button></form>
<p class="foot"><span class="pill">PKCE · S256</span> &nbsp;sin client_secret</p>`,
  );
}

export function setupPage({ secret, uri, issuer, account }) {
  return shell(
    'Enrolar TOTP',
    `<h1>Enrolar segundo factor</h1>
<p class="sub">Solo entorno de laboratorio. Pega la semilla en la app (opción B) o en Google Authenticator → «Introducir clave de configuración».</p>
<label>Cuenta</label><div class="mono">${esc(issuer)}:${esc(account)}</div>
<label>Semilla Base32</label><div class="mono">${esc(secret)}</div>
<label>URI otpauth (para generar un QR)</label><div class="mono">${esc(uri)}</div>
<p class="foot">Parámetros: SHA1 · 6 dígitos · 30 s</p>`,
  );
}

export const notFoundPage = shell('Carpa vacía', `<h1>Aquí no hay nada 🎈</h1><p class="sub">Ruta no encontrada.</p>`);

/**
 * Página puente tras el login correcto. Un 302 directo a un esquema propio (exp:// o unisabana-auth://)
 * lo bloquean o ignoran algunos navegadores; esta página redirige por JS Y ofrece un botón
 * (el toque del usuario cuenta como gesto y siempre puede abrir la app).
 */
export function bridgePage(url) {
  const js = JSON.stringify(url).replace(/</g, '\\u003c');
  return shell(
    'Volviendo a la app',
    `<h1>¡Listo, ya entraste! 🎉</h1>
<p class="sub">Tu sesión ya está lista. <b>Vuelve a la app</b> (botón «atrás» o cambiando de app): Hermenegildo la completa solo.</p>
<a id="go" class="btn" href="${esc(url)}">Volver a la app</a>
<p class="foot">El botón intenta abrir la app directamente; si tu navegador no lo permite, vuelve manualmente.</p>
<script>setTimeout(function(){location.href=${js}},300);</script>`,
  );
}
