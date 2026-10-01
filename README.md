# Google Antigravity 全生态中文本地化套件 (Antigravity Chinese Universal Suite)

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

专为 **Google Antigravity** 全生态（桌面客户端 2.0、独立 IDE 与第三方 IDE 扩展、CLI 命令行工具）打造的高性能、可逆式中文本地化套件与生命周期管理器（当前版本 **v3.3.14**，全面深度适配 Antigravity **v2.19.1** 升级）。

---

### 🌐 全生态多端矩阵支持状态 (Ecosystem Support Matrix)

| 生态终端形态 (Surfaces) | 定位与核心职责 | 中文化实现机制 | 当前支持状态 |
| :--- | :--- | :--- | :---: |
| 🖥️ **桌面客户端 (Desktop App 2.0)** | 独立 Electron 客户端，包含全局看板、白板与 Aux Pane | ASAR 深度注入 / CDP 免解包热挂载 + IPC 上下文菜单拦截 | 🟢 **100% 满血就绪** |
| 🧩 **IDE 扩展 (VS Code Extension)** | 嵌入宿主 IDE 的智能补全、命令、设置面板与侧边栏聊天 | `package.json` 映射 + Webview 本地微反向代理深度注入 | 🟢 **100% 满血就绪** |
| 💻 **第一方独立 IDE (Antigravity IDE)** | 基于 Code-OSS 深度定制的独立 AI-first IDE | 官方中文语言包适配 + 内置组件同源对齐 | 🟡 **架构对齐/弹性探测** |
| ⚡ **终端命令行 (Antigravity CLI `agy`)** | 极客终端交互与自动化批处理 | 遵循“输入英文，输出中文”准则，帮助手册与向导本地化 | 🟢 **规范确立/持续演进** |
| 🔌 **智能体插件与技能生态 (Plugins & Skills)** | 官方 10 大目录插件与 131 项 `SKILL.md` 描述 | 双源 YAML 与 JSDoc 出版级中文化 | 🟢 **100% 满血就绪** |

> [!NOTE] **多端解耦与弹性探测哲学 (Elastic Probing Guarantee)**：
> 本工具包遵循严格的“物理隔离与弹性探测”原则。若您本地仅安装了桌面客户端或 VS Code，安装脚本将仅精准对已安装的组件生效，未安装的环境（如第一方独立 IDE、JetBrains 等）将被自动静默跳过，绝不产生任何冲突、报错或副作用！

---

## 🌟 核心特性与设计哲学

- 🧩 **VS Code 官方扩展全景汉化与 Webview 深度注入闭环 (VS Code Extension Full Localization & Webview Proxy)**：
  - **统一一键全家桶安装**：无论双击根目录 [`install.bat`](install.bat) 还是运行 `node cli.js install`，安装器自动执行多端弹性探测，同步完成桌面客户端、官方智能体插件与 VS Code 扩展的全量汉化，绝不让用户在多个脚本间来回倒腾；
  - **攻克 Webview iframe 语言孤岛**：针对 VS Code 中 `Antigravity Settings` 设置面板与右侧侧边栏聊天窗口由后台 Language Server Webview iframe 渲染且无 Electron preload 注入的难题，自研极轻量本地反向代理（`agy-i18n-proxy.js`），在内存中动态挂载 `i18n-bundle.js`，实现设置面板与聊天界面 100% 原生纯中文；
  - **命令、配置与自定义编辑器 100% 出版级汉化**：全面汉化全部 10 项命令（`Add Selection to Chat` ➔ `将选中文本添加到对话`、`Accept All Changes` ➔ `接受所有更改`、`Open Antigravity Settings` ➔ `打开 Antigravity 设置` 等）、全部 9 项核心配置描述（后台服务器端口、内联差异 CodeLens、遥测、后台编辑自动接受等）及产物文档/设置查看器；
  - **双向原子还原与双重纯净备份**：自动生成 `package.json.bak` 与 `extension.js.bak` 双重纯净备份，配备专属脚本 [`install-vscode.bat`](install-vscode.bat) / `npm run install:vscode` 与 [`restore-vscode.bat`](restore-vscode.bat) / `npm run restore:vscode`，重复安装绝不污染官方备份，一秒无损回滚。

- 🖱️ **原生右键上下文与级联二级子菜单全景拦截 (Native Context Menu & Cascading Submenu Interception)**：
  - **操作系统级右键与级联子菜单 IPC 动态拦截**：针对左侧会话历史列表（`Rename`、`Mark Unread`、`Copy`、`Split`、`Archive`、`Delete`）与文本输入框上下文菜单（`Cut`、`Copy`、`Paste`、`Select All`）由 Electron 主进程原生创建（`Menu.buildFromTemplate`）且 DOM `MutationObserver` 无法触达的底层机制，在主进程 IPC 调度层（`ipcHandlers.js`）精准注入字典映射拦截器，原生右键一级菜单 100% 出版级汉化；
  - **多层级级联子菜单（Submenu）深度拓扑覆盖与全词库短语动态融合**：深度覆盖 `Copy` 二级子菜单（`Conversation Name` ➔ `会话名称`、`Conversation ID` ➔ `会话 ID`、`Project Name` ➔ `项目名称`、`Copy Relative Path` ➔ `复制相对路径`、`Copy Markdown` ➔ `复制 Markdown` 等）及 `Split` 二级子菜单（`Split Right` ➔ `向右拆分`、`Split Down` ➔ `向下拆分`、`Replace With New` ➔ `替换为新会话` 等），并在主进程初始化时自动动态融合全部 `<= 40` 字符的高频 UI 标签字典，彻底消除原生级联菜单任何漏项死角；
  - **Radix / Popper 悬浮气泡拓扑自适应**：重构 `core/i18n-runtime.js` 悬浮元素快速扫描门禁，深度兼容 `bA` / `cA` 高层级定位容器（`.animate-slideIn`、`[data-side]`、`[data-align]` 及 `z-[7000]`），并在 `pointerdown` / `contextmenu` 阶段瞬时触发捕获，彻底攻克代码与路径复制浮层气泡（`Copy` ➔ `复制`）遗留盲区；
  - **快捷键说明与动态长句覆盖**：收录快捷键面板副标题（`Keyboard shortcuts for quick navigation and control.`）及带动态邮箱的用户反馈长句（`Send feedback as ...`）。

- 🚀 **Antigravity v2.19.1 全景深度适配与全新特性汉化 (v2.19.1 Adaptation & New Features)**：
  - **内置技能扩展**：全量出版级深度汉化 2.19.1 全新引入的 `ui-extension`（构建、打包、运行与调试 UI 扩展，在侧边栏面板中渲染交互式 Web 面板）与 `ui-plugin-navigation`（UI 插件侧边栏面板导航与一键胶囊按钮）；
  - **右侧抽屉栏全新 Goals 目标面板**：原生适配 Aux Pane 全新第一级栏目 `Goals`（目标），与子智能体、后台任务、产物、修改文件平齐对齐；
  - **智能体工作耗时动态正则群**：引入 `Worked for ...`（已工作 $1 秒/分/时/天）与 `Stopped after ...`（在 $1 停止）多阶梯动态级联正则；
  - **产物与文档打印导出增强**：适配产物操作栏新增的 `Export as PDF`（导出为 PDF）、`Failed to print document:`（打印文档失败：）与 `Download SVG`（下载 SVG）；
  - **全局命令搜索与索引状态**：适配全局命令面板新 Placeholder `Search tabs, files, plugins, subagents, artifacts, tasks...`、`Search file contents...` 及搜索未完成索引提示；
  - **通知首选项与系统权限**：收录全新的通知偏好设置弹窗（`Notification Preferences` 与 `Allow Gemini to notify you...`）；
  - **对话派生警告与图表守卫**：适配 `Fork warning`（分支警告）、`The server returned no conversation to fork into` 及 Mermaid 饼图数据异常提示；
  - **版本频道标签**：适配标题栏与顶栏新增的 `Insiders`（体验版）与 `Autopush`（自动推送版）标识。

- 📝 **选中文本引用工具栏精准补齐 (Selection Quote Toolbar Localization)**：
  - 精准捕获会话选中文本时弹出的悬浮快捷工具栏，消除单字词与热键拆分边界盲区，规范中文化为 `引用 Ctrl+L`；
  - 词典分层源（`dict/src/`）与编译管线全链路闭环，防回滚、防覆盖。

- 🎯 **模型选择器规范化统一与中西文排版优化 (Model Selector Harmonization & CJK Spacing)**：
  - 坚持“模型原名归英文，功能状态归中文”的出版级规范：模型品牌原名（`Gemini`、`Claude`、`GPT-OSS`）100% 保持纯英文专有名词，能力修饰词与状态标签全量统一规范化中文化（`Limited time` ➔ `限时`，`(Thinking)` ➔ `（思考）`，`(Medium)` ➔ `（中等）`，二级菜单 `低 / 中 / 高` 严格对齐）；
  - 深度支持“模型与用量”动态网络拉取配额长篇说明（“在每个分组中，各模型共享周限额与 5 小时限额...”）及各维度限额状态；
  - 引入中西文混排“盘古之白”排版守卫，智能消除底栏选中模型与思考强度间的文字黏连（`Gemini 3.8 Flash 高`）。

- ⚡ **原生双模互补架构 (Dual-Mode Synergy Architecture)**：
  - **Mode 1（ASAR 深度持久化注入）**：通过 Electron ASAR 深度注入，实现系统托盘（`tray.js`）、主菜单（`menu.js`）、系统退出弹窗与界面 DOM 的 100% 原生全景汉化；
  - **Mode 2（零依赖 CDP 免解包热挂载）**：手搓 150 行原生 Node.js RFC 6455 协议客户端，免解包、0 磁盘修改、完全免疫上游静默更新覆写，随开随用。
- 🐧 **WSL 跨平台子系统全维适配 (WSL Cross-Platform Synergy)**：
  - 深度适配 Windows 客户端连接 WSL (Ubuntu 等) 运行环境全流程；
  - 原生支持应用菜单 `Connect to WSL`（连接到 WSL）/ `Reopen Locally`（在本地重新打开）；
  - 深度注入主进程 WSL 发行版缺失警告与跨系统 `/mnt` 路径性能告警弹窗，兼顾性能提示与无死角中文体验。
- 🧩 **2.18.1 全景特性覆盖、跨内联元素语序自愈与 10 大插件 + 131 项技能全景中文**：
  - 全面覆盖 **2.18.1** 新增模块：轨迹调试视图（`Open Trajectory Debug View`）、子智能体声明权限审查弹窗（`declared-permissions-modal`）、插件 OAuth 身份验证与自定义项 Token 预算超限降级告警、单会话遥测开关、企业计费模式选择器（`Select billing model`）、内置浏览器与 PDF 预览器全套工具栏；
  - 针对上游 JSX 碎片化 Alert（如 `plan-command-fyi-alert`）与跨内联元素断句（如 `Also includes <span>Global Permissions</span> when working in this project.`），通过复合节点探针与内联语序重排自愈，将倒装碎片原地重构为地道中文长句（`在此项目中工作时，也包含全局权限。`）并完整保留内联交互事件；
  - 彻底治愈基础模型/专属模型配额上限（`Baseline model quota reached`）、AI 积分不足（`Insufficient AI Credits`）、开启超额使用（`Overages`）及错误通知卡片的复合多句拼接与行内 `<a>` 链接尾部孤立句点全角化；
  - 全量出版级汉化官方 10 大插件目录（`Build with Antigravity Plugins`：Android CLI, Chrome DevTools, Data Agent Kit, Dart and Flutter, Firebase, Gemini API, Google Maps Platform, Modern Web Guidance, Google Antigravity SDK, Science）的双源简介，以及本机与内置全部 **`SKILL.md` / `agents` / `rules` 技能与子智能体说明**（包含多行 YAML `>-` / `|` 折叠块描述）。
- 🛡️ **假阳性零容忍引擎与全句守恒机制 (Zero False-Positive Engine & Full-Sentence Conservation)**：
  - 彻底废除传统的“短语子串暴力替换（`phraseKeys`）”，并将多句切分升级为 `allTranslated` 全句守恒模式，从根源上消灭“半英半中”残片与扫描覆盖率虚高假象；
  - 引入 `Object.prototype.hasOwnProperty` 原型链碰撞防护（安全处理 `toString` / `constructor` 等标识）与高精度快捷键括号边界识别（排除带空格普通英文括注被误判为快捷键）。
- 🏗️ **三层词库架构与自动化质量编译管线 (Three-Tier Compiler & Security Gates)**：
  - 词库源码彻底模块化分层：`dict/src/core/`（原子纯词条）、`dict/src/rules/`（级联规则）、`dict/src/ctx/`（特定上下文：`permissions.json`、`settings.json`、`plugins.json`）；
  - 配备 **ASCII Key 阻断门禁**（物理杜绝中文残片混入 Key）、**捕获组守恒门禁**（语法编译与 `$1..$N` 严格对齐）、**重复 Key 冲突守卫**，编译生成单一发布包 `dist/zh-CN.bundle.json` 并平滑向后兼容。
- 🎯 **真理单源解耦与黄金语义真断言 (Single-Source Truth & Golden Snapshots)**：
  - 核心运行时抽离无状态计算工厂 `createI18nEngine`，全仓消灭一切测试与工具中的影子副本；
  - 全量 209 项真实 UI 文本采用 `assert.strictEqual` 黄金语义真断言（杜绝 `res !== tc` 假阳性），并引入 4 大类（思考时间、模型配额倒计时、动态模型插值、标点快捷键容差）不变性模糊测试 (Invariant Fuzzing)。
- **低开销高响应渲染架构 (High-Performance Runtime Architecture)**：阻断 `requestIdleCallback` 无序自旋；引入 DOM 否定标记缓存，未命中节点二次扫描 `O(1)` 极速短路；悬浮 Portal 门禁与 100ms 节流阀，确保长对话消息流与高频虚拟滚动下保持平滑流畅。
- **深层选项悬浮气泡与执行策略全量覆盖 (Option Tooltips & Delivery Strategies)**：全量收录排队消息策略悬浮气泡提示（`Queue until after the current turn.` ➔ `排队等待，直至当前轮次结束。`、`Interrupt the agent and send immediately.` ➔ `打断智能体并立即发送。`）以及终端自动执行、产物审查模式、严格模式等深层选项的动态说明。
- **行内纯文本容器联合自愈 (Multi-TextNode Coalescing Self-Healing)**：针对上游 React 模板碎片化拆分（如 `"All ", e, "s run as Flash."` 拆分为多个兄弟 TextNode 导致英文复数残片），在保持虚拟 DOM 节点引用稳定不报错的前提下，整句提纯联合自愈。
- **用户代码与终端严格保护**：智能跳过代码编辑区（`Monaco Editor` / `pre` / `code`）与终端控制台（`xterm`），确保代码逻辑与命令行指令的原样性。
- **两阶段原子回滚、会话内无损预注入与冷启动自愈 (Two-Phase Staged Swap, Auto-Apply on Exit & Crash-Resilient Auto-Healing)**：支持在运行中的 Antigravity 智能体会话内直接预构建 `app.asar.staged` 并挂载后台静默守候进程，客户端关闭瞬间 0.3 秒内自动完成原子替换；若遭遇断电遗留孤儿暂存文件，CLI 启动入口自动识别并原子复原。
- **双重状态感知出厂基线与版本防回退 (Dual-State Baseline & Anti-Downgrade)**：首次注入时创建纯净备份；官方静默推送新版时自动刷新出厂基线，restore 还原时自动熔断拦截，彻底杜绝老旧备份覆盖官方新版导致的版本回退惨剧。
- **官方中文优雅让位 (Graceful Yield)**：内置 CJK 字符与官方语言环境自动探针，上游一旦上线官方中文自动主动让位，杜绝破坏。

---

## 📋 前置环境与要求 (Prerequisites)

在开始使用或安装汉化补丁前，请确保满足以下条件：

1. **操作系统支持**：
   - **Windows**：Windows 10 / 11 (x64)
   - **macOS**：macOS 12+（支持 Apple Silicon M系列及 Intel 芯片，首次注入自动处理 `codesign` 签名）
   - **Linux**：主流发行版（Ubuntu, Debian, Fedora, Arch 等 x64 / ARM64）
2. **Node.js 基础运行环境**：
   - 系统中需安装 **Node.js (>= 18.x)** 及附带的 **npm / npx** 工具（向下兼容 Node 18/20/22/24 等所有 LTS 版本）。
   - 验证方式：在终端运行 `node -v` 和 `npx -v`。若未安装，请前往 [Node.js 官方网站](https://nodejs.org/) 下载安装 LTS 版本。
3. **已安装 Antigravity 客户端**：
   - 确保本机已安装官方 **Google Antigravity 2.0** 桌面客户端。
4. **进程占用与文件锁守护**：
   - 安装器内置跨平台进程守护，执行安装时将自动检测并安全释放客户端文件锁。

---

## 🚀 快速开始

### 方式一：一键脚本（推荐日常使用）

#### Windows
- **安装汉化**：双击运行 [`install.bat`](install.bat)（自动执行前置健康预检、安全释放文件占用并一键双装客户端 UI 汉化 + 社区智能体插件）
- **自愈启动**：双击运行 [`launch.bat`](launch.bat)（自动检测版本覆盖并重新注入后启动）
- **恢复英文**：双击运行 [`uninstall.bat`](uninstall.bat)

#### macOS / Linux
- **安装汉化**：在终端运行 `./install.sh`
- **恢复英文**：在终端运行 `./uninstall.sh`

---

### 方式二：CLI 命令行管理器

```bash
# 1. 查看当前客户端及汉化状态
node cli.js status

# 2. 执行前置环境全维健康预检 (Node 弹性版本、NPX 工具、客户端路径与进程锁)
node cli.js check

# 3. 一键安装汉化（自动备份并注入）
node cli.js install

# 4. 安装 Antigravity 官方中文智能体插件
node cli.js install-plugin

# 5. 自愈启动（自动检测版本覆盖并重新注入后拉起客户端）
node cli.js launch

# 6. 后台守护模式（监听官方更新并自动完成重新汉化）
node cli.js watch

# 7. 一键还原回官方英文原版
node cli.js restore

# 8. 指定自定义客户端路径安装
node cli.js install --path "你的 Antigravity 安装目录或 app.asar 路径"
```

---

## 🧪 自动化测试与质量保证 (Testing & Verification)

本项目引入极其严苛的端到端自动化回归测试与跨平台 CI 矩阵（Windows / macOS / Ubuntu x Node 18/20），避免人工经验验证带来的遗漏：

```bash
# 运行全套自动化测试（聚合 9 大全真测试套件，共 390+ 项真理断言）
npm test
```

- **词库格式与语法排毒 (`test/test-lint.js`)**：检测词库 JSON 格式合规性与基础语法健康度。
- **核心 DOM 注入与性能短路断言 (`test/verify.js`)**：使用 JSDOM 模拟真实渲染环境，包含 118 项断言，验证关键 DOM 路径翻译准确性、跨内联元素语序重排自愈、半英半中假阳性阻断、Monaco Editor 与终端保护、零卡顿 DOM 否定标记短路与悬浮 Portal 门禁阈值。
- **真理单源黄金语义断言与不变性模糊测试 (`test/test-screenshots.js`)**：全仓废除影子复刻，直连核心 `createI18nEngine` 计算工厂，覆盖 209 项真实 UI 截图 `assert.strictEqual` 黄金语义真断言，外加 4 大类（思考时间 7 组、模型配额倒计时 7 组、动态模型插值 3 组、标点快捷键 3 组）不变性模糊测试 (Invariant Fuzzing)。
- **零依赖 RFC 6455 协议层双向握手与通信断言 (`test/test-cdp.js`)**：基于原生 Node.js 内置模块测试 RFC 6455 WebSocket 握手认证、数据帧编解码、JSON-RPC 往返通信及优雅挥手关闭。
- **菜单、托盘、原生上下文右键与自杀防御门禁 (`test/test-menu-and-titles.js`)**：严格确保单字词不误伤会话标题、主进程系统托盘协同注入、原生上下文右键菜单 IPC 拦截与原生退出确认弹窗安全，并在智能体会话（`ANTIGRAVITY_AGENT=1` 或 `AGY_NO_KILL=1`）下触发自杀防御门禁（拦截强杀宿主进程）。
- **ASAR 全真生命周期与防降级演进测试 (`test/test-asar-lifecycle.js`)**：真实打包生成 ASAR 二进制包，包含 31 项全真断言，验证解包、注入、二次安装幂等、官方静默推送防降级熔断、两阶段原子回滚以及冷启动断电崩溃自愈。
- **真实宿主无参路径探测实测 (`test/test-detector-live.js`)**：在真实 Ubuntu / macOS / Windows runner 上验证 0 参数自动路径探测。
- **出版级与学术级词库质检 (`test/test-proofread-integrity.js`)**：11 项断言全量扫描 3,287 条词条与 321 组级联正则，保障 0 错别字（登录/账号/其他/按钮等）、全角标点排版规范、CCF 核心计算机学术术语及正则表达式编译安全。
- **VS Code 扩展生命周期、Webview 代理与防污染测试 (`test/test-vscode-patch.js`)**：14 项断言覆盖扩展探测、首次注入、命令/配置/查看器全量汉化、Webview 本地微反向代理拦截注入、`i18n-bundle.js` 资产生成、二次安装双备份绝对防污染、以及原子还原全回归。

---

## 🔄 自动化演进：从“维护汉化”到“自我演化本地化系统”

面对 Antigravity 频繁的版本迭代，本项目演进的核心方向是**逐步建立能够自动跟随上游演化的工程闭环**：

```mermaid
flowchart LR
    A[上游版本更新] -->|tools/drift-detector.js| B[800字符长段落+YAML技能巡检]
    B --> C[半英半中假阳性拦截与新增短语识别]
    C -->|AI 上下文候选翻译| D[生成候选词典 Diff PR]
    D -->|npm test| E[自动化 DOM 与回归测试]
    E --> F[人工仅审查最终差异]
```

* **800 字符长段落 + 多行 YAML 技能描述全景扫描**：`npm run scan:drift` 支持高达 800 字符的 UI 长说明段落提取，并自动解析 `~/.gemini/antigravity/builtin` 与 `~/.gemini/config/plugins` 中全部 `SKILL.md` 的单行及多行 YAML（`>-` / `|`）描述。
* **半英半中假阳性拦截守卫 (`[False-Positive Guard]`)**：自动检测翻译输出中任何残留超过 2 个连续英文普通词汇的半成品残片，确保覆盖率指标 100% 真实无水分。
* **陈旧规则辅助排查**：反向检测当前词典中在新版本中未被观测到的历史词条（`exactKeys - observed`），为清理失效或被上游重构的词条提供线索。
* **逐步降低维护成本**：将原本繁琐的全量人肉核对，转变为由脚本提取差异、由 CI 自动化回归测试、维护者仅需对关键术语进行审查与确认的协作模式。

---

## 🔌 双模生态：Antigravity 社区智能体插件 (Community Plugin Suite)

除了作为客户端宿主 UI 汉化补丁运行外，本项目还内置了完全符合 Antigravity 插件规范的**全栈中文智能体增强插件**（插件注册 ID：`antigravity-chinese-toolkit`，仓库源码位于 [`plugins/chinese-toolkit/`](plugins/chinese-toolkit/)）：

### 插件功能特性
- **中文交互与工程规则 (`rules/chinese-interaction-rules.md`)**：规范智能体全流程简体中文思考、代码中文注释及严格的技术术语保留准则。
- **本地化诊断技能 (`skills/i18n-diagnostics/`)**：为智能体赋能一键状态诊断、版本漂移分析（`scan:drift`）与自动化测试能力。

### 启用插件方式
- **全局一键安装（推荐）**：运行 `node cli.js install-plugin`（执行 `install.bat` 时也会默认同步静默安装）
- **手动启用**：将 `plugins/chinese-toolkit` 目录复制至本地全局插件目录：
  - Windows: `%USERPROFILE%\.gemini\config\plugins\chinese-toolkit`
  - macOS / Linux: `~/.gemini/config/plugins/chinese-toolkit`
  - *注：Antigravity 识别插件注册名为 `plugin.json` 中的 `name` 字段（`antigravity-chinese-toolkit`），安装目录文件夹可为 `chinese-toolkit`。*

---

## 📁 仓库结构 (Repository Structure)

```text
antigravity-chinese/
├── .github/
│   └── workflows/
│       └── ci.yml                    # 全平台 CI 自动化测试流水线 (Ubuntu/macOS/Windows)
├── dict/                             # 汉化词库与分层源码
│   ├── src/                          # 三层分层词库源码
│   │   ├── core/                     # 原子纯词条 (common.json)
│   │   ├── rules/                    # 动态级联正则表达式 (patterns.json)
│   │   └── ctx/                      # 特定上下文 (permissions.json, settings.json, plugins.json)
│   └── zh-CN.json                    # 核心汉化词库 (3,283 精确词条 + 320 组级联正则，兼容同步)
├── dist/                             # 自动化构建编译产物
│   └── zh-CN.bundle.json             # 三层编译整合单一发布包
├── core/                             # 核心引擎与双模驱动
│   ├── i18n-runtime.js               # 零卡顿前端注入引擎 (假阳性零容忍、跨内联语序自愈、createI18nEngine 纯工厂)
│   └── cdp-client.js                 # 零依赖 RFC 6455 CDP WebSocket 客户端 (免解包热挂载协议层)
├── plugins/
│   └── chinese-toolkit/              # Antigravity 官方中文智能体增强插件
│       ├── rules/                    # 智能体中文交互规则 (chinese-interaction-rules.md)
│       ├── skills/                   # 本地化诊断技能 (i18n-diagnostics)
│       └── plugin.json               # 插件规范清单配置文件
├── test/                             # 自动化全真回归测试套件 (8 大套件 370+ 断言)
│   ├── test-lint.js                  # 词库格式与语法排毒校验
│   ├── verify.js                     # 118 项 JSDOM 状态机、内联语序重排与运行时性能断言
│   ├── test-screenshots.js          # 209 项 strictEqual 黄金语义真断言 + 20 项不变性模糊测试
│   ├── test-cdp.js                   # 零依赖 RFC 6455 CDP 协议层双向通信测试
│   ├── test-menu-and-titles.js       # 菜单项、托盘协同与自杀防御门禁断言
│   ├── test-asar-lifecycle.js        # 31 项 ASAR 生命周期、两阶段原子回滚与冷启动自愈断言
│   ├── test-detector-live.js         # 真实宿主系统 0 参数无参安装路径探测断言
│   └── test-proofread-integrity.js   # 出版级错别字、全角标点、学术术语与正则安全质检
├── tools/                            # 自动化编译、逆向与漂移检测工具链
│   ├── build-dict.js                 # 三层词典构建编译器 (ASCII Key 阻断、捕获组守恒门禁)
│   ├── drift-detector.js             # 上游 800 字符长段落 + YAML 技能与假阳性拦截检测器 (npm run scan:drift)
│   ├── build-full-dict.js            # 全量词典自动化去重与辅助工具
│   └── gap-analysis.js               # 覆盖率差量与漏项自动化分析器
├── docs/assets/sponsoring/           # 赞助与社区资产
├── cli.js                            # 跨平台生命周期管理 CLI (探测、备份、解包、注入、打包、防降级还原)
├── install.bat / install.sh          # 一键安装脚本 (默认双装 UI 补丁 + 官方插件)
├── launch.bat                        # 自愈启动脚本 (秒级自愈检测并拉起客户端)
├── uninstall.bat / uninstall.sh      # 一键还原脚本 (安全防降级出厂复原)
├── package.json                      # 项目配置与 npm scripts
├── LICENSE                           # MIT 开源许可证
└── README.md / README.en.md          # 中英双语说明文档
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

## 👥 贡献者墙 (Contributors)

诚挚感谢所有为本项目贡献代码、反馈 Bug、完善词库与文档的开发者们！

<p align="center">
  <a href="https://github.com/yiheng8023/antigravity-chinese/graphs/contributors">
    <img src="https://contrib.rocks/image?repo=yiheng8023/antigravity-chinese" alt="Contributors" />
  </a>
</p>

---

## 📈 Star 增长趋势与社区生态 (Star History)

[![Star History Chart](https://api.star-history.com/svg?repos=yiheng8023/antigravity-chinese&type=Date)](https://star-history.com/#yiheng8023/antigravity-chinese&Date)

---

## ⚠️ 免责声明与合规说明 (Disclaimer & Compliance)

1. **非官方项目**：本项目为社区发起的开源本地化辅助工具，**非 Google 官方产品**，与 Google LLC 及其关联公司无官方从属或背书关系。
2. **商标声明**：`Google`, `Google Antigravity`, `Gemini`, `Chrome` 等相关商标、产品名称及版权均归其各自所有者所有。
3. **合法使用**：本项目仅供个人学习、技术研究及中文本地化辅助使用。本项目**绝不分发**任何官方专有二进制资产（如 `app.asar` 或源码文件），所有修改均在用户本地客户端合法完成。
4. **安全与隐私**：本项目**绝不包含**任何形式的遥测上报、网络后门或用户凭据读取逻辑。代码 100% 开源透明。

---

## 📄 开源许可证

本项目基于 [MIT License](LICENSE) 协议开源。
