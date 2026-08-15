@echo off
chcp 65001 >nul
echo 正在启动 Antigravity 汉化还原程序...
node "%~dp0cli.js" restore
pause
