/**
 * Antigravity VS Code Extension 本地化补丁与生命周期管理器
 * Universal Localization Manager for Google Antigravity VS Code Extension
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

// 高优先级精准精修词库映射
const VSCODE_TRANSLATION_MAP = {
  // 基本信息
  "Bring Google's agent-first development platform to Visual Studio Code.":
    "将 Google 以智能体为核心的开发平台引入 Visual Studio Code。",

  // 自定义编辑器 (Custom Editors)
  "Antigravity Artifact Viewer": "Antigravity 产物文档查看器",
  "Antigravity Settings Viewer": "Antigravity 设置查看器",

  // 命令列表 (Commands)
  "Show Third Party Notices": "显示第三方声明",
  "Reset Conversation State": "重置会话状态",
  "Add Selection to Chat": "将选中文本添加到对话",
  "Add Terminal Selection or Output to Chat": "将终端选中内容或输出添加到对话",
  "Focus Antigravity Panel": "聚焦 Antigravity 面板",
  "Accept All Changes": "接受所有更改",
  "Reject All Changes": "拒绝所有更改",
  "Toggle Inline Diff": "切换内联差异显示",
  "Open Antigravity Settings": "打开 Antigravity 设置",
  "Provide Feedback": "提供反馈",

  // 配置项描述 (Configuration Properties)
  "Port for the Antigravity background server (`agy --hub`). Leave at 0 to allocate an ephemeral port automatically.":
    "Antigravity 后台服务器（`agy --hub`）的端口号。保留为 0 将自动分配临时可用端口。",
  "Timeout in milliseconds to wait for the Antigravity backend language server to start up and pass health checks.":
    "等待 Antigravity 后台语言服务器启动并通过健康检查的超时时间（毫秒）。",
  "Enable sending client-side product telemetry and usage metrics to Google Cloudmill to help improve Antigravity.":
    "启用向 Google 发送客户端产品遥测与使用指标，以协助持续改进 Antigravity。",
  "Enable inline diff decorations and CodeLenses. When disabled, falls back to opening changes in a side-by-side diff tab.":
    "启用内联代码差异标记与 CodeLens。禁用后将回退为在并排对比标签页中显示更改。",
  "Auto-accept pending edits in background files when sending a new chat message.":
    "发送新对话消息时，自动接受后台文件中待处理的代码编辑。",
  "Automatically open files in the editor when the agent proposes edits.":
    "当智能体建议修改代码时，自动在编辑器中打开相应文件。",
  "Base URL for CLI downloads (used for testing and internal overrides).":
    "CLI 命令行工具下载的基础 URL（用于测试与内部环境重写）。",
  "Additional command line arguments passed to the language server.":
    "传递给语言服务器的额外命令行启动参数。",
  "The release channel for this extension build":
    "此扩展构建版本的发布频道",
  "Internal channel setting":
    "内部频道设置"
};

/**
 * 自动查找本机已安装的 Google Antigravity VS Code 扩展目录
 * @param {string} [customDir] 自定义扩展目录
 * @returns {string|null} 扩展根目录绝对路径，未找到时返回 null
 */
function findVsCodeExtensionDir(customDir) {
  if (customDir !== undefined && customDir !== null) {
    if (fs.existsSync(customDir)) {
      const pkg = path.join(customDir, 'package.json');
      if (fs.existsSync(pkg)) return customDir;
    }
    return null;
  }

  const home = os.homedir();
  const extBase = path.join(home, '.vscode', 'extensions');
  if (!fs.existsSync(extBase)) return null;

  try {
    const entries = fs.readdirSync(extBase);
    const matches = entries.filter((e) => e.startsWith('google.google-antigravity-'));
    if (matches.length === 0) return null;

    // 按版本号自然排序，选取最高版本
    matches.sort();
    return path.join(extBase, matches[matches.length - 1]);
  } catch (_) {
    return null;
  }
}

/**
 * 检查指定 VS Code 扩展是否已被汉化
 * @param {string} extDir 扩展目录
 * @returns {boolean}
 */
function isVsCodeExtensionPatched(extDir) {
  if (!extDir) return false;
  const pkgPath = path.join(extDir, 'package.json');
  if (!fs.existsSync(pkgPath)) return false;
  try {
    const raw = fs.readFileSync(pkgPath, 'utf-8');
    const pkg = JSON.parse(raw);
    return Boolean(pkg.__antigravity_chinese_patched);
  } catch (_) {
    return false;
  }
}

/**
 * 构建完整的扩展字典映射表（融合静态精修与动态词库）
 * @returns {Record<string, string>}
 */
function getVsCodeFullMap() {
  const map = { ...VSCODE_TRANSLATION_MAP };
  const bundlePath = path.join(__dirname, '..', 'dict', 'zh-CN.json');
  if (fs.existsSync(bundlePath)) {
    try {
      const d = JSON.parse(fs.readFileSync(bundlePath, 'utf-8'));
      if (d && d.exact) {
        for (const [k, v] of Object.entries(d.exact)) {
          if (k && !map[k] && typeof v === 'string') {
            map[k] = v;
          }
        }
      }
    } catch (_) {}
  }
  return map;
}

/**
 * 一键安装 VS Code 扩展汉化补丁
 * @param {string} [customDir] 自定义扩展目录
 * @returns {{ success: boolean, message: string, extDir?: string }}
 */
function installVsCodePatch(customDir) {
  const extDir = findVsCodeExtensionDir(customDir);
  if (!extDir) {
    return {
      success: false,
      message: '未检测到 VS Code 的 Google Antigravity 扩展目录 (~/.vscode/extensions/google.google-antigravity-*)。'
    };
  }

  const pkgPath = path.join(extDir, 'package.json');
  const bakPath = path.join(extDir, 'package.json.bak');
  const metaPath = path.join(extDir, '.antigravity_vscode_meta.json');

  if (!fs.existsSync(pkgPath)) {
    return { success: false, message: `扩展 package.json 不存在: ${pkgPath}` };
  }

  // 1. 若纯净备份不存在，立即创建官方原版备份
  if (!fs.existsSync(bakPath)) {
    fs.copyFileSync(pkgPath, bakPath);
  }

  // 2. 始终从备份或当前内容中解析原始结构
  let sourceRaw = fs.readFileSync(bakPath, 'utf-8');
  let pkg;
  try {
    pkg = JSON.parse(sourceRaw);
  } catch (err) {
    return { success: false, message: `解析 package.json 失败: ${err.message}` };
  }

  const map = getVsCodeFullMap();

  // 3. 递归汉化 contributes 核心字段
  if (pkg.description && map[pkg.description]) {
    pkg.description = map[pkg.description];
  }

  if (pkg.contributes) {
    // 自定义编辑器
    if (Array.isArray(pkg.contributes.customEditors)) {
      for (const ed of pkg.contributes.customEditors) {
        if (ed.displayName && map[ed.displayName]) {
          ed.displayName = map[ed.displayName];
        }
      }
    }

    // 命令列表
    if (Array.isArray(pkg.contributes.commands)) {
      for (const cmd of pkg.contributes.commands) {
        if (cmd.title && map[cmd.title]) {
          cmd.title = map[cmd.title];
        }
      }
    }

    // 设置项
    if (pkg.contributes.configuration && pkg.contributes.configuration.properties) {
      const props = pkg.contributes.configuration.properties;
      for (const prop of Object.values(props)) {
        if (prop.description && map[prop.description]) {
          prop.description = map[prop.description];
        }
        if (prop.deprecationMessage && map[prop.deprecationMessage]) {
          prop.deprecationMessage = map[prop.deprecationMessage];
        }
      }
    }
  }

  // 4. 注入标记并写回
  pkg.__antigravity_chinese_patched = true;
  pkg.__antigravity_chinese_version = require('../package.json').version;

  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, '\t') + '\n', 'utf-8');
  fs.writeFileSync(
    metaPath,
    JSON.stringify({ patched: true, timestamp: Date.now(), extDir }, null, 2),
    'utf-8'
  );

  return {
    success: true,
    message: `成功为 VS Code 扩展注入全景中文本地化: ${extDir}`,
    extDir
  };
}

/**
 * 一键还原 VS Code 扩展（恢复官方原版）
 * @param {string} [customDir] 自定义扩展目录
 * @returns {{ success: boolean, message: string }}
 */
function restoreVsCodePatch(customDir) {
  const extDir = findVsCodeExtensionDir(customDir);
  if (!extDir) {
    return {
      success: false,
      message: '未检测到 VS Code 的 Google Antigravity 扩展目录。'
    };
  }

  const pkgPath = path.join(extDir, 'package.json');
  const bakPath = path.join(extDir, 'package.json.bak');
  const metaPath = path.join(extDir, '.antigravity_vscode_meta.json');

  if (!fs.existsSync(bakPath)) {
    // 检查是否被打过补丁
    if (isVsCodeExtensionPatched(extDir)) {
      return { success: false, message: '未找到官方原版备份 package.json.bak，无法还原。' };
    }
    return { success: true, message: '扩展当前为官方原生状态，无需还原。' };
  }

  fs.copyFileSync(bakPath, pkgPath);
  try {
    fs.unlinkSync(metaPath);
  } catch (_) {}

  return {
    success: true,
    message: `成功恢复 VS Code 扩展至官方原生纯净状态: ${extDir}`
  };
}

module.exports = {
  findVsCodeExtensionDir,
  isVsCodeExtensionPatched,
  installVsCodePatch,
  restoreVsCodePatch,
  VSCODE_TRANSLATION_MAP
};
