# Google Antigravity 中文汉化工具包 (Antigravity Chinese Toolkit)

<p align="center">
  <a href="README.md">简体中文</a> | <a href="README.en.md">English</a>
</p>

专为 **Google Antigravity 2.0** 桌面客户端（Windows / macOS / Linux）打造的高性能、非侵入式、全自动自愈中文本地化补丁与生命周期管理器。

---

## 🌟 核心特性与设计哲学

- **无侵入运行时注入 (Non-invasive Runtime Engine)**：通过 Electron `Preload` 挂载 DOM 级响应式汉化引擎，不破坏、不修改官方主程序核心二进制逻辑。
- **零闪烁体验 (Zero-FOUC)**：在页面 DOM 渲染第 0 毫秒同步挂载，杜绝从英文闪烁成中文。
- **保护用户代码与终端**：智能过滤并严格保护代码编辑区（`Monaco Editor` / `pre` / `code`）与终端控制台（`xterm`），确保代码和终端指令原汁原味，绝不误伤。
- **自愈与全自动持久化 (Self-Healing & Auto-Persistence)**：内置自愈启动器与文件守护机制，官方升级覆盖后 0.5 秒内自动重新注入，摆脱重复人工维护。
- **复合段落智能拆分 (Multi-Sentence Parsing)**：自动识别并拆解多句子复合段落，动态时间与用量百分比级联翻译，彻底告别“中英混合半生不熟”。
- **100% 安全备份与秒级还原**：首次安装自动生成 `app.asar.bak` 安全备份，随时一键还原官方纯英文初始状态。

## 📋 前置环境与要求 (Prerequisites)

在开始使用或安装汉化补丁前，请确保满足以下条件：

1. **操作系统支持**：
   - **Windows**：Windows 10 / 11 (x64)
   - **macOS**：macOS 12+（原生支持 Apple Silicon M系列及 Intel 芯片，首次注入自动完成 `codesign` 代码重签）
   - **Linux**：各大主流发行版（Ubuntu, Debian, Fedora, Arch 等 x64 / ARM64）
2. **Node.js 基础运行环境**：
   - 系统中需安装 **Node.js (>= 16.x)** 及随附的 **npm / npx** 工具（用于执行 ASAR 资源包的安全解构与重构）。
   - 验证方式：在终端运行 `node -v` 和 `npx -v` 确认输出版本号。若未安装，请前往 [Node.js 官方网站](https://nodejs.org/) 下载安装 LTS 版本。
3. **已安装 Antigravity 客户端**：
   - 确保本机已安装官方 **Google Antigravity 2.0** 客户端。
4. **⚠️ 关键操作须知（避免占用报错）**：
   - **在执行安装、还原或更新补丁前，请务必完全退出 Antigravity 客户端**（在系统右下角托盘图标右键选择“Quit / 退出”）。若程序在后台运行，操作系统会锁定核心文件导致报 `EPERM / EBUSY` 文件占用错误。

---

## 🚀 快速开始

### 方式一：一键脚本（推荐日常使用）

#### Windows
- **安装汉化**：双击运行 [`install.bat`](file:///C:/Projects/antigravity-chinese/install.bat)
- **自愈启动**：双击运行 [`launch.bat`](file:///C:/Projects/antigravity-chinese/launch.bat)（自动检测版本覆盖并重打补丁后拉起客户端）
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

## 📁 仓库结构

```text
antigravity-chinese/
├── dict/
│   └── zh-CN.json            # 汉化词典库（900+ 精确词条 + 级联正则规则）
├── core/
│   └── i18n-runtime.js       # 前端运行时注入引擎（Preload 挂载、防抖、代码区保护、多句拆分）
├── cli.js                    # 跨平台管理工具（路径探测、解包、注入、打包、还原、自愈启动、守护）
├── install.bat / install.sh  # 一键安装脚本
├── launch.bat                # 自愈启动脚本
├── uninstall.bat / uninstall.sh # 一键还原脚本
├── test/                     # 自动化端到端测试套件（JSDOM Mock / 54 项真实截图测试集）
├── docs/assets/sponsoring/   # 赞助与支持相关资产
├── package.json              # 项目配置
├── LICENSE                   # MIT 开源许可证
└── README.md                 # 说明文档
```

---

## 🛠️ 自定义词库扩展

如果你需要增加自定义翻译或修正词条，只需直接编辑 [`dict/zh-CN.json`](file:///C:/Projects/antigravity-chinese/dict/zh-CN.json)：
- `exact`：添加键值对 `"English": "中文"` 进行精准匹配。
- `patterns`：添加正则表达式规则应对动态时间、用量比例等文本。

编辑保存后，重新运行 `node cli.js install` 或双击 `install.bat` 即可立即生效。

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
