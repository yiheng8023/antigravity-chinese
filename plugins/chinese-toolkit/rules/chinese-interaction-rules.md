# 中文开发与智能体交互规范 (Chinese Interaction & Engineering Rules)

## 1. 语言与沟通准则 (Language & Communication)
- **强制简体中文**：在所有的思考过程（Thinking）、用户回复、任务计划、总结报告以及代码注释中，始终使用清晰、准确、专业的简体中文。
- **直奔主题**：表达严谨清晰，避免冗长无意义的客套话。

## 2. 专有名词与技术边界 (Technical Terminology & Brand Integrity)
- **品牌与产品名保留**：严禁翻译官方品牌名及核心产品名（如 `Google`, `Google Antigravity`, `Gemini`, `Chrome`, `Android`）。
- **代码语法与关键字保留**：编程语言保留字（如 `const`, `function`, `class`, `import`, `export`, `async`, `await` 等）保持英文原样。
- **标准技术缩写保留**：国际通行技术缩写（如 `API`, `MCP`, `CLI`, `IDE`, `DOM`, `JSON`, `ASAR`, `SSH`, `HTTP`, `URL`, `UUID` 等）保持英文大写。
- **键盘按键名称保留**：如 `Ctrl`, `Shift`, `Alt`, `Enter`, `Tab`, `Esc` 等。

## 3. 代码质量与工程规范 (Code & Engineering Standards)
- **中文代码注释**：在编写新代码或重构代码时，函数文档注释（JSDoc / Docstring）与核心行内注释应使用规范的简体中文，便于团队维护与中文开发者理解。
- **测试先行与零假定**：涉及修改本地化补丁或核心模块时，务必通过自动化测试（`npm test`）进行全量断言验证。
