// Lanzador del backend. Se mantiene aparte de server.js para que arranque SIEMPRE,
// sin depender de comparar rutas (falla en Windows con espacios o parentesis en la carpeta).
import { networkInterfaces } from 'node:os';
import { CONFIG, createApp } from './server.js';

const VIRTUAL = /vmware|virtualbox|vbox|vethernet|hyper-v|wsl|docker|loopback|bluetooth|tailscale|zerotier/i;

function lanAddresses() {
  const out = [];
  for (const [name, list] of Object.entries(networkInterfaces())) {
    for (const a of list ?? []) {
      if (a.family !== 'IPv4' || a.internal) continue;
      const virtual = VIRTUAL.test(name) || a.address.startsWith('192.168.56.') || a.address.startsWith('169.254.');
      out.push({ name, address: a.address, virtual });
    }
  }
  return out.sort((x, y) => Number(x.virtual) - Number(y.virtual));
}

const server = createApp();

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n[ERROR] El puerto ${CONFIG.port} ya esta en uso. Probablemente ya hay un backend abierto.`);
    console.error('        Cierra la otra ventana del backend (o usa: set PORT=4001) e intenta de nuevo.\n');
  } else {
    console.error('\n[ERROR] No se pudo iniciar el backend:', err.message, '\n');
  }
  process.exit(1);
});

server.listen(CONFIG.port, '0.0.0.0', () => {
  console.log(`\n== backend-auth escuchando en el puerto ${CONFIG.port} (todas las interfaces) ==`);
  console.log(`   Usuario demo : ${CONFIG.user.email}  /  ${CONFIG.user.password}`);
  console.log(`   Semilla TOTP : ${CONFIG.totpSecret}   (pagina de enrolamiento: /mfa/setup)\n`);
  const lan = lanAddresses();
  if (lan.length === 0) {
    console.log('   [!] No detecte ninguna red. Conectate al WiFi.\n');
    return;
  }
  console.log('   Prueba DESDE EL NAVEGADOR DEL TELEFONO (misma WiFi):');
  for (const a of lan) {
    console.log(`     ${a.virtual ? '(virtual, ignorar) ' : '--> '}http://${a.address}:${CONFIG.port}/health   [${a.name}]`);
  }
  console.log('\n   Debe responder {"ok":true}. Deja esta ventana abierta.\n');
});
