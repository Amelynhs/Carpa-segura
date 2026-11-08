@echo off
title Diagnostico
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0diagnostico.ps1"
pause
