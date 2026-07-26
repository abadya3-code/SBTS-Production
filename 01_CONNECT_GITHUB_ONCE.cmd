@echo off
setlocal
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp001_CONNECT_GITHUB_ONCE.ps1"
if errorlevel 1 pause
endlocal
