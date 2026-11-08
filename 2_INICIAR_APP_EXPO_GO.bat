@echo off
title App - Expo Go
cd /d "%~dp0mobile-app"
set LAN_IP=
for /f "usebackq delims=" %%i in (`powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0detectar-ip.ps1"`) do set LAN_IP=%%i
if "%LAN_IP%"=="" (
  echo.
  echo  No pude detectar la IP del WiFi. Conectate a una red e intenta de nuevo.
  echo.
  pause
  exit /b 1
)
echo.
echo  IP detectada automaticamente: %LAN_IP%
> ".env" echo EXPO_PUBLIC_API_URL=http://%LAN_IP%:4000
if not exist node_modules (
  echo  Instalando dependencias por primera vez. Tarda unos minutos...
  call npm install
  call npx expo install --fix
)
rem Fuerza la IP correcta para que el QR no use las redes virtuales de VMware.
set REACT_NATIVE_PACKAGER_HOSTNAME=%LAN_IP%
echo.
echo  Escanea el QR con Expo Go. Debe decir exp://%LAN_IP%:8081
echo  El telefono debe estar en la misma WiFi que este PC.
echo.
call npx expo start -c
pause
