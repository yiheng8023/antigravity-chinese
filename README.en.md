# Google Antigravity Chinese Localization

<p align="center">
  <a href="https://github.com/yiheng8023/antigravity-chinese/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/yiheng8023/antigravity-chinese/ci.yml?branch=main&amp;label=CI&amp;logo=github" alt="CI status"></a>
  <a href="https://github.com/yiheng8023/antigravity-chinese/releases/latest"><img src="https://img.shields.io/github/v/release/yiheng8023/antigravity-chinese?color=blue&amp;label=Release" alt="Latest release"></a>
  <a href="https://github.com/yiheng8023/antigravity-chinese/releases"><img src="https://img.shields.io/github/downloads/yiheng8023/antigravity-chinese/total?color=3388ff&amp;logo=github&amp;label=Asset%20downloads" alt="Release asset downloads"></a>
  <a href="https://github.com/yiheng8023/antigravity-chinese/stargazers"><img src="https://img.shields.io/github/stars/yiheng8023/antigravity-chinese?logo=github&amp;color=ffaa00" alt="GitHub stars"></a>
  <a href="https://github.com/yiheng8023/antigravity-chinese/network/members"><img src="https://img.shields.io/github/forks/yiheng8023/antigravity-chinese?logo=github&amp;color=grey" alt="GitHub forks"></a>
  <img src="https://img.shields.io/badge/Node.js-%3E%3D18-brightgreen?logo=node.js" alt="Minimum Node.js version is 18">
  <a href=".github/workflows/ci.yml"><img src="https://img.shields.io/badge/CI%20platforms-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey" alt="CI platforms are Windows, macOS, and Linux"></a>
  <a href="LICENSE"><img src="https://img.shields.io/github/license/yiheng8023/antigravity-chinese?color=green" alt="MIT license"></a>
</p>

<p align="center">
  <a href="README.md">简体中文</a> | <a href="README.en.md">English</a>
</p>

Source version **v3.3.59** targets **Antigravity App 2.34.0 / VS Code extension 1.13.0**. This community project provides local Chinese patches, backup and restore for the desktop app and VS Code extension, plus an optional Chinese interaction plugin.

This release applies the same translations for verified official plugin descriptions across project settings, unassigned conversation settings, the Marketplace, the Installed list, and plugin details in Antigravity App 2.34.0. Plugin names, custom content, and unmatched descriptions retain their original text. See the [2.34.0 maintenance record](docs/maintenance/antigravity-2.34.0.md) for UI and installation coverage and the [Linux portable installation record](docs/maintenance/linux-portable-install.md) for portable path support.

VS Code extension updates overwrite the local patch. After an extension update, rerun `node cli.js install:vscode` and reload the VS Code window.

## Support and verification

| Surface | Implementation | Verified scope |
| --- | --- | --- |
| Antigravity App | ASAR preload, native menu/dialog text, versioned backup and restore | Windows x64 2.34.0 install, reinstall, restore and unpacked file verification. See the portable installation record for the Linux x64 2.33.0 lifecycle. |
| VS Code extension | Manifest, native menu and notification translation, local Webview proxy, separate backup/restore | See the [1.13.0 maintenance record](docs/maintenance/antigravity-2.33.1.md) for Windows installation, restoration and UI checks. |
| Community Chinese plugin | Chinese interaction rules and maintenance diagnostics | Optional; not a Google official plugin |
| Standalone IDE and other IDE extensions | No dedicated localization installer | No adaptation claim |
| Antigravity CLI | Preserves upstream behavior | CLI binaries and terminal UI are unchanged |

Desktop 2.34.0 verification on an installed product covers Windows x64. macOS and Linux coverage for this release consists of automated regressions. Gradually rolled-out features depend on account availability. Static checks and candidate-string matches do not measure whole-product translation coverage.

## Installation and use

Requires Node.js **>=18** and npm/npx. Initial dependency or ASAR-tool installation may need network access. Save work and exit the client normally, then run from the repository:

```bash
npm install
node cli.js install
```

`install` detects the desktop app and VS Code extension and handles installed components. Windows users can run `install.bat`; macOS/Linux users can run `bash install.sh`. These wrapper scripts also install the optional community plugin.

```bash
node cli.js status
node cli.js install:vscode
node cli.js status:vscode
node cli.js restore:vscode
node cli.js install-plugin
node cli.js uninstall-plugin
node cli.js restore
node cli.js help
```

`restore` attempts desktop and detected VS Code restoration and removes this project's global plugin. With `--path`, it restores only the specified target. It fails when a valid pristine backup is unavailable. Keep installer-generated backups and reassess compatibility after official updates.

Custom targets:

```bash
node cli.js install --path "<installation directory or app.asar>"
node cli.js install:vscode --path "<extension directory>"
```

On Linux, the detector also looks under `~/Applications/Portable`, under `~/Applications`, and beside the toolkit checkout. It accepts `Antigravity`, `antigravity`, and the official extracted directory for the current architecture (`Antigravity-x64` or `Antigravity-arm64`). Pass `--path` to select a specific copy when several are installed.

```bash
bash install.sh --path "$HOME/Applications/Portable/Antigravity"
bash uninstall.sh --path "$HOME/Applications/Portable/Antigravity"
```

`install.sh` also installs the community plugin. To apply only the desktop patch to the selected copy, use `node cli.js install --path`. Restoration with `--path` applies only to the selected target.

The installer preserves unpacked flags and compares external file contents before replacement. It aborts when a layout cannot be preserved safely. The desktop CLI uses ASAR; `core/cdp-client.js` is a separate protocol module for development integration.

## Development and maintenance

Edit dictionary sources under `dict/src/`. Both `dict/zh-CN.json` and `dist/zh-CN.bundle.json` are generated outputs.

```bash
npm run build:dict
# Run all automated tests (aggregating 13 test suites)
npm test
npm run audit
npm run audit:ui -- --bundle <official-main.js>
```

Tests cover DOM/code and user-content boundaries, golden translations, CDP, menus, ASAR, discovery, proofreading, VS Code and regression cases. Read current output for counts. CI covers Windows, macOS and Ubuntu with Node.js 18/20/22.

Explicit content boundaries preserve message bodies, Markdown, file trees, path breadcrumbs, file references, project/conversation names and customization author content while fixed action buttons remain translated. See the [user-content boundary record](docs/maintenance/user-content-boundaries.md) and [customization content record](docs/maintenance/customization-content-boundaries.md) for evidence and validation scope.

For an official frontend bundle with known provenance:

```bash
npm run scan:drift -- "<frontend-bundle.js>" --report "<report.json>"
```

The tool also checks discovered local built-in skill and plugin descriptions. Its report contains heuristic summaries and samples. A missing bundle fails; coverage is unknown when no candidates exist. Live verification remains separate.

For every update, follow the [maintenance and release workflow](CONTRIBUTING.md#更新维护与发版): inspect official release notes, assess impact, fix as needed, align documentation, validate and read back the release. `AGENTS.md` and the community diagnostic skill point to that shared workflow.

`cli.js` manages lifecycle, `core/` holds runtime/protocol/extension/ASAR support, `tools/` builds and checks, `test/` covers regressions, and `docs/maintenance/` records evidence. See [SECURITY.md](SECURITY.md) and [CONTRIBUTING.md](CONTRIBUTING.md).

---

## 💖 Voluntary Sponsoring & Support

If the Antigravity Chinese Localization Toolkit has benefited your work and daily development, and you would like to support ongoing maintenance, documentation improvements, automated testing, and version updates, voluntary donations of any amount are deeply appreciated. Sponsorship is entirely voluntary and does not constitute any service-level agreement.

- **RMB Sponsorship**: Scan the WeChat Pay or Alipay QR codes below.
- **Cross-Border / Other Currencies**: Use our **[PayPal Sponsoring Link](https://www.paypal.com/ncp/payment/LNTF8KXGJXMZY)**. Accepted currencies, payment methods, and exchange rates are subject to PayPal's checkout page.

Please verify the payee name shown on the checkout page before confirming payment. Thank you for your support of open-source software!

<table>
  <tr>
    <td align="center"><strong>WeChat Pay (RMB)</strong><br><img src="docs/assets/sponsoring/wechat-pay.png" alt="WeChat Pay Donation QR Code" width="260"></td>
    <td align="center"><strong>Alipay (RMB)</strong><br><img src="docs/assets/sponsoring/alipay.png" alt="Alipay Donation QR Code" width="260"></td>
  </tr>
</table>

---

## 👥 Contributors

Heartfelt thanks to all developers who contribute code, report bugs, and improve translations and documentation!

- Thanks to **a705876883-arch** for proposing a fix for unintended translation of user content and supplying reproduction and regression cases. [PR #6](https://github.com/yiheng8023/antigravity-chinese/pull/6)
- Thanks to **[fansID512](https://github.com/fansID512)** for detailed environment information, reproduction steps and comparison observations that helped diagnose settings stutter. [Issue #8](https://github.com/yiheng8023/antigravity-chinese/issues/8)
- Thanks to **[MizuIro-H](https://github.com/MizuIro-H)** for reproducing the portable Linux detection problem on Bazzite, proposing a fix, and verifying installation. [Issue #9](https://github.com/yiheng8023/antigravity-chinese/issues/9)

<p align="center">
  <a href="https://github.com/yiheng8023/antigravity-chinese/graphs/contributors">
    <img src="https://contrib.rocks/image?repo=yiheng8023/antigravity-chinese" alt="Contributors" />
  </a>
  <a href="https://github.com/fansID512">
    <img src="https://avatars.githubusercontent.com/u/103017881?v=4" width="64" height="64" alt="fansID512 - bug reproduction and performance diagnosis" title="fansID512: bug reproduction and performance diagnosis" />
  </a>
  <a href="https://github.com/MizuIro-H">
    <img src="https://avatars.githubusercontent.com/u/123630455?v=4" width="64" height="64" alt="MizuIro-H - portable Linux reproduction and fix proposal" title="MizuIro-H - portable Linux reproduction and fix proposal" />
  </a>
</p>

---

## 📈 Star History & Community Growth

[![Star History Chart](https://api.star-history.com/svg?repos=yiheng8023/antigravity-chinese&type=Date)](https://star-history.com/#yiheng8023/antigravity-chinese&Date)

---

## ⚠️ Disclaimer & Compliance

1. **Non-Official Project**: This project is an independent open-source localization utility developed by the open-source community. It is **NOT** an official product of Google LLC and is neither affiliated with nor endorsed by Google LLC or its subsidiaries.
2. **Trademark Notice**: `Google`, `Google Antigravity`, `Gemini`, `Chrome`, and related trademarks, product names, and copyrights are the property of their respective owners.
3. **Authorized Personal Use**: This toolkit is provided solely for personal learning, technical research, and Chinese localization assistance. This project **DOES NOT** distribute any proprietary binary assets (such as official `app.asar` packages or source files); all patching operations are executed locally on the user's client machine.
4. **Security & Privacy**: This project contains **ZERO** telemetry reporting, network backdoors, or credential extraction mechanisms. All source code is 100% transparent and auditable.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
