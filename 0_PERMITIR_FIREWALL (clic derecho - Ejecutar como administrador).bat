@echo off
title Arreglar firewall
net session >nul 2>&1
if errorlevel 1 (
  echo.
  echo  Este archivo necesita ser ejecutado COMO ADMINISTRADOR.
  echo  Cierra esto, clic derecho sobre el archivo y elige "Ejecutar como administrador".
  echo.
  pause
  exit /b 1
)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0arreglar-firewall.ps1"
echo.
pause
