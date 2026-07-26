@echo off
setlocal
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp002_PUSH_UPDATE.ps1"
if errorlevel 1 pause
endlocal
