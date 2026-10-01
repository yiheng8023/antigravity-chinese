# Google Antigravity Chinese Localization Toolkit

<p align="center">
  <a href="https://github.com/yiheng8023/antigravity-chinese/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/yiheng8023/antigravity-chinese/ci.yml?branch=main&label=CI&logo=github" alt="CI Status"></a>
  <a href="https://github.com/yiheng8023/antigravity-chinese/releases/latest"><img src="https://img.shields.io/github/v/release/yiheng8023/antigravity-chinese?color=blue&label=Release" alt="Latest Release"></a>
  <a href="https://github.com/yiheng8023/antigravity-chinese/releases"><img src="https://img.shields.io/github/downloads/yiheng8023/antigravity-chinese/total?style=flat&color=3388ff&logo=github&label=Downloads" alt="Total Downloads"></a>
  <a href="https://github.com/yiheng8023/antigravity-chinese/stargazers"><img src="https://img.shields.io/github/stars/yiheng8023/antigravity-chinese?style=flat&logo=github&color=ffaa00" alt="GitHub Stars"></a>
  <a href="https://github.com/yiheng8023/antigravity-chinese/network/members"><img src="https://img.shields.io/github/forks/yiheng8023/antigravity-chinese?style=flat&logo=github&color=grey" alt="GitHub Forks"></a>
  <img src="https://img.shields.io/badge/Node.js-%3E%3D18.x-brightgreen?logo=node.js" alt="Node Version">
  <img src="https://img.shields.io/badge/Platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey" alt="Platform Support">
  <a href="LICENSE"><img src="https://img.shields.io/github/license/yiheng8023/antigravity-chinese?color=green" alt="License"></a>
</p>

<p align="center">
  <a href="README.md">简体中文</a> | <a href="README.en.md">English</a>
</p>

A high-performance, reversible Chinese localization patch and lifecycle manager designed for **Google Antigravity 2.0** desktop clients (Windows, macOS, and Linux), currently at version **v3.3.10** (fully adapted for Antigravity **v2.19.1**).

---

## 🌟 Key Features & Engineering Design

- 🚀 **Antigravity v2.19.1 Full Adaptation & New Features Localization**:
  - **Built-in Skill Extensions**: Publication-grade localization for 2.19.1 new built-in skills: `ui-extension` (Build, package, run, and debug UI extensions for interactive side-pane web panels) and `ui-plugin-navigation` (Discover UI plugin panels and surface one-click pill buttons).
  - **Aux Pane Goals Panel**: Native support for the brand new first-class `Goals` tab in the Aux Pane, seamlessly aligned with subagents, background tasks, artifacts, and modified files.
  - **Dynamic Execution Time Regex Group**: Introduced cascading regex patterns for agent runtime states: `Worked for ...` (worked for $1 s/m/h/d) and `Stopped after ...` (stopped after $1).
  - **Artifact & Document PDF Export**: Full support for new artifact action bar tools: `Export as PDF`, `Failed to print document:`, and `Download SVG`.
  - **Global Command Search & Indexing Alerts**: Updated palette placeholders (`Search tabs, files, plugins, subagents, artifacts, tasks...`, `Search file contents...`) and ongoing indexing notices.
  - **Notification Preferences & System Permissions**: Covered new notification preference dialogs (`Notification Preferences` & `Allow Gemini to notify you...`).
  - **Conversation Forking & Charting Guardrails**: Localized `Fork warning`, missing fork destination errors, and Mermaid empty pie chart exceptions.
  - **Channel Badges**: Supported titlebar and header release channel badges for `Insiders` and `Autopush`.

- 📝 **Selection Quote Toolbar Localization**:
  - Accurately captures floating action bars upon highlighting message text, resolving boundaries for isolated command keywords and shortcuts into canonical `引用 Ctrl+L`.
  - Multi-tier dictionary sources (`dict/src/`) and compilation pipelines fully aligned against regression.

- 🎯 **Model Selector Harmonization & CJK Spacing Guard**:
  - Publication-grade standard: Brand model names (`Gemini`, `Claude`, `GPT-OSS`) remain 100% authentic English proper nouns, while capability modifiers and status tags are completely harmonized into idiomatic Simplified Chinese (`Limited time` ➔ `限时`, `(Thinking)` ➔ `（思考）`, `(Medium)` ➔ `（中等）`, and sub-menu `低 / 中 / 高` tiers strictly aligned).
  - Deep support for dynamically fetched model quota descriptions ("Within each group, models share a weekly limit and a 5-hour limit...") and quota parameters.
  - Smart CJK typographic spacing guard prevents alphanumeric and Chinese characters from clumping together in selected model badges (e.g. `Gemini 3.8 Flash 高`).

- ⚡ **Dual-Mode Synergy Architecture**:
  - **Mode 1 (Deep ASAR Physical Injection)**: Deeply patches the ASAR archive for 100% native localization covering system tray (`tray.js`), menus (`menu.js`), and UI DOM.
  - **Mode 2 (Zero-Dependency CDP Hot-Mount)**: Custom-built 150-line native Node.js RFC 6455 protocol client; zero disk modifications, completely immune to upstream silent updates.
- 🐧 **WSL Cross-Platform Synergy**:
  - Deeply supports Windows clients connecting to WSL (Ubuntu, etc.) Linux environments.
  - Natively translates application menus `Connect to WSL` and `Reopen Locally`.
  - Injects translations for main-process dialogs, including missing WSL distros and cross-filesystem `/mnt` performance warnings.
- 🧩 **2.18.1 Full Feature Coverage, Inline DOM Reordering & 10 Plugins + 131 Skills**:
  - Complete localization for **2.18.1** modules: Trajectory Debug View (`Open Trajectory Debug View`), declared subagent permissions review modal (`declared-permissions-modal`), plugin OAuth authentication & customization token budget warnings, per-conversation telemetry toggles, enterprise billing model picker (`Select billing model`), built-in browser, and the full PDF Viewer toolbar.
  - Surgical healing for JSX composite alerts (e.g. `plan-command-fyi-alert`) and inline DOM sentence reordering (e.g. `Also includes <span>Global Permissions</span> when working in this project.` ➔ `在此项目中工作时，也包含全局权限。`), restructuring split text nodes into natural Chinese word order while preserving inline element event listeners.
  - Complete localization for baseline/model quota banners (`Baseline model quota reached`), AI Credits & Overages alerts (`Insufficient AI Credits`), and error notification cards, including multi-sentence splitting and full-width punctuation normalization after inline `<a>` links.
  - Comprehensive publication-grade translations for the 10 official plugins in `Build with Antigravity Plugins` (Android CLI, Chrome DevTools, Data Agent Kit, Dart and Flutter, Firebase, Gemini API, Google Maps Platform, Modern Web Guidance, Google Antigravity SDK, Science) and all **local & built-in `SKILL.md` / `agents` / `rules` descriptions** (including multi-line YAML `>-` / `|` block scalars).
- 🛡️ **Zero False-Positive Engine & Full-Sentence Conservation**:
  - Abolishes blind substring replacement (`phraseKeys`) and upgrades multi-sentence splitting to strict `allTranslated` conservation, eliminating half-English/half-Chinese hybrids and inflated coverage illusions.
  - Enforces `Object.prototype.hasOwnProperty` prototype guards (protecting against `toString` / `constructor` collisions) and strict hotkey parenthesis matching (preventing spaced descriptive parentheses from being misclassified as keyboard shortcuts).
- 🏗️ **Three-Tier Dictionary Compiler & Security Gates**:
  - Modularized source layout: `dict/src/core/` (atomic pure terms), `dict/src/rules/` (cascading regexes), `dict/src/ctx/` (context-scoped entries: `permissions.json`, `settings.json`, `plugins.json`).
  - Built-in **ASCII Key Barrier** (guards against Chinese intermediate key fragments), **Capture-Group Invariant Guard** (syntax compilation and `$1..$N` conservation), and **Duplicate Key Conflict Guard**, producing a unified `dist/zh-CN.bundle.json` with seamless backward compatibility.
- 🎯 **Single-Source Truth & Golden Snapshots**:
  - Core runtime extracts a stateless calculation factory `createI18nEngine` eliminating shadow duplicates across test suites and drift tools.
  - 209 comprehensive UI test cases verified via strict `assert.strictEqual` golden assertions, paired with 4 invariant fuzzing suites (thinking durations, reset countdowns, model interpolations, punctuation tolerances).
- **High-Performance Low-Overhead Runtime Architecture**: Eliminates uncontrolled `requestIdleCallback` spinning loops; introduces DOM negative-tag caching with `O(1)` instantaneous short-circuiting on unhit nodes; floating Portal filters and a 100ms throttle valve keep intensive streaming dialogues and virtual scrolling smooth and responsive.
- **Option Floating Tooltips & Delivery Strategies Coverage**: Fully covers dynamic floating tooltips across Settings (e.g. Queued Messages options: `Queue until after the current turn.` ➔ `排队等待，直至当前轮次结束。`, `Interrupt the agent and send immediately.` ➔ `打断智能体并立即发送。`), terminal auto-execution policies, artifact review policies, and Strict Mode descriptions.
- **Multi-TextNode Coalescing Self-Healing**: Resolves upstream React split-node fragmentations (e.g. `"All ", e, "s run as Flash."` split into sibling TextNodes causing plural suffix leftovers) with atomic full-sentence coalescence while strictly preserving virtual DOM node topology and reference integrity.
- **Protected Code & Terminal**: Intelligently ignores code editing areas (`Monaco Editor`, `pre`, `code`) and terminal consoles (`xterm`), strictly preserving user code and terminal commands.
- **Two-Phase Staged Swap, In-Session Staged Auto-Apply & Cold-Boot Crash Recovery**: Supports non-destructive pre-building (`app.asar.staged`) inside active Antigravity agent sessions with a detached background watcher that atomically swaps the archive within 0.3s of client exit; automatically detects and recovers orphaned swap files on cold boot.
- **Dual-State Baseline & Anti-Downgrade Circuit Breaker**: Automatically creates a pristine `app.asar.bak` baseline on initial installation and updates the baseline upon silent upstream updates; enforces circuit breakers during `restore` to prevent stale backups from overwriting newer official releases.
- **Graceful Yield to Upstream Chinese**: Built-in CJK character and native locale probes to automatically yield when official upstream Chinese lands.

---

## 📋 Prerequisites

Before installing the patch, make sure your environment meets the following requirements:

1. **Supported Operating Systems**:
   - **Windows**: Windows 10 / 11 (x64)
   - **macOS**: macOS 12+ (Apple Silicon M-series & Intel chips; automated `codesign` ad-hoc signing included)
   - **Linux**: Major distributions (Ubuntu, Debian, Fedora, Arch, etc., x64 / ARM64)
2. **Node.js Runtime Environment**:
   - **Node.js (>= 18.x)** with `npm` and `npx` (Fully compatible with Node 18/20/22/24+ LTS releases).
   - Run `node -v` and `npx -v` in your terminal to verify. If not installed, download the LTS release from [Node.js Official Website](https://nodejs.org/).
3. **Google Antigravity Installed**:
   - Official **Google Antigravity 2.0** desktop client installed.
4. **Automated Process Lock & Guard**:
   - Built-in cross-platform process guard automatically detects and safely releases client file locks during installation and restoration.

---

## 🚀 Quick Start

### Method 1: Scripts (Recommended for Daily Use)

#### Windows
- **Install Patch**: Double-click [`install.bat`](install.bat) (Runs pre-flight health check, safely releases file locks, and installs UI patch + community agent plugin)
- **Self-Healing Launch**: Double-click [`launch.bat`](launch.bat) (Auto-detects upstream updates, re-patches, and launches)
- **Restore English**: Double-click [`uninstall.bat`](uninstall.bat)

#### macOS / Linux
- **Install Patch**: Run `./install.sh`
- **Restore English**: Run `./uninstall.sh`

---

### Method 2: CLI Command Line Manager

```bash
# 1. Check current client and localization status
node cli.js status

# 2. Run comprehensive pre-flight health checks (Node version, NPX tools, ASAR path, file locks)
node cli.js check

# 3. One-click install (auto-backup and injection)
node cli.js install

# 4. Install Antigravity Chinese Agent Community Plugin
node cli.js install-plugin

# 5. Self-healing launch (auto-detects upstream updates, re-patches, and launches client)
node cli.js launch

# 6. Background watcher daemon mode (listens for upstream updates and auto-patches)
node cli.js watch

# 7. One-click restore to official English version
node cli.js restore

# 8. Specify custom installation path
node cli.js install --path "/path/to/antigravity/resources/app.asar"
```

---

## 🧪 Automated Testing & CI Verification

The project includes an exceptionally rigorous end-to-end regression test suite and cross-platform CI matrix (Windows / macOS / Ubuntu x Node 18/20) covering **370+ assertions**:

```bash
# Run all automated test suites (aggregating 8 full-fidelity test suites, 370+ assertions)
npm test
```

- **Dictionary Lint & Syntax Sanitization (`test/test-lint.js`)**: Validates dictionary JSON structure, formatting compliance, and syntax health.
- **DOM Translation & Performance Short-Circuiting (`test/verify.js`)**: Uses JSDOM to verify 118 assertions covering critical DOM paths, inline DOM reordering self-healing, false-positive prevention, Monaco Editor & terminal protection, zero-lag DOM negative-tag caching with O(1) short-circuiting, and floating Portal gate thresholds.
- **Single-Source Truth & Golden Snapshots (`test/test-screenshots.js`)**: Abolishes shadow implementations completely and directly taps into `createI18nEngine`, covering 209 real UI screenshot `assert.strictEqual` golden truth assertions, plus 4 invariant fuzzing categories (7 thought timing, 7 countdowns, 3 model interpolations, 3 punctuation shortcuts).
- **Zero-Dependency RFC 6455 CDP WebSocket Protocol Verification (`test/test-cdp.js`)**: Validates handshake authentication, frame encoding/decoding, JSON-RPC roundtrip communication, and graceful socket shutdown using pure Node.js built-in modules.
- **Menu, Tray & Suicide Prevention Gate (`test/test-menu-and-titles.js`)**: Ensures single-character words do not corrupt custom session titles, verifies main process system tray integration and native dialog safety, and tests suicide prevention gates in agent environments (`ANTIGRAVITY_AGENT=1` or `AGY_NO_KILL=1`).
- **ASAR Lifecycle & Upgrade Idempotence (`test/test-asar-lifecycle.js`)**: Builds real ASAR binary packages to test extraction, injection, double-install idempotence, upstream silent update anti-downgrade circuit breaker, two-phase staged rollback, and cold-boot crash recovery (31 full-fidelity assertions).
- **Live Path Detector (`test/test-detector-live.js`)**: Validates 0-argument system path detection on real Ubuntu / macOS / Windows runners.
- **Proofreading & Terminology Integrity (`test/test-proofread-integrity.js`)**: 11 assertions scanning all 3,283 exact entries and 320 cascade regexes for zero typos, full-width punctuation, standard CCF terminology, and safe regex compilation.

---

## 🔄 Self-Evolving Pipeline (Roadmap)

Facing frequent Antigravity updates, the core evolution direction is building a closed loop that automatically tracks upstream changes:

```mermaid
flowchart LR
    A[Upstream Update] -->|tools/drift-detector.js| B[800-Char Paragraph & YAML Skill Scan]
    B --> C[False-Positive Guard & New Phrase Detection]
    C -->|AI Context Translation| D[Generate Candidate Diff PR]
    D -->|npm test| E[Automated DOM & Regression Testing]
    E --> F[Human Review & Merge]
```

- **800-Char Paragraph & Multi-Line YAML Skill Scanner**: `npm run scan:drift` extracts long UI paragraphs up to 800 characters and parses both single-line and multi-line YAML (`>-` / `|`) skill descriptions across `~/.gemini/antigravity/builtin` and `~/.gemini/config/plugins`.
- **False-Positive Hybrid Guard (`[False-Positive Guard]`)**: Automatically intercepts any partially translated output containing 2+ consecutive untranslated English words, ensuring coverage metrics are 100% authentic.
- **Stale Rule Detection**: Identifies historical entries in the dictionary that are no longer observed upstream (`exactKeys - observed`), providing cleanup leads.
- **Reduced Maintenance Cost**: Replaces manual verification with automated diff extraction and regression testing.

---

## 🔌 Dual-Mode Architecture: Community Plugin Suite

In addition to the host UI localization patch, this project includes a complete **Chinese Agent Enhancement Plugin** compliant with Antigravity specifications (Plugin ID: `antigravity-chinese-toolkit`, located in [`plugins/chinese-toolkit/`](plugins/chinese-toolkit/)):

### Plugin Features
- **Interaction & Engineering Rules (`rules/chinese-interaction-rules.md`)**: Configures agents for complete Simplified Chinese thinking, comments, and terminology preservation.
- **I18n Diagnostics Skill (`skills/i18n-diagnostics/`)**: Equips agents with one-click health diagnosis, drift analysis (`scan:drift`), and test execution capabilities.

### Enabling the Plugin
- **One-click Global Install (Recommended)**: Run `node cli.js install-plugin` (or automatically via `install.bat`)
- **Manual Installation**: Copy `plugins/chinese-toolkit` to your global plugin directory:
  - Windows: `%USERPROFILE%\.gemini\config\plugins\chinese-toolkit`
  - macOS / Linux: `~/.gemini/config/plugins/chinese-toolkit`
  - *Note: Antigravity identifies the plugin by the `name` field in `plugin.json` (`antigravity-chinese-toolkit`), while the directory can be `chinese-toolkit`.*

---

## 📁 Repository Structure

```text
antigravity-chinese/
├── .github/
│   └── workflows/
│       └── ci.yml                    # Cross-platform CI automated test workflow (Ubuntu/macOS/Windows)
├── dict/                             # Translation dictionary and source modules
│   ├── src/                          # Three-tier modular dictionary source
│   │   ├── core/                     # Atomic phrases (common.json)
│   │   ├── rules/                    # Dynamic cascade regexes (patterns.json)
│   │   └── ctx/                      # Context-specific dictionaries (permissions.json, settings.json, plugins.json)
│   └── zh-CN.json                    # Core translation dictionary (3,283 exact entries + 320 regexes, backwards-compatible)
├── dist/                             # Automated compilation bundles
│   └── zh-CN.bundle.json             # Three-tier compiled distribution bundle
├── core/                             # Core injection & dual-mode engines
│   ├── i18n-runtime.js               # Zero-lag preload runtime engine (zero false-positives, inline DOM reordering & createI18nEngine)
│   └── cdp-client.js                 # Zero-dependency RFC 6455 CDP WebSocket client (no-unpack hot-mount protocol layer)
├── plugins/
│   └── chinese-toolkit/              # Antigravity official Chinese agent community plugin
│       ├── rules/                    # Agent Chinese interaction rules (chinese-interaction-rules.md)
│       ├── skills/                   # Localization diagnostic skills (i18n-diagnostics)
│       └── plugin.json               # Antigravity plugin manifest specification
├── test/                             # Automated full-fidelity regression test suites (8 suites, 370+ assertions)
│   ├── test-lint.js                  # Dictionary lint & syntax health checks
│   ├── verify.js                     # 118 JSDOM state machine, inline reordering, and runtime performance assertions
│   ├── test-screenshots.js          # 209 strictEqual golden truth assertions + 20 invariant fuzzing tests
│   ├── test-cdp.js                   # Zero-dependency RFC 6455 CDP protocol bidirectional tests
│   ├── test-menu-and-titles.js       # Menu items, tray integration, and suicide prevention gate assertions
│   ├── test-asar-lifecycle.js        # 31 ASAR lifecycle, staged rollback & cold-boot recovery assertions
│   ├── test-detector-live.js         # Real host system 0-argument path detection assertions
│   └── test-proofread-integrity.js   # Publication-grade typos, punctuation, terminology & regex safety checks
├── tools/                            # Compiler, reverse engineering, diff analysis & drift detection toolchain
│   ├── build-dict.js                 # Three-tier dictionary compiler (ASCII key gate & capture group conservation)
│   ├── drift-detector.js             # Upstream 800-char paragraph, YAML skill & false-positive drift detector (npm run scan:drift)
│   ├── build-full-dict.js            # Full dictionary automated builder and deduplication tool
│   └── gap-analysis.js               # Translation coverage gap & missed item automated analyzer
├── docs/assets/sponsoring/           # Sponsorship & community assets
├── cli.js                            # Cross-platform lifecycle CLI (detect, backup, extract, inject, pack, restore)
├── install.bat / install.sh          # One-click installation scripts (installs UI patch + community plugin)
├── launch.bat                        # Self-healing launcher (second-level drift check and launch)
├── uninstall.bat / uninstall.sh      # One-click restore scripts (safe anti-downgrade rollback)
├── package.json                      # Project configuration & npm scripts
├── LICENSE                           # MIT License
└── README.md / README.en.md          # Bilingual documentation
```

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
