Write-Host ''
Write-Host '=== DIAGNOSTICO ==='
$ver = (node -v) 2>$null
if ($ver) { Write-Host ('[OK] Node.js ' + $ver) } else { Write-Host '[X] Node.js NO esta instalado (https://nodejs.org)' }

$ip = & "$PSScriptRoot\detectar-ip.ps1"
if ($ip) { Write-Host ('[OK] IP del WiFi detectada: ' + $ip) } else { Write-Host '[X] No hay red con puerta de enlace: conectate al WiFi' }

$l = Get-NetTCPConnection -LocalPort 4000 -State Listen -ErrorAction SilentlyContinue
if ($l) { Write-Host '[OK] Hay algo escuchando en el puerto 4000' } else { Write-Host '[X] NADA escucha en el puerto 4000: abre 1_INICIAR_BACKEND.bat y lee su mensaje' }

try { $r = Invoke-WebRequest -UseBasicParsing -TimeoutSec 4 'http://localhost:4000/health'; Write-Host ('[OK] localhost responde: ' + $r.Content) } catch { Write-Host '[X] localhost:4000 no responde: el backend no esta corriendo' }
if ($ip) { try { $r = Invoke-WebRequest -UseBasicParsing -TimeoutSec 4 ('http://' + $ip + ':4000/health'); Write-Host ('[OK] ' + $ip + ' responde desde este PC: ' + $r.Content) } catch { Write-Host ('[X] ' + $ip + ':4000 no responde desde este PC') } }

$b = Get-NetFirewallApplicationFilter | Where-Object { $_.Program -like '*\node.exe' } | Get-NetFirewallRule | Where-Object { $_.Action -eq 'Block' -and $_.Enabled -eq 'True' }
if ($b) { Write-Host '[X] HAY reglas de firewall que BLOQUEAN node.exe: ejecuta el .bat 0_ como administrador' } else { Write-Host '[OK] Ninguna regla bloquea node.exe' }

Write-Host ''
Get-NetConnectionProfile | Format-Table Name, InterfaceAlias, NetworkCategory -AutoSize
Write-Host '--------------------------------------------------------------'
Write-Host 'PRUEBA FINAL (la unica que cuenta): en el NAVEGADOR DEL TELEFONO, con el mismo WiFi, abre:'
if ($ip) { Write-Host ('    http://' + $ip + ':4000/health') }
Write-Host 'Si responde {"ok":true} todo esta bien. Si no carga y arriba todo es [OK],'
Write-Host 'el router aisla los dispositivos: usa el hotspot del telefono (conecta el PC a el).'
Write-Host ''
