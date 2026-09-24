## 🚀 Google Antigravity 汉化工具包 v3.3.3 发布说明

本版本全面适配官方 **Google Antigravity 2.17.0** 突袭大版本跃升，重磅引入 **WSL 跨平台子系统双向桥梁汉化**、**2.17.0 复合 Alert 碎片化手术刀级自愈引擎**，并全量出版级收录官方 10 大插件生态全景说明。

---

### 🌟 核心更新与修复详情

1. **WSL 跨平台 Linux 运行环境全流程深度汉化**：
   - **原生应用菜单全覆盖**：适配原生菜单项 `Connect to WSL` ➔ **`连接到 WSL`**、`Reopen Locally` ➔ **`在本地重新打开`**。
   - **设置中心双向流转文案**：覆盖 `Windows Subsystem for Linux` ➔ **`Windows 的 Linux 子系统 (WSL)`**、`Run the app against a Linux environment...` ➔ **`在 Linux 环境中运行此应用。连接后将把应用重新启动到所选的 WSL 发行版中。`**、`Local Windows environment` ➔ **`本地 Windows 环境`**、`The app is currently connected to a WSL distro...` ➔ **`此应用当前已连接到 WSL 发行版。在本地重新打开将直接在 Windows 上重新启动该应用。`**。
   - **主进程与 IPC 弹窗无死角支持**：深度注入 WSL 发行版缺失警告（`WSL distro not found` ➔ **`未找到 WSL 发行版`**）以及跨系统 `/mnt` 路径性能告警（`Folder is on the Windows filesystem` ➔ **`文件夹位于 Windows 文件系统上`**、`This folder is on the Windows filesystem. Accessing it from WSL (via /mnt) can be slow...` ➔ **`此文件夹位于 Windows 文件系统上。从 WSL 访问该目录（通过 /mnt）可能会较慢 —— 为获得最佳性能，建议将项目保留在 WSL 文件系统内。`**）。

2. **2.17.0 复合 Alert 碎片化自愈引擎 (Composite Alert Healing)**：
   - **JSX 碎片拼接手术刀级自愈**：针对上游 2.17.0 全新 JSX 将单句大卸八块拆分为碎片化 TextNode（如 `plan-command-fyi-alert` 将 `Type`、`/`、`and select`、`plan`、`to have the agent generate a plan.` 拆散），引入特异性复合探针精准自愈，呈现无瑕中文：**`输入 / 并选择 plan 以让智能体生成计划。`**；彻底避免了全局单字 `Type` 污染表单字段类型（Type ➔ 类型）的语义风险。
   - **新手引导 NUX 卡片半英半中根除**：彻底解决服务端动态下发引导卡片的半英半中混淆问题：`Try 远程控制` / `Try Remote Control` ➔ **`体验远程控制`**，`Get Started` ➔ **`开始体验`**，以及正文 `Kick off work on your computer and continue working with your agents from your phone or another device...` ➔ **`在您的计算机上开启工作，并通过手机或其他设备继续与您的智能体协同。可在应用设置中开启远程控制。`**。
   - **自定义扩展 Token 超标告警**：精确汉化 `Customization token budget exceeded. Large customizations will be truncated.` ➔ **`已超出自定义扩展的 Token 预算。超长自定义项将被截断。`**，以及配套的 `Mcp Tools` ➔ **`MCP 工具`**。

3. **官方 10 大插件全景中文与自主模式特性全量收录**：
   - **官方 10 大插件描述出版级汉化**：涵盖 `Android CLI`（Android 应用核心开发工具）、`Chrome DevTools`（自动化与性能分析）、`Data Agent Kit`（Google Cloud 数据工程专家助手）、`firebase`、`flutter`、`Gemini API`（文本生成、多轮对话、流式与实时音视频）、`Google Antigravity SDK`、`Google Maps Platform`、`Modern Web Guidance`、`science` 等全套描述。
   - **内置技能与自定义智能体全套描述**：覆盖 `flutter_a11y_agent`（Flutter 无障碍审查）、`unibind-database`、`uniprot-database`、`uv`、`workflow-skill-creator`、`xcode-project-setup` 等全套描述。
   - **2.17.0 新功能特性覆盖**：收录自主模式激活提示（`Autonomous mode active...` ➔ **`自主模式已激活：智能体将独立工作，不会提问或请求新权限。`**）、Chrome DevTools 远程调试告警、Google3 项目弃用提示、分屏与工作区切换等全新 UI 文案。
   - **动态工具与会话计数正则**：覆盖 `2 tools enabled` ➔ **`已启用 2 个工具`**、`Plugin: science` ➔ **`插件: science`** 以及活跃/已归档会话计数。

4. **三层词库架构与质量门禁演进**：
   - 词库规模扩展至 **2,027 条精确词条 + 231 组动态级联正则**。
   - 100% 遵守纯 ASCII Key 阻断门禁、捕获组守恒定理（Capture-Group Invariant）与零错别字国家规范，无死角编译生成 `dist/zh-CN.bundle.json`。

5. **自动化测试套件全维扩充**：
   - `test-menu-and-titles.js` 扩展加入 WSL 菜单、IPC 警告、WSL 文件提示及复合 Alert DOM 自愈断言；
   - 8 大全真自动化测试套件 **350+ 项断言 100% 满血 PASS**。

---

### 📦 安装与升级

已安装用户可直接运行根目录更新：
```bash
node cli.js install
```
或通过一键脚本更新：
- **Windows**: 双击运行 `install.bat`
- **macOS / Linux**: 终端执行 `./install.sh`
