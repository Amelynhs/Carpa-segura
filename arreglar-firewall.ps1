Write-Host ''
Write-Host '== 1) Reglas que BLOQUEAN node.exe (una regla de bloqueo gana sobre cualquier permiso) =='
$blocks = Get-NetFirewallApplicationFilter | Where-Object { $_.Program -like '*\node.exe' } | Get-NetFirewallRule | Where-Object { $_.Action -eq 'Block' }
if ($blocks) {
  $blocks | ForEach-Object { Write-Host (' - eliminando: ' + $_.DisplayName + ' (' + $_.Direction + ')'); Remove-NetFirewallRule -Name $_.Name }
} else { Write-Host ' ninguna encontrada' }

Write-Host ''
Write-Host '== 2) Creando permisos (todos los perfiles: Privado, Publico y Dominio) =='
Get-NetFirewallRule -DisplayName 'lab-*' -ErrorAction SilentlyContinue | Remove-NetFirewallRule
New-NetFirewallRule -DisplayName 'lab-backend-4000' -Direction Inbound -Action Allow -Protocol TCP -LocalPort 4000 -Profile Any | Out-Null
New-NetFirewallRule -DisplayName 'lab-metro-8081' -Direction Inbound -Action Allow -Protocol TCP -LocalPort 8081-8082 -Profile Any | Out-Null
$node = (Get-Command node -ErrorAction SilentlyContinue).Source
if ($node) {
  New-NetFirewallRule -DisplayName 'lab-node-programa' -Direction Inbound -Action Allow -Program $node -Profile Any | Out-Null
  Write-Host (' permitido: ' + $node)
} else { Write-Host ' [!] node no esta en el PATH: instala Node.js desde https://nodejs.org' }
Write-Host ' permitidos: puerto 4000 (backend) y 8081-8082 (Expo)'

Write-Host ''
Write-Host '== 3) Perfil de tus redes =='
Get-NetConnectionProfile | Format-Table Name, InterfaceAlias, NetworkCategory -AutoSize
Write-Host 'Listo. Ahora abre 1_INICIAR_BACKEND.bat y prueba desde el telefono.'
