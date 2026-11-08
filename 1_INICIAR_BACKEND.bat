@echo off
title Backend - La Carpa Segura
cd /d "%~dp0backend-auth"
node -v >nul 2>&1
if errorlevel 1 (
  echo.
  echo  Node.js no esta instalado. Instalalo desde https://nodejs.org y vuelve a abrir esto.
  echo.
  pause
  exit /b 1
)
node src\start.js
echo.
echo  El servidor se detuvo. Lee el mensaje de arriba.
pause
