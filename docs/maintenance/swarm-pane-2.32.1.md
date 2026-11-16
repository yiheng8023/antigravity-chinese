# v3.3.49：桌面内置 Swarm 面板

## 来源与原因

2026-11-16，用户截图显示 Swarm 空状态、说明和等待提示仍是英文。Windows x64 本机桌面为 2.32.1，VS Code 扩展为 1.12.0。再次核查[官方更新日志](https://antigravity.google/docs/changelog/)，桌面最新记录仍为 2026-11-13 的 2.32.0，未单列本机 2.32.1；本轮是已安装组件的漏项修复。

内置 `swarm/sidecars/swarm_board` 通过独立的 `plugin://swarm--swarm_board-<port>/` 文档提供界面，HTML 加载自己的 `app.js`、`hive.js` 和样式，没有主界面的汉化运行时。只补主词库不能覆盖它。上一轮的主前端组件清单不包含这个独立文档，不能作为 Swarm 的验收证据。

本轮审查的组件来源 SHA-256 如下；上游改变这些文件时，应重新核对结构、控件与内容来源，不能只沿用本轮结论。

| 文件 | SHA-256 |
| --- | --- |
| `index.html` | `16faae3b703f62cebd2b226678cfec173975333e64e8b707b356e352d8fff2ec` |
| `app.js` | `14f74dd4478dbf2098c5ce86c12bd413139ac751ed8bcdfc0e3172bd6472fbc2` |
| `hive.js` | `bcc365aa8a8816e99ac96cf1574eac4c40c871955e87e62719feb230b4de88c9` |
| `main.mjs` | `18775901de1c90b99b7bd9ba6ea4dde89bd906efc31dc17b55843e066528c424` |

## 修复与内容边界

- `core/swarm-frame-patch.js` 随桌面 `dist/main.js` 安装，在 Electron 的 `did-frame-finish-load` 事件中定位完成加载的 frame。仅允许上述内置插件的根路径，并要求 Swarm 空状态和标签栏两处结构标记。其他插件、外部站点、非根路径不加载此运行时。
- 使用 [Electron WebContents](https://www.electronjs.org/docs/latest/api/web-contents#event-did-frame-finish-load) 与 [WebFrameMain](https://www.electronjs.org/docs/latest/api/web-frame-main#frameexecutejavascriptcode-usergesture) 的公开接口，不修改协议路由、认证参数、CSP、权限或后端逻辑，不输出含认证参数的插件 URL。
- `dict/scoped/swarm.json` 与 `core/swarm-i18n.js` 只处理明确识别的固定控件：加载/空状态、连接、标签栏、筛选、看板空状态、讲述者固定状态、回放、图例、复制、成员搜索/固定分组及启动说明。词条不进入主词库，`Live`、`Board` 等短词不会因此在全局生效。
- 只改匹配控件的直接文本和 `title`、`aria-label`、`placeholder`。保留表单值、选中项、事件、路径、文件名、`@all`、`Swarm`、`/swarm` 和模型标识。异步更新后重新处理，节点移入内容区时恢复原文；不覆盖渲染器后来写入的新内容。
- Swarm 标题、成员名、可自定义角色、任务、消息、活动内容、原始 JSON、生成的讲述者页面及作者自定义标签保留原文。`hive.js` 的部分界面标签也允许讲述者通过 `view.json` 自定义；无法从来源区分的混合内容保留，不将整个概览或成员卡片放开为可翻译区域。
- 不修改内置插件源文件或用户的技能、规则、全局社区插件。新增加载器随 ASAR 原版备份还原，不引入另一份本机插件备份机制。

## 验证

- 13 项 Swarm 专项回归覆盖截图、动态连接/空状态、输入值、同词作者内容、消息展开/收起、仅翻译作者标签的固定提示属性、节点移动还原、缺失结构标记、来源隔离、主/子 frame、重载、销毁竞态和主进程补丁幂等。
- 本地 `npm test` 通过：534 项黄金文案断言、34 项综合回归、42 项用户内容回归、39 项 ASAR 生命周期检查、13 项 Swarm 回归及 45 项一致性检查。主词库仍为 4541 条精确词条、396 组规则；Swarm 独立限定词库含 117 条词条、66 个文本/属性控件选择器和 1 个仅属性选择器。双语 README、版本与贡献流程同步。
- 真实 Windows 2.32.1 安装包副本完成安装、重复安装和还原：重复安装包字节一致，还原后与纯净备份字节一致；347 个外置文件保持。原版备份 SHA-256 为 `5b493943e67e500638555315594d5b1acbc7a02e6dac3c786651921c1ee8519f`。
- Windows 2.32.1 实际独立 Swarm frame 在应用启动后自动显示“此会话尚无 Swarm”“等待 Swarm 启动”等中文，说明中的 `/swarm` 保留；标签、搜索占位符及连接标签同步汉化。对子 frame 使用页面原生 `location.reload()` 后自动重新加载汉化，原始文件标签保持英文。CDP 的 `Page.reload` 不支持子目标，首次调用被拒绝，没有将该失败记为重载通过。
- 通过本地调试连接读取固定字段，没有手动注入候选脚本冒充宿主加载结果，也没有采集屏幕。检查窗口正常退出后，关闭其已核实的遗留辅助进程，确认调试端口关闭，再正常启动客户端；保留先前存在的 7 个导入辅助进程。内置插件与全局社区插件文件在本轮前后按哈希核对。

## 范围限制

未创建真实 Swarm、发送 `/swarm`、启动云端任务或更改账户/权限。已有任务、图谱、讲述者数据等分支通过隔离 fixture 验证，没有据此声称完成所有业务状态的实机验收。VS Code 扩展和主界面共享运行时未改动，扩展 1.12.0 保持原有补丁；此加载器针对桌面 Electron 宿主，不声称已适配 IDE 中的独立插件 frame。macOS/Linux 只有跨平台自动化，未做本轮实机验收。
