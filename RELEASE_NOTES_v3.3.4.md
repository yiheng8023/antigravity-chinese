# Antigravity Chinese Localization Toolkit v3.3.4 Release Notes

## 🌟 核心更新亮点 (Highlights)

### 1. 🔌 官方插件目录 (`Build with Antigravity Plugins`) 与 131 项技能简介 100% 全景汉化
- **新增插件专属上下文词库 [`dict/src/ctx/plugins.json`](dict/src/ctx/plugins.json)**（新增 **383 条精确词条** + **27 组级联正则**，总词库跃升至 **2,410 条精确词条 + 258 组级联正则**）：
  - **插件目录引导区**：完整汉化 `Build with Antigravity Plugins` 标题与说明（`插件是由 Google 及合作伙伴打造的精选工具包，可将技能、规则、子智能体和 MCP 服务器打包整合，一键安装即可扩展 Antigravity 的能力边界。`），以及无匹配搜索提示、离线缓存回退提示与加载失败状态；
  - **10 大 Google 官方插件双源简介全覆盖**：同时覆盖云端插件目录版与本地已安装 `plugin.json` 版说明，涵盖 `Android CLI`、`Chrome DevTools`、`Data Agent Kit for Google Cloud`、`Dart and Flutter`、`Firebase`、`Gemini API`、`Google Maps Platform`、`Modern Web Guidance`、`Google Antigravity SDK`、`Science`；
  - **131 项官方 `SKILL.md` / `agents` / `rules` 简介全量出版级汉化**：完整覆盖全部 10 款官方插件与内置扩展包旗下的 131 项技能与子智能体说明（包括 BigQuery / Dataflow / Spark / Composer、Dart / Flutter 全家桶、Firebase 全家桶、AlphaFold / AlphaGenome / ChEMBL / PubMed / UniProt / PyMOL 等 39 项生命科学工具、Web Vitals / Chrome 扩展以及 Antigravity 内置技能）；
  - **长文本多行折叠归一与 Markdown 星号自适应剥离**：针对 `SKILL.md` YAML frontmatter 多行简介与加粗语法（如 `**STOP AND VERIFY**: ...`），在三层词库中同步收录带星号与纯文本双形态，确保在卡片列表与详情抽屉中 100% 精准命中。

### 2. 🧪 黄金语义真断言与出版级质检扩充
- [`test/test-screenshots.js`](test/test-screenshots.js) 黄金语义真断言扩充至 **180 项 `assert.strictEqual` 精确断言 + 20 项不变性模糊测试**；
- 全仓 8 大自动化测试套件共计 **350+ 项断言** 100% 通过，出版级质检（`test-proofread-integrity.js`）确保 2,410 条词条与 258 组正则 0 错别字、全角标点合规、捕获组严格守恒。
