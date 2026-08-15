@echo off
chcp 65001 >nul 2>&1
echo.
echo ==========================================
echo   Antigravity 汉化补丁 v3.0 安装器
echo   (修复了点设置卡死的致命 bug)
echo ==========================================
echo.
cd /d "%~dp0"
node cli.js install
echo.
pause
