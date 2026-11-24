@echo off
chcp 65001 >nul 2>&1
cd /d "%~dp0"

where node >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Node.js not found in PATH. Please install Node.js >= 18.
  pause
  exit /b 1
)

node cli.js manual-install
if errorlevel 1 (
  echo.
  echo [ERROR] Installation failed. Please inspect the log above.
)

echo.
pause
