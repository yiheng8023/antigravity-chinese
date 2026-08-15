# 贡献指南 (Contributing Guide)

感谢你对 **Antigravity 中文汉化项目** 的关注与支持！我们热忱欢迎社区贡献者一同完善词库、优化注入性能以及改进跨平台管理工具。

---

## 🌟 贡献原则与翻译规范

为了保证整个汉化补丁的专业性、克制感与代码安全性，请在提交词条修改或功能变更时遵循以下原则：

### 1. 专业与克制原则（该保留英文的坚决保留）
* **品牌与产品名**：`Google`, `Gemini`, `Google AI Pro`, `Google AI Ultra`, `Antigravity`, `VS Code`, `Chrome`, `GitHub` 等保持英文。
* **开发者技术术语**：`API`, `MCP`, `CLI`, `IDE`, `Token / Tokens`, `JSON`, `YAML`, `URL`, `SSH`, `HTTP/HTTPS`, `SDK`, `IP`, `DNS`, `DOM`, `AST` 等通用技术缩写保持英文。
* **按键与快捷键**：`Ctrl`, `Cmd`, `Shift`, `Alt`, `Enter`, `Esc`, `Tab`, `Space` 等按键名保持英文。
* **模型代号**：`gemini-2.5-pro`, `claude-3-5-sonnet` 等官方模型名称保持英文。
* **自然流畅的用户界面**：对于设置说明长句、操作按钮、提示气泡、分区标题，力求翻译准确、通顺、符合中文技术软件的标准术语。

### 2. 代码与终端绝对安全
* 核心注入引擎严禁破坏或误翻译代码编辑区（`Monaco Editor` / `pre` / `code`）与终端控制台（`xterm`）。

---

## 🛠️ 本地开发与词库测试流程

1. **Fork 本仓库** 并克隆到本地：
   ```bash
   git clone https://github.com/<your-username>/antigravity-chinese.git
   cd antigravity-chinese
   ```

2. **安装基础开发依赖**（仅用于本地 JSDOM 测试）：
   ```bash
   npm install
   ```

3. **修改词库或代码**：
   * 词库字典：编辑 [`dict/zh-CN.json`](dict/zh-CN.json)。
   * 运行时引擎：编辑 [`core/i18n-runtime.js`](core/i18n-runtime.js)。
   * CLI 工具：编辑 [`cli.js`](cli.js)。

4. **运行本地自动化回归测试（必须全部 PASS）**：
   ```bash
   node test/verify.js
   node test/test-screenshots.js
   ```
   > 确保所有断言均为 `✅ [PASS]`，无报错或挂起。

---

## 📝 提交 Pull Request

1. 创建特性分支：
   ```bash
   git checkout -b feat/add-new-translations
   ```
2. 提交代码（请使用语义化 Commit 规范，如 `feat:`, `fix:`, `docs:` 等）：
   ```bash
   git commit -m "feat(dict): add translations for new workspace settings"
   ```
3. 推送分支并向本仓库 `main` 分支发起 Pull Request。
4. 描述清楚本次 PR 修复的漏翻项、上下文以及测试通过证明。
