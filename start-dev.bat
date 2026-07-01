@echo off
cd /d "%~dp0"
echo Starting Health Quiz dev server...
echo.
node dist/server.mjs
pause
