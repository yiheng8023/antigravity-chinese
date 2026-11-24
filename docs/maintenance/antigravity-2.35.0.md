# v3.4.0 适配 Antigravity App 2.35.0

2026-11-23 在 Windows 11 x64 核对到本机官方安装的桌面程序与 ASAR 均为 **2.35.0**。由于本机尚未安装任何历史汉化补丁，本次以原生 2.35.0 的 `app.asar` 与从 `language_server.exe` 内嵌静态 ZIP 提取的前端资源为直接校对与验证基准。

- 官方原版 `app.asar` 大小为 6,729,546 字节，SHA-256 为 `99ff7f6cf1219f46c8437df65ca866e384836b5230adba8efd91b3152f823e15`，包含 790 个打包文件与 377 个外置文件。
- 提取的前端 `main.js` 大小为 12,798,818 字节，SHA-256 为 `f039eca519f153aeac9a0f1d10abc7afd8ff4b8009ef78d684669a3c7955f54d`。
- 官方更新日志 `https://antigravity.google/docs/changelog` 暂未公开列出 2.35.0 的完整条目，故本次变更新增项以本机官方实包二进制及前端源码提取结果为准。

## 主要变化与适配处理

| 模块 / 变化面 | 本版处理 |
| --- | --- |
| 设置与浏览器隐私 | 补齐通用、外观、浏览器、自定义扩展、应用与账号中的新增设置标签及长描述（含防休眠、菜单栏常驻、自动更新提示、浏览器浏览数据与按站点 Cookie 清理弹窗、内置浏览器右键菜单等）。 |
| 模型、配额与插件权限 | 补齐模型选择、编排器模型选择、AI 额度超额抵扣、插件权限、Build With Google 插件、管理钩子、市场分类（上下文限定翻译）与无应用状态文案。 |
| 侧栏、旁路提问与引导 | 适配新版侧栏定制（收件箱模式、分组/排序锁定提示、显示自动化/插件）、新建旁路提问与分支工作区续接文案、以及新版引导页（Onboarding）。 |
| 自动化触发器与内联卡片 | 补齐触发器调度与 CEL 表达式助手说明、2.35.0 新增内联状态（`No longer active`、`Answered in chat`、`Dismissed`）及工具权限审批分类。 |
| 远程控制与限额提示 | 补齐远程控制实例、SSH/Git/Cog/CitC 操作及远程智能体/环境/会话次数上限提示；保留 `Orchestrator`、`ELMO Composite`、`CitC workspace type` 等内部技术标识。 |
| Swarm 面板与插件目录 | 在 `dict/scoped/swarm.json` 中补齐 Hive/Mentions 视图切换、GIF 动图导出弹窗、Waiting/Killed 状态等新增词条与选择器；在 `dict/scoped/official-plugin-descriptions.json` 中同步 2.35.0 本机市场缓存中更新/新增的 6 条官方及合作伙伴插件短介绍。 |
| Electron 主进程与原生页面 | 扩展 `cli.js` 补丁覆盖范围：在原有 9 个核心文件基础上新增 `dist/remote/disconnectedPage.js`（SSH 断连/重连页）、`dist/webviewPopupSecurity.js`（连接安全信息弹窗与右键菜单）、`dist/deviceChooser.js`（HID/USB/串口设备选择器）、`dist/remote/signInCallback.js`（登录回调页），并补齐 `dist/main.js` 的 `WSL setup failed`。 |
| 正则假阳性治理 | 收紧 `patterns.json` 中过宽的 `finished` 与 `Set up` 规则，消除 `script finished` 和 `Set up my environment` 两条半英半中假阳性残片；补充 45 组 2.35.0 动态模板正则。 |

## 验证范围

- `npm run build:dict`：5,055 条精确词条与 445 组级联正则全部通过词库门禁。
- `npm run audit:ui -- --bundle <extracted 2.35.0 main.js>`：核对 [app-2.35.0-ui.json](../../test/fixtures/app-2.35.0-ui.json) 全部 UI 字面量与保留决定通过。
- `npm run audit`：45 项全链路静态一致性检查全部通过。
- `npm test`：全套 13 个测试入口全部通过（含 JSDOM 内容边界、Swarm 面板、ASAR 生命周期、词库质检等）。
- 本机安装：在受保护智能体会话下通过无损预注入模式生成 `app.asar.staged` 与后台替换守候进程，待用户重启客户端后完成实机界面生效；VS Code 扩展未在本机安装，未作实机检查；macOS/Linux 范围为跨平台自动化回归。
