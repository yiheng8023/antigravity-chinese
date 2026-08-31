@echo off
chcp 65001 >nul 2>&1
echo.
echo ====================================================
echo   Antigravity 中文汉化与智能体插件套件安装器
echo   (Client Host UI Localization & Agent Plugin)
echo ====================================================
echo.
cd /d "%~dp0"

node cli.js install --with-plugin
echo.
pause
