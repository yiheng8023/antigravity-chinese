### 🌟 Antigravity 全生态中文本地化套件 v3.3.15 (Precision Tooltip & Polish Release)

#### 1. 补齐项目入口全套悬浮提示词条 (Project Entrypoint Tooltips)
- **精准收录项目入口气泡**：
  - `Select a folder.` ➔ **`选择一个文件夹。`**（并内置无句号容差防御）；
  - `Instantly create a new project and folder to start building.` ➔ **`即刻创建新项目和文件夹以开始构建。`**；
  - 顺带地毯式补齐同组件周边隐藏 Tooltip：`Create a new project using normal folders and/or citc workspaces.`（使用常规文件夹和/或 CitC 工作区创建新项目）、`Work in a CitC workspace.`（在 CitC 工作区中工作）及 `Concierge (Dev only)`（接待员（仅限开发者））。

#### 2. 词库三层编译与质量门禁
- **词条统计扩充**：精确词条由 3,287 条扩充至 **3,300 条**，动态级联正则 321 组，100% 通过 ASCII Key 拦截门禁与捕获组守恒校验；
- **黄金语义测试套件扩增**：`test/test-screenshots.js` 扩增至 **227 项** strictEqual 黄金语义断言，100% 满分通过；
- **全局一致性体检**：`npm run audit` 37 项全维检查全部 PASS，全生态健康指数评分维持 100 / 100 满分。

#### 3. 无损预注入与即时挂载
- 本机已通过无损预注入挂载：最新汉化包已预构建为 `app.asar.staged`，并在后台守候进程中就绪，待 Antigravity 客户端下次重启即可无缝生效。
