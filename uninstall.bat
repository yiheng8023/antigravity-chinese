@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo 🔍 正在检测 Antigravity 进程状态...
tasklist /FI "IMAGENAME eq Antigravity.exe" 2>NUL | find /I /N "Antigravity.exe">NUL
if "%ERRORLEVEL%"=="0" (
    echo ⚠️ 检测到 Antigravity 客户端正在运行，正在安全退出以释放文件占用...
    taskkill /F /IM Antigravity.exe >nul 2>&1
    timeout /t 1 /nobreak >nul 2>&1
)

echo 正在卸载 Antigravity 汉化补丁与智能体插件...
node cli.js restore
echo.
pause
