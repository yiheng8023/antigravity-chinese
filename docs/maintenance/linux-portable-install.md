# v3.3.55 Linux 便携安装与还原

2026-11-21 核查官方更新日志及下载页。日志列出的桌面版为 11 月 17 日发布的 2.33.0，本轮使用下载页提供的 Linux x64 解压包验证。官方日志记录 SSH 项目、GitHub 拉取请求和浏览器内查找等变化，对应的界面适配见 [2.33.0 维护记录](antigravity-2.33.0.md)。Windows 2.33.1 和 VS Code 扩展 1.13.0 的验证范围见 [上一版维护记录](antigravity-2.33.1.md)。[官方更新日志](https://antigravity.google/docs/changelog/) · [官方下载页](https://antigravity.google/download)

[MizuIro-H](https://github.com/MizuIro-H) 在 Bazzite 上报告了用户目录内的解压版无法被探测，以及 Bash 脚本丢掉 `--path` 的问题，提供了复现目录、候选路径建议和安装验证。[Issue #9](https://github.com/yiheng8023/antigravity-chinese/issues/9)

Linux 保留原有四个安装路径的优先顺序，随后检查 `~/Applications/Portable`、`~/Applications` 以及汉化工具同级目录下的 `Antigravity`、`antigravity` 和当前架构的官方解压目录。下载包的顶层目录分别是 `Antigravity-x64` 和 `Antigravity-arm64`。候选 `app.asar` 必须是文件。显式路径优先，`install.sh` 与 `uninstall.sh` 按原顺序传递参数。安装脚本带有 `--with-plugin`，还原脚本使用 CLI 的目标作用域。

在 Ubuntu 26.04 WSL 2 x64、Node.js 22.21.1 下验证官方 Linux x64 2.33.0 包副本。下载归档 SHA-256 为 `a73387b229c6b1f5288860731133c5b26e153340eaed96d865032cd8a8535050`，原版 `app.asar` SHA-256 为 `b33c81600e82e65593aa8430ef01b37d6b28d9d98f0faf45e25957783b71e64b`。无参数探测命中了官方目录名和报告者使用的自定义名称。在自定义名称下直接执行 `./install.sh` 两次，补丁字节一致。执行 `./uninstall.sh` 后，还原的 ASAR 与保留的备份均与原包字节一致。

两份安装共存时，用带空格的目录安装、用对应 ASAR 路径还原，逐一核对了两份副本的哈希。ASAR 中的 9 个改动文件已核对，修改的 JavaScript 通过语法检查。377 个外置文件的哈希与原包一致。回归覆盖原有路径优先级、目录与文件的区分、显式路径优先级以及两个 Bash 脚本的参数转发。

本轮验证覆盖 Linux x64 的 CLI 安装生命周期。ARM64 核查了官方归档的目录名。Bazzite 原环境与 Linux 图形客户端仍待实机复测。
