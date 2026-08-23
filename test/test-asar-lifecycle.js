const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');
const { isAsarPatched } = require('../cli');

console.log('🧪 ============================================================');
console.log('🧪 开始执行真实 ASAR 生命周期注入与原子回滚端到端全真测试');
console.log('🧪 ============================================================\n');

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`✅ [PASS] ${message}`);
    passed++;
  } else {
    console.error(`❌ [FAIL] ${message}`);
    failed++;
  }
}

const testDir = path.join(os.tmpdir(), `agy_test_asar_${Date.now()}`);
const resourcesDir = path.join(testDir, 'resources');
const mockSrcDir = path.join(testDir, 'src_mock');
const asarPath = path.join(resourcesDir, 'app.asar');
const backupPath = path.join(resourcesDir, 'app.asar.bak');

fs.mkdirSync(resourcesDir, { recursive: true });
fs.mkdirSync(path.join(mockSrcDir, 'dist', 'ideInstall'), { recursive: true });

// 1. 创建逼真的 Electron 宿主源码 Mock
const origPreload = `"use strict";
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('api', { test: true });
`;

const origMenu = `"use strict";
const template = [
  { label: 'Command Palette', accelerator: 'CmdOrCtrl+Shift+P' },
  { label: 'Maximize', role: 'maximize' },
  { label: 'Minimize', role: 'minimize' }
];
`;

const origIpc = `"use strict";
dialog.showOpenDialog({ title: 'Open workspace' });
`;

const origWizard = `"use strict";
function getWizardHtml() {
  return '<title>Welcome to Antigravity</title><div>Setting up…</div>';
}
`;

fs.writeFileSync(path.join(mockSrcDir, 'dist', 'preload.js'), origPreload, 'utf-8');
fs.writeFileSync(path.join(mockSrcDir, 'dist', 'menu.js'), origMenu, 'utf-8');
fs.writeFileSync(path.join(mockSrcDir, 'dist', 'ipcHandlers.js'), origIpc, 'utf-8');
fs.writeFileSync(path.join(mockSrcDir, 'dist', 'ideInstall', 'wizardHtml.js'), origWizard, 'utf-8');

// 2. 打包出真实的初始 app.asar
execSync(`npx -y @electron/asar pack "${mockSrcDir}" "${asarPath}"`, { stdio: 'ignore' });
assert(fs.existsSync(asarPath), '初始真实 app.asar 二进制包构建成功');
assert(!isAsarPatched(asarPath), '初始 app.asar 确认为原生未修改状态 (isAsarPatched == false)');

// 3. 执行真正的 CLI 注入逻辑 (调用 cli.js install --path)
const cliPath = path.join(__dirname, '..', 'cli.js');
execSync(`node "${cliPath}" install --path "${testDir}"`, { stdio: 'ignore' });

assert(fs.existsSync(backupPath), '安装时成功生成物理级安全备份 app.asar.bak');
assert(isAsarPatched(asarPath), '打入补丁后 isAsarPatched 状态精准返回 true');

// 4. 解包验证注入后的文件真实内容
const verifyUnpackDir = path.join(testDir, 'verify_unpack');
execSync(`npx -y @electron/asar extract "${asarPath}" "${verifyUnpackDir}"`, { stdio: 'ignore' });

const patchedPreload = fs.readFileSync(path.join(verifyUnpackDir, 'dist', 'preload.js'), 'utf-8');
const patchedMenu = fs.readFileSync(path.join(verifyUnpackDir, 'dist', 'menu.js'), 'utf-8');
const patchedIpc = fs.readFileSync(path.join(verifyUnpackDir, 'dist', 'ipcHandlers.js'), 'utf-8');
const patchedWizard = fs.readFileSync(path.join(verifyUnpackDir, 'dist', 'ideInstall', 'wizardHtml.js'), 'utf-8');

assert(patchedPreload.includes('Antigravity Chinese Localization Injection'), 'preload.js 成功注入汉化运行时');
assert(patchedMenu.includes("'命令面板'") && patchedMenu.includes("'最大化'"), 'menu.js 成功替换原生顶栏菜单');
assert(patchedIpc.includes("'打开工作区'"), 'ipcHandlers.js 成功替换原生对话框标题');
assert(patchedWizard.includes('欢迎使用 Antigravity') && patchedWizard.includes('正在准备…'), 'wizardHtml.js 成功替换向导文本');

// 5. 执行真正的 CLI 还原逻辑 (调用 cli.js restore --path)
execSync(`node "${cliPath}" restore --path "${testDir}"`, { stdio: 'ignore' });

assert(!isAsarPatched(asarPath), '执行 restore 后 isAsarPatched 精准返回 false (已完全还原)');

const restoredUnpackDir = path.join(testDir, 'restored_unpack');
execSync(`npx -y @electron/asar extract "${asarPath}" "${restoredUnpackDir}"`, { stdio: 'ignore' });
const restoredPreload = fs.readFileSync(path.join(restoredUnpackDir, 'dist', 'preload.js'), 'utf-8');
assert(restoredPreload === origPreload, 'restore 后 preload.js 100% 恢复为出厂原始源码');

// 6. 清理测试临时目录
fs.rmSync(testDir, { recursive: true, force: true });

console.log('\n============================================================');
console.log(`📊 ASAR 真实注入测试完成: 共 ${passed + failed} 项, 通过 ${passed} 项, 失败 ${failed} 项`);
console.log('============================================================\n');

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
