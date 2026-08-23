---
name: i18n-diagnostics
description: >-
  Inspects Google Antigravity Chinese localization status, validates patch health, detects upstream UI drift, runs automated regressions, or assists in adding new translations. Activate this skill when the user asks about Antigravity Chinese localization status, wants to diagnose UI translation issues, run drift detection on upstream updates, or add new translation entries.
---

# Antigravity 本地化诊断与演进工作流 (Localization Diagnostics & Evolution)

本技能为 Antigravity Agent 提供完整的客户端汉化状态诊断、上游版本演进比对、词库维护与自动化回归测试指南。

---

## 🛠️ 常见诊断工作流

### 1. 检查客户端汉化补丁状态
当用户询问当前客户端是否已打上汉化补丁或补丁是否被官方更新覆盖时：
```bash
node cli.js status
```
* **已汉化 (Patched)**：提示用户当前客户端状态完好，如需更新词库可重新运行安装；
* **未汉化 / 被官方覆盖 (Original)**：提示用户完全退出客户端后运行 `install.bat` 或 `node cli.js install`。

---

### 2. 执行上游版本文本漂移分析 (Drift Detection)
当检测到 Antigravity 官方客户端发布了新版本（或用户提供了新版本 `main.js` / `app.asar` 解包目录时）：
```bash
npm run scan:drift
```
* 检查输出的 **三层分级指标**：
  * `Observed UI Candidates`（观察到的 UI 候选总量）
  * `Exact Match Coverage`（精确匹配覆盖率）
  * `Rule-Assisted Coverage`（综合有效翻译覆盖率）
  * `Decayed / Stale Rules`（当前版本未观测到的历史陈旧词条）
* 查看生成的详细分析文件：[`tools/drift-report.json`](file:///C:/Projects/antigravity-chinese/tools/drift-report.json)。

---

### 3. 运行端到端自动化测试套件
在修改了词典 [`dict/zh-CN.json`](file:///C:/Projects/antigravity-chinese/dict/zh-CN.json) 或运行时引擎 [`core/i18n-runtime.js`](file:///C:/Projects/antigravity-chinese/core/i18n-runtime.js) 后：
```bash
npm test
```
必须确保以下 5 大测试套件（共 134+ 项断言）100% 全部 PASS：
1. `test/verify.js`（50 项核心 DOM 渲染、代码保护与跨平台候选路径断言）
2. `test/test-screenshots.js`（64 项真实界面截图用例）
3. `test/test-menu-and-titles.js`（8 项窗口菜单与用户自定义会话标题防误伤断言）
4. `test/test-asar-lifecycle.js`（10 项真实 ASAR 二进制包打包、注入与原子还原全真测试）
5. `test/test-detector-live.js`（真实宿主环境无参路径探测实测）

---

### 4. 补充新词条与规则规范
* **新增精确词条**：写入 `dict/zh-CN.json` 的 `exact` 对象。
* **边界保护原则**：
  * 严禁翻译品牌名（`Google`, `Gemini`, `Antigravity` 等）；
  * 严禁翻译技术缩写（`API`, `MCP`, `CLI`, `IDE`, `Token`, `JSON`, `DOM` 等）；
  * 单字词（如 `Project`, `File`, `Open`）严禁作为子串进行模糊替换，必须确保其只在精确独立匹配时生效。
