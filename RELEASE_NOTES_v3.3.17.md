### 🌟 Antigravity 全生态中文本地化套件 v3.3.17 (Official v2.21.0 Deep Adaptation & Full Automation Coverage Release)

#### 1. 官方 Antigravity v2.21.0 全景深度适配 (Upstream v2.21.0 Feature Matrix)
- **高级内容搜索 (Advanced Search)**：
  - 适配 `Ctrl+K`（macOS 为 `⌘+K`）基于会话正文内容的全局检索功能；
  - 收录输入框占位引导语 `Search conversations based on their contents` ➔ **`基于内容搜索会话`** 与 `Advanced Search` ➔ **`高级搜索`**。
- **定时任务全面重构为“自动化” (Automations Overhaul)**：
  - 彻底适配官方将 `Scheduled Tasks` 更名为 `Automations` 后的全新实体体系；
  - 全套收录 `New Automation` ➔ **`新建自动化`**、`Enter automation name...` ➔ **`输入自动化名称...`**、`Add Automation` ➔ **`添加自动化`**；
  - 深度适配自动化面板空白状态提示：`No automations configured.` ➔ **`尚未配置任何自动化任务。`**，并全套补齐编辑、删除、保存、运行与停止等派生操作词条。
- **智能体连续动作折叠聚合 (Grouped Agent Actions)**：
  - 适配智能体动作摘要折叠行：`File edits` ➔ **`文件编辑`**、`Terminal commands` ➔ **`终端命令`**、`File reads` ➔ **`文件读取`**；
  - 配合侧边栏归档显式标记 `(Archived)` ➔ **`（已归档）`** 与 `File Viewer` ➔ **`文件查看器`**。

#### 2. 审查面板与工作区环境精准攻坚 (Review Submenu & Workspace Switcher)
- **工作区模式切换器**：
  - 攻克输入框左下角按钮与下拉菜单孤立英文：`Local` ➔ **`本地`**（与 `新建工作树` 彻底对齐）。
- **审查（Review）下拉菜单副标题与动态分支**：
  - 补齐未提交项副标题：`Staged index changes and working tree changes` ➔ **`暂存区索引更改与工作区更改`**；
  - 引入动态级联正则，完美覆盖任意当前分支主标题：`^Branch\s+([a-zA-Z0-9_\-\.\/]+)$` ➔ **`分支 $1`**（如 `Branch main` ➔ **`分支 main`**）；
  - 引入动态级联正则，完美覆盖任意上游对比副标题：`^All changes since\s+(.+)$` ➔ **`自 $1 以来的全部更改`**（如 `All changes since origin/main` ➔ **`自 origin/main 以来的全部更改`**）；
  - 补齐智能体编辑副标题：`Files modified by the agent in this conversation` ➔ **`智能体在此会话中修改的文件`**。
- **项目右键上下文菜单全平台补齐**：
  - 在 `cli.js` 原生右键拦截表与核心词典中同步补入缺失的 `Show in File Explorer` ➔ **`在文件资源管理器中显示`**；
  - 连带补齐跨平台变体：`Show in Finder` / `Reveal in Finder` ➔ **`在访达中显示`**、`Show in File Manager` ➔ **`在文件管理器中显示`**。

#### 3. 词库三层编译与全量测试套件质量门禁 (Quality Gates & Diagnostics)
- **词库统计**：精确词条扩充至 **3,339 条**，动态级联正则 **318 组**，100% 通过 ASCII Key 拦截门禁与捕获组守恒校验；
- **自动化测试断言**：9 大全真测试套件共计 **400+ 项全维断言 100% 满分通过**；
- **真实场景黄金语义断言**：`test/test-screenshots.js` 扩充 19 项最新界面真实截图黄金硬断言（总断言数增至 **246 项**）；
- **全生态全局一致性体检**：`npm run audit` 37 项全维检查全部 PASS，全生态健康指数评分维持 **100 / 100 满分**；
- **内置技能多行 YAML 描述**：`gemini-api-dev` 与 `gemini-live-api-dev` 长篇描述 100% 完整覆盖，文本漂移探测实现 **0 漏项 / 0 假阳性**。
