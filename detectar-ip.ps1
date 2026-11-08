# Imprime la IPv4 de la red con salida a internet (la que tiene puerta de enlace), ignorando adaptadores virtuales.
$cfg = Get-NetIPConfiguration | Where-Object { $_.IPv4DefaultGateway -ne $null -and $_.NetAdapter.Status -eq 'Up' } | Select-Object -First 1
if ($cfg) { $cfg.IPv4Address[0].IPAddress }
