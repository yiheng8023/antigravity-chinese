# Google Antigravity 中文本地化工具

[简体中文](README.md) | [English](README.en.md) · [Release](https://github.com/yiheng8023/antigravity-chinese/releases/latest) · [CI](https://github.com/yiheng8023/antigravity-chinese/actions/workflows/ci.yml)

当前源码版本 **v3.3.48**，维护目标为 **Antigravity App 2.32.1 / VS Code 扩展 1.12.0**。这是社区开源项目，提供桌面客户端与 VS Code 扩展的本地中文补丁、备份还原，以及可选的中文交互插件。

本版按完整组件补查桌面 2.32.1 的设置、快捷键及浮层文案，修复遗漏的提交说明、置顶切换、旁路提问、登录入口和命令栏目。新增界面时间与自定义扩展导航的限定翻译，保留正文、资源名、路径、命令和作者内容；同词在不同位置有正反例回归。保存了 1052 条需汉化文案与 45 项保留/组合处理决定的上游组件清单，并加入来源校验，避免只补功能名称而漏查说明与操作。详见 [补充检查记录](docs/maintenance/antigravity-2.32.1-follow-up.md)。

VS Code 扩展更新会覆盖本地汉化。更新扩展后请重新执行 `node cli.js install:vscode`，再重新加载 VS Code 窗口。相关适配与验证见 [1.11.0 维护记录](docs/maintenance/vscode-1.11.0.md) 和 [桌面 2.29.0 维护记录](docs/maintenance/antigravity-2.29.0.md)。

## 支持与验证范围

| 组件 | 实现 | 当前验证范围 |
| --- | --- | --- |
| Antigravity App | ASAR preload、原生菜单和弹窗文本补丁；版本备份与还原 | Windows 2.32.1 安装包、安装/重复安装/还原与实际交付脚本的 DOM 验证；逐项视觉验收范围见本次维护记录 |
| VS Code 扩展 | 清单、原生菜单和通知翻译、Webview 本地代理、独立备份/还原 | Windows 1.12.0 安装包验证与通知按钮回归；代理和实机检查范围见本次维护记录 |
| 社区中文插件 | 中文交互规则与维护诊断技能 | 可选安装；不代表 Google 官方插件 |
| 独立 IDE、其他 IDE 扩展 | 尚无专用汉化安装器 | 不声明已适配 |
| Antigravity CLI | 保留官方原生行为 | 不修改 CLI 二进制或终端界面 |

macOS/Linux 有跨平台模拟回归，真实客户端未在本次验收。语音、远程智能体等官方灰度功能以实际账号开放情况为准。静态检查与候选字符串匹配均不代表整个上游产品的翻译覆盖率。

## 安装与使用

需要 Node.js **>=18** 及 npm/npx。首次安装开发依赖或 ASAR 工具可能需要联网。先保存工作并正常退出客户端，再在仓库目录运行：

```bash
npm install
node cli.js install
```

`install` 自动检测桌面客户端及 VS Code 扩展，处理已安装的组件。Windows 可双击 `install.bat`；macOS/Linux 可运行 `bash install.sh`。这两个脚本还会安装可选的社区中文插件。

```bash
node cli.js status
node cli.js install:vscode
node cli.js status:vscode
node cli.js restore:vscode
node cli.js install-plugin
node cli.js uninstall-plugin
node cli.js restore
node cli.js help
```

`restore` 尝试还原桌面及已检测到的 VS Code 汉化，并卸载本项目全局插件。指定 `--path` 时仅还原指定目标。缺少有效原版备份时会失败，避免用不明副本覆盖客户端。保留安装器生成的备份；官方更新后应重新核查适配。

自定义目标：

```bash
node cli.js install --path "<安装目录或 app.asar>"
node cli.js install:vscode --path "<扩展目录>"
```

安装器保留原有 unpacked 标记，替换前逐文件比对外置文件；不支持安全保留的布局时中止。当前 CLI 的桌面流程使用 ASAR；`core/cdp-client.js` 是供开发集成的独立协议模块。

## 开发、检查与维护

词库源文件在 `dict/src/`，`dict/zh-CN.json` 与 `dist/zh-CN.bundle.json` 是生成产物。

```bash
npm run build:dict
# 运行全套自动化测试（聚合 11 套测试入口）
npm test
npm run audit
npm run audit:ui -- --bundle <official-main.js>
```

测试包括 DOM/代码及用户内容保护、黄金语义、CDP、菜单、ASAR、路径探测、词库质检、VS Code 和边界回归。数量以当前脚本输出为准。CI 覆盖 Windows、macOS、Ubuntu × Node.js 18/20/22。

内容保护按明确的界面边界保留消息正文、Markdown、文件树、路径导航、文件引用、项目/会话名称及自定义扩展的作者内容；同一区域的固定操作按钮继续翻译。修复依据与验证范围见[用户内容保护维护记录](docs/maintenance/user-content-boundaries.md)和[自定义扩展内容边界记录](docs/maintenance/customization-content-boundaries.md)。

提供明确来源的官方前端脚本后，可分析候选文本：

```bash
npm run scan:drift -- "<frontend-bundle.js>" --report "<report.json>"
```

该工具还检查本机发现的内置技能与插件描述；报告是启发式摘要和样本。缺少有效 bundle 时退出失败；没有候选文本时覆盖率为未知。它不能代替实机检查。

每次更新维护执行 [贡献指南中的维护与发版流程](CONTRIBUTING.md#更新维护与发版)：核查官方日志、评估全局影响、按需修复、对齐文档、完成相应验证并回读发布结果。维护约定由 `AGENTS.md` 和社区诊断技能指向同一流程。

主要模块：`cli.js` 管理生命周期，`core/` 提供运行时/协议/扩展与 ASAR 处理，`tools/` 提供构建和检查，`test/` 提供回归，`docs/maintenance/` 保存维护依据。问题报告见 [SECURITY.md](SECURITY.md)，贡献方式见 [CONTRIBUTING.md](CONTRIBUTING.md)。

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

- 感谢 **a705876883-arch** 提交用户内容保护修复方案，并提供误译复现与回归用例。 [PR #6](https://github.com/yiheng8023/antigravity-chinese/pull/6)

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
