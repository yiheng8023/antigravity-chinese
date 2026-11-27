# Antigravity 社区中文本地化工具

<p align="center">
  <a href="https://github.com/yiheng8023/antigravity-chinese/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/yiheng8023/antigravity-chinese/ci.yml?branch=main&amp;label=CI&amp;logo=github" alt="CI 状态"></a>
  <a href="https://github.com/yiheng8023/antigravity-chinese/releases/latest"><img src="https://img.shields.io/github/v/release/yiheng8023/antigravity-chinese?color=blue&amp;label=Release" alt="最新发行版"></a>
  <a href="https://github.com/yiheng8023/antigravity-chinese/releases"><img src="https://img.shields.io/github/downloads/yiheng8023/antigravity-chinese/total?color=3388ff&amp;logo=github&amp;label=Asset%20downloads" alt="发行版附件下载量"></a>
  <a href="https://github.com/yiheng8023/antigravity-chinese/stargazers"><img src="https://img.shields.io/github/stars/yiheng8023/antigravity-chinese?logo=github&amp;color=ffaa00" alt="GitHub 星标数"></a>
  <a href="https://github.com/yiheng8023/antigravity-chinese/network/members"><img src="https://img.shields.io/github/forks/yiheng8023/antigravity-chinese?logo=github&amp;color=grey" alt="GitHub 派生数"></a>
  <img src="https://img.shields.io/badge/Node.js-%3E%3D18-brightgreen?logo=node.js" alt="最低 Node.js 版本为 18">
  <a href=".github/workflows/ci.yml"><img src="https://img.shields.io/badge/CI%20platforms-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey" alt="CI 平台为 Windows、macOS 和 Linux"></a>
  <a href="LICENSE"><img src="https://img.shields.io/github/license/yiheng8023/antigravity-chinese?color=green" alt="MIT 许可证"></a>
</p>

<p align="center">
  <a href="README.md">简体中文</a> | <a href="README.en.md">English</a>
</p>

当前源码版本 **v3.3.67**，维护目标为 **Antigravity App 2.36.0 / VS Code 扩展 1.13.0**。本版补译悬浮输入栏、应用菜单、组织插件策略和云端自动化授权提示。

这是社区开源项目，提供桌面客户端与 VS Code 扩展的本地中文补丁、备份还原，以及可选的中文交互插件。Google 官方及合作伙伴目录中已核实的短介绍，在市场、精选、已安装、详情和设置中复用同一译文。插件名、发布者提供的命令与技能说明、自定义内容和未匹配的完整字段按原文显示。界面与安装验证见 [2.35.0 维护记录](docs/maintenance/antigravity-2.35.0.md)。Linux 便携路径支持见 [Linux 便携安装维护记录](docs/maintenance/linux-portable-install.md)。

VS Code 扩展更新会覆盖本地汉化。更新扩展后请重新执行 `node cli.js install:vscode`，再重新加载 VS Code 窗口。

## 支持与验证范围

| 组件 | 实现 | 当前验证范围 |
| --- | --- | --- |
| Antigravity App | ASAR preload、原生菜单和弹窗文本补丁；版本备份与还原 | Windows x64 2.36.0 的原版前端核对、界面回归和安装副本验证。Linux x64 2.33.0 的安装验证见便携安装记录 |
| VS Code 扩展 | 清单、原生菜单和通知翻译、Webview 本地代理、独立备份/还原 | Windows 1.13.0 安装、重复安装、还原与界面检查见 [1.13.0 维护记录](docs/maintenance/antigravity-2.33.1.md) |
| 社区中文插件 | 中文交互规则与维护诊断技能 | 由 antigravity-chinese 社区维护，可选安装 |
| 独立 IDE、其他 IDE 扩展 | 尚无专用汉化安装器 | 不声明已适配 |
| Antigravity CLI | 保留官方原生行为 | 不修改 CLI 二进制或终端界面 |

桌面 2.36.0 的验证记录见 [本轮维护说明](docs/maintenance/antigravity-2.36.0.md)。语音、远程智能体等灰度功能以实际账号开放情况为准。

## 安装与使用

需要 Node.js **>=18** 及 npm/npx。首次安装开发依赖或 ASAR 工具可能需要联网。先保存工作并正常退出客户端，再在仓库目录运行：

```bash
npm install
node cli.js install
```

`install` 自动检测桌面客户端及 VS Code 扩展，处理已安装的组件。Windows 可双击 `install.bat`；macOS/Linux 可运行 `bash install.sh`。这两个脚本还会安装可选的社区中文插件。

**macOS 桌面更新。** 汉化安装器会对应用进行本地临时签名（ad-hoc）。在 Apple Silicon 上从 2.33.1 更新至 2.34.0 时，有用户遇到更新已下载、安装时签名验证失败的情况。遇到此提示，请保存工作并退出应用，从官方 DMG 重新安装完整的 Antigravity App，启动核对版本后再应用适配该版本的汉化。仅还原 `app.asar` 无法恢复整个应用的 Google 签名。[官方下载](https://antigravity.google/download) · [复现记录 #12](https://github.com/yiheng8023/antigravity-chinese/issues/12)

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

在 Linux 的 VS Code Server 环境中，`install:vscode`、`status:vscode` 和 `restore:vscode` 也会探测 `~/.vscode-server/extensions`。两处都安装了扩展时，默认选 `~/.vscode/extensions`。处理远端副本时可在远端终端用 `--path` 指定实际扩展目录。

Linux 解压版支持自动探测 `~/Applications/Portable`、`~/Applications` 和汉化工具同级目录下的 `Antigravity`、`antigravity` 或对应架构的官方解压目录（`Antigravity-x64` 或 `Antigravity-arm64`）。多个安装目录共存时，传入 `--path` 指定要处理的副本。

```bash
bash install.sh --path "$HOME/Applications/Portable/Antigravity"
bash uninstall.sh --path "$HOME/Applications/Portable/Antigravity"
```

`install.sh` 同时安装社区中文插件。只安装指定桌面补丁时可以直接使用 `node cli.js install --path`。带 `--path` 的还原只处理该目标。

安装器保留原有 unpacked 标记，替换前逐文件比对外置文件；不支持安全保留的布局时中止。当前 CLI 的桌面流程使用 ASAR；`core/cdp-client.js` 是供开发集成的独立协议模块。

## 开发、检查与维护

词库源文件在 `dict/src/`，`dict/zh-CN.json` 与 `dist/zh-CN.bundle.json` 是生成产物。

```bash
npm run build:dict
# 运行全套自动化测试（聚合 13 套测试入口）
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

感谢大家一起维护、测试和改进汉化。GitHub 侧栏按默认分支的提交记录统计贡献者，这里也收录问题报告、复现验证和方案建议。

| 贡献者 | 贡献 |
| --- | --- |
| <a href="https://github.com/yiheng8023"><img src="https://avatars.githubusercontent.com/u/127850894?s=64&v=4" width="32" height="32" alt="" /> yiheng8023</a> | 维护汉化工具与词库、评审改动并发布版本。 |
| <a href="https://github.com/XuanChuYun"><img src="https://avatars.githubusercontent.com/u/29687766?s=64&v=4" width="32" height="32" alt="" /> XuanChuYun</a> | 提供 macOS 下 Antigravity App 与 IDE 的对照截图，帮助明确两者的汉化支持范围。 [Issue #5](https://github.com/yiheng8023/antigravity-chinese/issues/5) |
| <a href="https://github.com/a705876883-arch"><img src="https://avatars.githubusercontent.com/u/250879823?s=64&v=4" width="32" height="32" alt="" /> a705876883-arch</a> | 提交用户内容保护修复方案，并提供误译复现与回归用例。 [PR #6](https://github.com/yiheng8023/antigravity-chinese/pull/6) |
| <a href="https://github.com/fansID512"><img src="https://avatars.githubusercontent.com/u/103017881?s=64&v=4" width="32" height="32" alt="" /> fansID512</a> | 提供详细环境、复现步骤和对照观察，帮助定位设置页掉帧问题。 [Issue #8](https://github.com/yiheng8023/antigravity-chinese/issues/8) |
| <a href="https://github.com/MizuIro-H"><img src="https://avatars.githubusercontent.com/u/123630455?s=64&v=4" width="32" height="32" alt="" /> MizuIro-H</a> | 在 Bazzite 上复现 Linux 解压版探测问题，提出修复方案并验证安装。 [Issue #9](https://github.com/yiheng8023/antigravity-chinese/issues/9) |
| <a href="https://github.com/tangyixiao"><img src="https://avatars.githubusercontent.com/u/115929632?s=64&v=4" width="32" height="32" alt="" /> tangyixiao</a> | 指出权限预设译名的歧义，提交修复和回归测试，并实测全局设置。 [PR #11](https://github.com/yiheng8023/antigravity-chinese/pull/11) |
| <a href="https://github.com/Qiinn-71"><img src="https://avatars.githubusercontent.com/u/262174075?s=64&v=4" width="32" height="32" alt="" /> Qiinn-71</a> | 在 Apple Silicon 上对照三种安装状态，定位 macOS 更新安装时的签名验证问题。 [Issue #12](https://github.com/yiheng8023/antigravity-chinese/issues/12) |
| <a href="https://github.com/mitang-ai"><img src="https://avatars.githubusercontent.com/u/275678971?s=64&v=4" width="32" height="32" alt="" /> mitang-ai</a> | 提供 Swarm 界面及斜杠命令搜索高亮的适配与回归用例，并分享插件详情页翻译方案。 [PR #14](https://github.com/yiheng8023/antigravity-chinese/pull/14) · [Issue #15](https://github.com/yiheng8023/antigravity-chinese/issues/15) |
| <a href="https://github.com/Kame-Lanlan"><img src="https://avatars.githubusercontent.com/u/152709450?s=64&v=4" width="32" height="32" alt="" /> Kame-Lanlan</a> | 报告 Antigravity 扩展安装在 Linux 的 `.vscode-server` 路径时的支持缺口。 [Issue #23](https://github.com/yiheng8023/antigravity-chinese/issues/23) |
| <a href="https://github.com/BH-0"><img src="https://avatars.githubusercontent.com/u/92411549?s=64&v=4" width="32" height="32" alt="" /> BH-0</a> | 在 Ubuntu 的 Remote SSH 环境中复现面板加载失败，提供环境、重载步骤、后端就绪日志和转发端口错配的分析。 [Issue #23 实测反馈](https://github.com/yiheng8023/antigravity-chinese/issues/23#issuecomment-7209393590) |

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
