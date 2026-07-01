@echo off
cd /d "%~dp0"
echo Running tests...
echo.
node tests/run-tests.mjs
pause
