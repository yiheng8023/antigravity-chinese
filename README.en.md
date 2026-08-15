# Google Antigravity Chinese Localization Toolkit

<p align="center">
  <a href="README.md">简体中文</a> | <a href="README.en.md">English</a>
</p>

A high-performance, non-invasive, self-healing Chinese localization patch and lifecycle manager designed for **Google Antigravity 2.0** desktop clients (Windows, macOS, and Linux).

---

## 🌟 Key Features

- **Non-invasive Runtime Engine**: Injects a responsive DOM translation engine at Electron's `preload` phase without modifying official core binaries.
- **Zero-FOUC Experience**: Synchronously mounts at 0ms of DOM rendering, completely preventing English-to-Chinese visual flicker.
- **Protected Code & Terminal**: Intelligently ignores code editing areas (`Monaco Editor`, `pre`, `code`) and terminal consoles (`xterm`), preserving user code and terminal commands.
- **Self-Healing & Auto-Persistence**: Built-in self-healing launcher and file watcher that automatically re-injects the patch in 0.5s after official upstream updates.
- **Multi-Sentence Compound Parsing**: Seamlessly breaks down multi-sentence paragraphs and translates cascading dynamic time/quota values.
- **100% Safe Backup & Instant Restore**: Automatically creates `app.asar.bak` on initial installation and restores official English status with one click.

## 📋 Prerequisites

Before installing the patch, make sure your environment meets the following requirements:

1. **Supported Operating Systems**:
   - **Windows**: Windows 10 / 11 (x64)
   - **macOS**: macOS 12+ (Apple Silicon M-series & Intel chips; automated `codesign` ad-hoc signing included)
   - **Linux**: Major distributions (Ubuntu, Debian, Fedora, Arch, etc., x64/ARM64)
2. **Node.js Runtime Environment**:
   - **Node.js (>= 16.x)** with `npx` / `npm` (required for unpacking and repacking the ASAR package).
   - Run `node -v` and `npx -v` in your terminal to verify. If not installed, download the LTS release from [Node.js Official Website](https://nodejs.org/).
3. **Google Antigravity Installed**:
   - Official **Google Antigravity 2.0** desktop client installed.
4. **⚠️ Critical Notice (Prevent File Lock Errors)**:
   - **Completely quit the Antigravity client before installing, updating, or restoring the patch** (right-click the system tray icon and select "Quit"). Otherwise, the OS will lock `app.asar`, causing `EPERM / EBUSY` errors.

---

## 🚀 Quick Start

### Method 1: Scripts (Recommended)

#### Windows
- **Install Patch**: Double-click [`install.bat`](file:///C:/Projects/antigravity-chinese/install.bat)
- **Self-Healing Launch**: Double-click [`launch.bat`](file:///C:/Projects/antigravity-chinese/launch.bat)
- **Restore English**: Double-click [`uninstall.bat`](file:///C:/Projects/antigravity-chinese/uninstall.bat)

#### macOS / Linux
- **Install Patch**: Run `./install.sh`
- **Restore English**: Run `./uninstall.sh`

---

### Method 2: CLI Manager

```bash
# Check client status
node cli.js status

# Install localization patch
node cli.js install

# Launch with automatic healing
node cli.js launch

# Background daemon watcher
node cli.js watch

# Restore official English version
node cli.js restore
```

---

## 💖 Sponsoring & Donation

If this project helps your daily workflow and you would like to support continuous maintenance, documentation, and automated tests, voluntary donations of any amount are deeply appreciated.

- **PayPal**: [PayPal Payment Link](https://www.paypal.com/ncp/payment/LNTF8KXGJXMZY)
- **WeChat Pay / Alipay (RMB)**: See QR codes below.

<table>
  <tr>
    <td align="center"><strong>WeChat Pay (CNY)</strong><br><img src="docs/assets/sponsoring/wechat-pay.png" alt="WeChat Pay QR Code" width="260"></td>
    <td align="center"><strong>Alipay (CNY)</strong><br><img src="docs/assets/sponsoring/alipay.png" alt="Alipay QR Code" width="260"></td>
  </tr>
</table>

---

## ⚠️ Disclaimer & Compliance

1. **Non-official Project**: This is an open-source community localization tool and is **NOT an official Google product**. It is not affiliated with or endorsed by Google LLC.
2. **Trademarks**: `Google`, `Google Antigravity`, `Gemini`, `Chrome`, and related trademarks belong to their respective owners.
3. **Legal Use**: This project **does not distribute** proprietary binaries (such as `app.asar` or decompiled sources). All modifications occur locally on the user's client.
4. **Privacy & Security**: Contains **zero telemetry, zero backdoors, and zero external credential collection**. 100% open-source and transparent.

---

## 📄 License

Distributed under the [MIT License](LICENSE).
