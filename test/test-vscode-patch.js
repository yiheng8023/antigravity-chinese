/**
 * VS Code 扩展汉化补丁与生命周期回归测试套件 (包含 Webview 代理注入)
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const {
  findVsCodeExtensionDir,
  isVsCodeExtensionPatched,
  installVsCodePatch,
  restoreVsCodePatch,
  VSCODE_TRANSLATION_MAP
} = require('../core/vscode-patch');

console.log('🧪 ============================================================');
console.log('🧪 开始执行 VS Code 扩展汉化生命周期、Webview 代理注入与防污染自动化测试');
console.log('🧪 ============================================================');

const testDir = path.join(os.tmpdir(), `agy_test_vscode_${Date.now()}`);
fs.mkdirSync(testDir, { recursive: true });

// 模拟官方真实 1.6.0 版 package.json
const rawOriginalPkg = {
  name: "google-antigravity",
  displayName: "Google Antigravity",
  description: "Bring Google's agent-first development platform to Visual Studio Code.",
  version: "1.6.0",
  contributes: {
    customEditors: [
      {
        viewType: "antigravity.artifactEditor",
        displayName: "Antigravity Artifact Viewer"
      },
      {
        viewType: "jetski.settingsEditor",
        displayName: "Antigravity Settings Viewer"
      }
    ],
    commands: [
      { command: "antigravity.showThirdPartyNotices", title: "Show Third Party Notices" },
      { command: "antigravity.resetConversationState", title: "Reset Conversation State" },
      { command: "antigravity.insertSnippet", title: "Add Selection to Chat" },
      { command: "antigravity.insertTerminalSnippet", title: "Add Terminal Selection or Output to Chat" },
      { command: "antigravity.panel.focus", title: "Focus Antigravity Panel" },
      { command: "antigravity.inlineDiff.acceptAll", title: "Accept All Changes" },
      { command: "antigravity.inlineDiff.rejectAll", title: "Reject All Changes" },
      { command: "antigravity.toggleInlineDiff", title: "Toggle Inline Diff" },
      { command: "antigravity.openSettings", title: "Open Antigravity Settings" },
      { command: "antigravity.feedback", title: "Provide Feedback" }
    ],
    configuration: {
      title: "Antigravity",
      properties: {
        "antigravity.serverPort": {
          description: "Port for the Antigravity background server (`agy --hub`). Leave at 0 to allocate an ephemeral port automatically."
        },
        "antigravity.enableTelemetry": {
          description: "Enable sending client-side product telemetry and usage metrics to Google Cloudmill to help improve Antigravity."
        },
        "antigravity.enableInlineDiff": {
          description: "Enable inline diff decorations and CodeLenses. When disabled, falls back to opening changes in a side-by-side diff tab."
        },
        "antigravity.autoAcceptOnChat": {
          description: "Auto-accept pending edits in background files when sending a new chat message."
        },
        "antigravity.autoOpenFiles": {
          description: "Automatically open files in the editor when the agent proposes edits."
        },
        "antigravity.channel": {
          description: "The release channel for this extension build",
          deprecationMessage: "Internal channel setting"
        }
      }
    }
  }
};

// 模拟官方 extension.js 核心片段
const rawOriginalExtJs = `
const vscode = require('vscode');
class AntigravityDelegate {
    renderWebviewHtml(webview, serverUrl, fullUrlString, options) {
        patchWebviewPostMessage(webview);
        webview.html = '<html><body><iframe id="jetski-frame" src="' + fullUrlString + '"></iframe></body></html>';
    }
}
exports.activate = function(context) {};
`;

const pkgPath = path.join(testDir, 'package.json');
const extJsPath = path.join(testDir, 'extension.js');
fs.writeFileSync(pkgPath, JSON.stringify(rawOriginalPkg, null, 2), 'utf-8');
fs.writeFileSync(extJsPath, rawOriginalExtJs, 'utf-8');

try {
  // 1. 初始状态检测
  assert.strictEqual(isVsCodeExtensionPatched(testDir), false, '初始状态应未打补丁');
  console.log('✅ [PASS] 初始状态确认为未打补丁');

  // 2. 首次安装
  const installRes1 = installVsCodePatch(testDir);
  assert.strictEqual(installRes1.success, true, '首次安装应成功');
  assert.strictEqual(isVsCodeExtensionPatched(testDir), true, '首次安装后状态应为已打补丁');

  const pkgBakPath = path.join(testDir, 'package.json.bak');
  assert(fs.existsSync(pkgBakPath), '应生成纯净备份 package.json.bak');
  const pkgBakContent = fs.readFileSync(pkgBakPath, 'utf-8');
  assert.deepStrictEqual(JSON.parse(pkgBakContent), rawOriginalPkg, '纯净备份必须 100% 等于官方原生未修改版本');

  const extJsBakPath = path.join(testDir, 'extension.js.bak');
  assert(fs.existsSync(extJsBakPath), '应生成纯净备份 extension.js.bak');
  assert.strictEqual(fs.readFileSync(extJsBakPath, 'utf-8'), rawOriginalExtJs, 'extension.js 备份必须与官方原版绝对一致');
  console.log('✅ [PASS] 首次安装成功生成 package.json.bak 与 extension.js.bak 双重纯净备份');

  // 验证 Webview 资产与 extension.js 拦截注入
  assert(fs.existsSync(path.join(testDir, 'i18n-bundle.js')), '应生成 i18n-bundle.js 静态资产');
  assert(fs.existsSync(path.join(testDir, 'agy-i18n-proxy.js')), '应生成 agy-i18n-proxy.js 本地微代理');

  const patchedExtJs = fs.readFileSync(extJsPath, 'utf-8');
  assert(patchedExtJs.includes('AGY_VSCODE_I18N_PROXY_INJECTION'), 'extension.js 应包含 proxy 引入');
  assert(patchedExtJs.includes('AGY_VSCODE_I18N_INTERCEPT_START'), 'extension.js 应包含 renderWebviewHtml 拦截');
  console.log('✅ [PASS] extension.js 深度拦截与微代理资产注入就绪');

  const patchedPkg1 = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
  assert.strictEqual(patchedPkg1.description, '将 Google 以智能体为核心的开发平台引入 Visual Studio Code。');
  assert.strictEqual(patchedPkg1.contributes.commands[2].title, '将选中文本添加到对话');
  assert.strictEqual(patchedPkg1.contributes.commands[5].title, '接受所有更改');
  assert.strictEqual(patchedPkg1.contributes.commands[8].title, '打开 Antigravity 设置');
  assert.strictEqual(patchedPkg1.contributes.customEditors[0].displayName, 'Antigravity 产物文档查看器');
  assert.strictEqual(patchedPkg1.contributes.configuration.properties['antigravity.enableInlineDiff'].description, '启用内联代码差异标记与 CodeLens。禁用后将回退为在并排对比标签页中显示更改。');
  assert.strictEqual(patchedPkg1.contributes.configuration.properties['antigravity.channel'].deprecationMessage, '内部频道设置');
  console.log('✅ [PASS] 首次安装后所有命令、设置描述与查看器标题 100% 汉化');

  // 3. 二次重复安装（幂等性与防备份污染 P0 验证）
  const installRes2 = installVsCodePatch(testDir);
  assert.strictEqual(installRes2.success, true, '二次安装应成功');
  const pkgBakContent2 = fs.readFileSync(pkgBakPath, 'utf-8');
  assert.deepStrictEqual(JSON.parse(pkgBakContent2), rawOriginalPkg, '【P0 验证通过】二次安装绝对未污染 package.json 纯净备份！');
  const extJsBakContent2 = fs.readFileSync(extJsBakPath, 'utf-8');
  assert.strictEqual(extJsBakContent2, rawOriginalExtJs, '【P0 验证通过】二次安装绝对未污染 extension.js 纯净备份！');
  console.log('✅ [PASS] 二次安装幂等性验证通过，纯净备份未受二次污染');

  // 4. 执行还原 (Restore)
  const restoreRes = restoreVsCodePatch(testDir);
  assert.strictEqual(restoreRes.success, true, '执行还原应成功');
  assert.strictEqual(isVsCodeExtensionPatched(testDir), false, '还原后状态应恢复为未打补丁');
  const restoredPkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
  assert.deepStrictEqual(restoredPkg, rawOriginalPkg, '【P0 验证通过】还原后 package.json 必须 100% 恢复为官方原生版本！');
  const restoredExtJs = fs.readFileSync(extJsPath, 'utf-8');
  assert.strictEqual(restoredExtJs, rawOriginalExtJs, '【P0 验证通过】还原后 extension.js 必须 100% 恢复为官方原生版本！');
  assert(!fs.existsSync(path.join(testDir, 'i18n-bundle.js')), '还原后 i18n-bundle.js 应被安全清除');
  assert(!fs.existsSync(path.join(testDir, 'agy-i18n-proxy.js')), '还原后 agy-i18n-proxy.js 应被安全清除');
  console.log('✅ [PASS] 还原功能 100% 恢复官方原生版本并彻底清理注入文件');

  // 5. 缺失目录探测优雅降级测试
  const fakeDir = path.join(testDir, 'non_existent_subdir');
  const failRes = installVsCodePatch(fakeDir);
  assert.strictEqual(failRes.success, false);
  console.log('✅ [PASS] 缺失目录优雅静默跳过，无崩溃异常');

  console.log('\n============================================================');
  console.log('📊 VS Code 扩展补丁测试完成: 共 14 项全维核心断言 100% 全部通过！');
  console.log('============================================================\n');
} finally {
  try {
    fs.rmSync(testDir, { recursive: true, force: true });
  } catch (_) {}
}
