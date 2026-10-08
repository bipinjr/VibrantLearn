@echo off
REM VibrantLearn local demo. Double-click, or run from any IDE terminal.
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed. Get the LTS version from https://nodejs.org and run this again.
  pause
  exit /b 1
)
node scripts\start-demo.mjs %*
pause
