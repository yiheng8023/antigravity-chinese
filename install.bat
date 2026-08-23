@echo off
chcp 65001 >nul 2>&1
echo.
echo ====================================================
echo   Antigravity 中文汉化与智能体插件套件安装器
echo   (Client Host UI Localization & Agent Plugin)
echo ====================================================
echo.
cd /d "%~dp0"

echo 🔍 正在检测 Antigravity 进程状态...
tasklist /FI "IMAGENAME eq Antigravity.exe" 2>NUL | find /I /N "Antigravity.exe">NUL
if "%ERRORLEVEL%"=="0" (
    echo ⚠️ 检测到 Antigravity 客户端正在运行中！
    echo ⚠️ 正在安全退出 Antigravity 进程以释放文件占用...
    taskkill /F /IM Antigravity.exe >nul 2>&1
    timeout /t 1 /nobreak >nul 2>&1
)

node cli.js install --with-plugin
echo.
pause
