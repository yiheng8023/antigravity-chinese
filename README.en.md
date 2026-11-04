# Google Antigravity Chinese Localization

[简体中文](README.md) | [English](README.en.md) · [Release](https://github.com/yiheng8023/antigravity-chinese/releases/latest) · [CI](https://github.com/yiheng8023/antigravity-chinese/actions/workflows/ci.yml)

Source version **v3.3.35** targets **Antigravity App 2.29.0**. This community project provides local Chinese patches, backup and restore for the desktop app and VS Code extension, plus an optional Chinese interaction plugin.

This maintenance pass checks the [official changelog](https://antigravity.google/docs/changelog), handles the home greeting, version menu, automation empty state and related UI labels, and preserves the upstream ASAR unpacked layout. See the [2.29.0 maintenance record](docs/maintenance/antigravity-2.29.0.md) for evidence, validation and remaining gaps.

## Support and verification

| Surface | Implementation | Verified scope |
| --- | --- | --- |
| Antigravity App | ASAR preload, native menu/dialog text, versioned backup and restore | Windows 2.29.0 package-copy install/restore and live Home, version menu and Settings checks; additional Automation labels have regression coverage |
| VS Code extension | Manifest translation, local Webview proxy, separate backup/restore | 1.10.0 discovery and automated regressions; no live VS Code UI acceptance in this pass |
| Community Chinese plugin | Chinese interaction rules and maintenance diagnostics | Optional; not a Google official plugin |
| Standalone IDE and other IDE extensions | No dedicated localization installer | No adaptation claim |
| Antigravity CLI | Preserves upstream behavior | CLI binaries and terminal UI are unchanged |

macOS/Linux have cross-platform mock regressions, without live-client acceptance in this pass. Gradually rolled-out features depend on account availability. Static checks and candidate-string matches do not measure whole-product translation coverage.

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

`restore` attempts desktop and detected VS Code restoration and removes this project's global plugin. It fails when a valid pristine backup is unavailable. Keep installer-generated backups and reassess compatibility after official updates.

Custom targets:

```bash
node cli.js install --path "<installation directory or app.asar>"
node cli.js install:vscode --path "<extension directory>"
```

The installer preserves unpacked flags and compares external file contents before replacement. It aborts when a layout cannot be preserved safely. The desktop CLI uses ASAR; `core/cdp-client.js` is a separate protocol module for development integration.

## Development and maintenance

Edit dictionary sources under `dict/src/`. Both `dict/zh-CN.json` and `dist/zh-CN.bundle.json` are generated outputs.

```bash
npm run build:dict
# Run all automated tests (aggregating 10 test suites)
npm test
npm run audit
```

Tests cover DOM/code boundaries, golden translations, CDP, menus, ASAR, discovery, proofreading, VS Code and regression cases. Read current output for counts. CI covers Windows, macOS and Ubuntu with Node.js 18/20/22.

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

<p align="center">
  <a href="https://github.com/yiheng8023/antigravity-chinese/graphs/contributors">
    <img src="https://contrib.rocks/image?repo=yiheng8023/antigravity-chinese" alt="Contributors" />
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
