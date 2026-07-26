@echo off
cd /d "%~dp0"
git status
git remote -v
git log --oneline -5
pause
