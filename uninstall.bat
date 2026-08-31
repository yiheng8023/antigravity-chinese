@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo 正在卸载 Antigravity 汉化补丁与智能体插件...
node cli.js restore
echo.
pause
