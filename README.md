# Google Antigravity 中文汉化工具包 (Antigravity Chinese Toolkit)

<p align="center">
  <a href="README.md">简体中文</a> | <a href="README.en.md">English</a>
</p>

专为 **Google Antigravity 2.0** 桌面客户端（Windows / macOS / Linux）打造的高性能、非侵入式中文本地化补丁与生命周期管理器。

---

## 🌟 核心特性与设计哲学

- **非侵入式运行时注入 (Non-invasive Runtime Engine)**：通过 Electron `preload` 阶段挂载响应式 DOM 翻译引擎，不修改主程序核心二进制文件。
- **预加载同步挂载 (Preload Hook)**：在渲染进程初始化阶段尽早介入，最大程度减少英文向中文的界面跳变。
- **用户代码与终端严格保护**：智能跳过代码编辑区（`Monaco Editor` / `pre` / `code`）与终端控制台（`xterm`），确保代码逻辑与命令行指令的原样性。
- **自愈启动与文件守护 (Self-Healing & Watcher)**：提供自愈启动器（`launch.bat`）与文件监听守护机制，上游更新覆盖后可自动检测并重新注入。
- **复合段落智能拆分 (Multi-Sentence Parsing)**：自动拆解多句子复合段落，支持动态时间与配额百分比的级联正则替换。
- **自动备份与可逆还原**：首次注入时自动创建 `app.asar.bak` 原生备份，随时可一键还原至官方纯英文初始状态。

---

## 📋 前置环境与要求 (Prerequisites)

在开始使用或安装汉化补丁前，请确保满足以下条件：

1. **操作系统支持**：
   - **Windows**：Windows 10 / 11 (x64)
   - **macOS**：macOS 12+（支持 Apple Silicon M系列及 Intel 芯片，首次注入自动处理 `codesign` 签名）
   - **Linux**：主流发行版（Ubuntu, Debian, Fedora, Arch 等 x64 / ARM64）
2. **Node.js 基础运行环境**：
   - 系统中需安装 **Node.js (>= 16.x)** 及附带的 **npm / npx** 工具（用于 ASAR 资源包解构与打包）。
   - 验证方式：在终端运行 `node -v` 和 `npx -v`。若未安装，请前往 [Node.js 官方网站](https://nodejs.org/) 下载安装 LTS 版本。
3. **已安装 Antigravity 客户端**：
   - 确保本机已安装官方 **Google Antigravity 2.0** 桌面客户端。
4. **⚠️ 关键操作须知（避免占用报错）**：
   - **在执行安装、还原或更新补丁前，请务必完全退出 Antigravity 客户端**（在系统右下角托盘图标右键选择“Quit / 退出”），以防止操作系统因文件锁定报 `EPERM / EBUSY` 占用错误。

---

## 🚀 快速开始

### 方式一：一键脚本（推荐日常使用）

#### Windows
- **安装汉化**：双击运行 [`install.bat`](file:///C:/Projects/antigravity-chinese/install.bat)
- **自愈启动**：双击运行 [`launch.bat`](file:///C:/Projects/antigravity-chinese/launch.bat)（自动检测版本覆盖并重新注入后启动）
- **恢复英文**：双击运行 [`uninstall.bat`](file:///C:/Projects/antigravity-chinese/uninstall.bat)

#### macOS / Linux
- **安装汉化**：在终端运行 `./install.sh`
- **恢复英文**：在终端运行 `./uninstall.sh`

---

### 方式二：CLI 命令行管理器

```bash
# 1. 查看当前客户端及汉化状态
node cli.js status

# 2. 一键安装汉化（自动备份并注入）
node cli.js install

# 3. 自愈启动（自动检测版本覆盖并重新注入后拉起客户端）
node cli.js launch

# 4. 后台守护模式（监听官方更新并自动完成重新汉化）
node cli.js watch

# 5. 一键还原回官方英文原版
node cli.js restore

# 6. 指定自定义客户端路径安装
node cli.js install --path "你的 Antigravity 安装目录或 app.asar 路径"
```

---

## 🧪 自动化测试与质量保证 (Testing & Verification)

本项目引入严格的端到端自动化回归测试与跨平台 CI，避免人工凭经验验证带来的遗漏：

```bash
# 运行全套自动化测试（包含核心功能、真实截图用例及菜单防误伤）
npm test
```

- **核心注入自查 (`test/verify.js`)**：使用 JSDOM 模拟真实渲染环境，验证 34+ 项关键 DOM 路径的翻译准确性与 Monaco Editor 代码保护。
- **真实截图用例集 (`test/test-screenshots.js`)**：覆盖 54+ 项来自真实界面截图的复合句子、动态限额与时间解析。
- **菜单与会话标题防误伤 (`test/test-menu-and-titles.js`)**：确保单字词不破坏用户自定义会话名称。
- **跨平台 CI 流水线**：在 GitHub Actions 中覆盖 Windows、macOS 与 Ubuntu 环境的持续自动化测试。

---

## 🔄 自动化演进：从“维护汉化”到“自我演化本地化系统”

面对 Antigravity 频繁的版本迭代，本项目演进的核心方向是**建立自动跟随上游演进的工程闭环**：

```mermaid
flowchart LR
    A[上游版本更新] -->|tools/drift-detector.js| B[自动检测 DOM / 文本漂移]
    B --> C[识别未翻译文本与失效规则]
    C -->|AI 上下文自动翻译| D[生成候选词典 Diff PR]
    D -->|npm test| E[自动化 DOM 与回归测试]
    E --> F[人工仅审查最终差异]
```

* **文本与 DOM 漂移检测**：通过 `npm run scan:drift` 自动扫描新旧版本之间的字符串差异。
* **规则防衰减 (Rule Decay Prevention)**：自动识别失效或被上游重构的旧规则。
* **人机协同维护**：日常由自动化管线完成 95% 的探测、翻译与测试，维护者只需把控最终关键术语差异。

---

## 📁 仓库结构

```text
antigravity-chinese/
├── dict/
│   └── zh-CN.json            # 汉化词典库（1000+ 精确词条 + 级联正则规则）
├── core/
│   └── i18n-runtime.js       # 前端运行时注入引擎（Preload 挂载、防抖、代码区保护、多句拆分）
├── cli.js                    # 跨平台管理工具（路径探测、解包、注入、打包、还原、自愈启动、守护）
├── install.bat / install.sh  # 一键安装脚本
├── launch.bat                # 自愈启动脚本
├── uninstall.bat / uninstall.sh # 一键还原脚本
├── test/                     # 自动化回归测试套件（JSDOM 模拟、截图用例、防误伤断言）
├── tools/                    # 文本提取、差量比对与漂移检测工具链
├── docs/assets/sponsoring/   # 赞助与支持相关资产
├── package.json              # 项目配置
├── LICENSE                   # MIT 开源许可证
└── README.md                 # 说明文档
```

---

## 💖 自愿赞助与支持

如果 Antigravity 中文汉化项目对你的开发工作有所帮助，并且你愿意支持本项目的持续维护、文档优化、自动化测试与版本迭代，诚挚感谢任意金额的自愿赞助。赞助完全自愿，不构成任何服务级承诺。

- **人民币赞助**：可扫描下方微信支付或支付宝收款码。
- **跨境赞助 / 其他币种**：可以使用 **[PayPal 赞助链接](https://www.paypal.com/ncp/payment/LNTF8KXGJXMZY)**。实际可用币种、付款方式与换汇以 PayPal 结算页为准。

付款前请核对结算页面显示的收款方。感谢你对开源项目的认可与支持！

<table>
  <tr>
    <td align="center"><strong>微信支付（人民币）</strong><br><img src="docs/assets/sponsoring/wechat-pay.png" alt="微信支付自愿赞助收款码" width="260"></td>
    <td align="center"><strong>支付宝（人民币）</strong><br><img src="docs/assets/sponsoring/alipay.png" alt="支付宝自愿赞助收款码" width="260"></td>
  </tr>
</table>

---

## ⚠️ 免责声明与合规说明 (Disclaimer & Compliance)

1. **非官方项目**：本项目为社区发起的开源本地化辅助工具，**非 Google 官方产品**，与 Google LLC 及其关联公司无官方从属或背书关系。
2. **商标声明**：`Google`, `Google Antigravity`, `Gemini`, `Chrome` 等相关商标、产品名称及版权均归其各自所有者所有。
3. **合法使用**：本项目仅供个人学习、技术研究及中文本地化辅助使用。本项目**绝不分发**任何官方专有二进制资产（如 `app.asar` 或源码文件），所有修改均在用户本地客户端合法完成。
4. **安全与隐私**：本项目**绝不包含**任何形式的遥测上报、网络后门或用户凭据读取逻辑。代码 100% 开源透明。

---

## 📄 开源许可证

本项目基于 [MIT License](LICENSE) 协议开源。
