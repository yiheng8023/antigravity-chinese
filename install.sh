#!/bin/bash
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"

if pgrep -i "Antigravity" > /dev/null 2>&1; then
    echo "⚠️ 检测到 Antigravity 客户端正在运行中..."
    echo "⚠️ 正在安全退出 Antigravity 进程以释放文件占用..."
    killall Antigravity > /dev/null 2>&1 || pkill -i Antigravity > /dev/null 2>&1 || true
    sleep 1
fi

node "$DIR/cli.js" install --with-plugin
