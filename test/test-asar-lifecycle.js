const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');
const { isAsarPatched } = require('../cli');

console.log('🧪 ============================================================');
console.log('🧪 开始执行真实 ASAR 生命周期注入、二次安装幂等与上游升级回归测试');
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
const cliPath = path.join(__dirname, '..', 'cli.js');

fs.mkdirSync(resourcesDir, { recursive: true });
fs.mkdirSync(path.join(mockSrcDir, 'dist', 'ideInstall'), { recursive: true });

// 1. 创建逼真的 Electron 宿主源码 Mock (官方版本 A)
const origPreloadA = `"use strict";
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('api', { version: 'A' });
`;

const origMenuA = `"use strict";
const template = [
  { label: 'Command Palette', accelerator: 'CmdOrCtrl+Shift+P' },
  { label: 'Maximize', role: 'maximize' },
  { label: 'Minimize', role: 'minimize' }
];
`;

const origIpcA = `"use strict";
dialog.showOpenDialog({ title: 'Open workspace' });
`;

const origWizardA = `"use strict";
function getWizardHtml() {
  return '<title>Welcome to Antigravity</title><div>Setting up…</div>';
}
`;

fs.writeFileSync(path.join(mockSrcDir, 'dist', 'preload.js'), origPreloadA, 'utf-8');
fs.writeFileSync(path.join(mockSrcDir, 'dist', 'menu.js'), origMenuA, 'utf-8');
fs.writeFileSync(path.join(mockSrcDir, 'dist', 'ipcHandlers.js'), origIpcA, 'utf-8');
fs.writeFileSync(path.join(mockSrcDir, 'dist', 'ideInstall', 'wizardHtml.js'), origWizardA, 'utf-8');

try {
  // 2. 打包出真实的初始 app.asar (版本 A)
  execSync(`npx -y @electron/asar@3.2.14 pack "${mockSrcDir}" "${asarPath}"`, { stdio: 'ignore' });
  assert(fs.existsSync(asarPath), '【阶段 1】初始版本 A app.asar 构建成功');
  assert(!isAsarPatched(asarPath), '初始版本 A 确认为原生未修改状态');

  // 3. 首次执行 install
  execSync(`node "${cliPath}" install --path "${testDir}"`, { stdio: 'ignore' });
  assert(fs.existsSync(backupPath), '首次安装成功生成纯净备份 app.asar.bak (版本 A)');
  assert(isAsarPatched(asarPath), '首次安装后当前 ASAR 处于汉化状态');

  // 4. 【P0 关键用例】二次重复执行 install (验证绝不把已打补丁的 ASAR 存为备份)
  console.log('🔄 执行二次重复 install...');
  execSync(`node "${cliPath}" install --path "${testDir}"`, { stdio: 'ignore' });
  assert(isAsarPatched(asarPath), '二次安装后仍然处于汉化状态');

  // 执行 restore 并验证是否 100% 回滚为纯净版本 A
  execSync(`node "${cliPath}" restore --path "${testDir}"`, { stdio: 'ignore' });
  assert(!isAsarPatched(asarPath), '二次安装后执行 restore，成功恢复为未打补丁状态');

  const unpackDirA = path.join(testDir, 'unpack_A');
  execSync(`npx -y @electron/asar@3.2.14 extract "${asarPath}" "${unpackDirA}"`, { stdio: 'ignore' });
  const restoredPreloadA = fs.readFileSync(path.join(unpackDirA, 'dist', 'preload.js'), 'utf-8');
  assert(restoredPreloadA === origPreloadA, '【P0 验证通过】二次安装后 restore 仍 100% 等于官方原版 A (未被已打补丁副本污染)');

  // 5. 【P0 关键用例】模拟官方静默发版升级为版本 B
  console.log('\n📦 【阶段 2】模拟上游官方升级为全新版本 B...');
  const origPreloadB = `"use strict";
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('api', { version: 'B_UPSTREAM_NEW' });
`;
  fs.writeFileSync(path.join(mockSrcDir, 'dist', 'preload.js'), origPreloadB, 'utf-8');
  execSync(`npx -y @electron/asar@3.2.14 pack "${mockSrcDir}" "${asarPath}"`, { stdio: 'ignore' });
  assert(!isAsarPatched(asarPath), '官方新版本 B 已覆盖为原生未打补丁状态');

  // 在版本 B 上执行 install
  execSync(`node "${cliPath}" install --path "${testDir}"`, { stdio: 'ignore' });
  assert(isAsarPatched(asarPath), '版本 B 注入汉化成功');

  // 再次在版本 B 上重复执行 install
  execSync(`node "${cliPath}" install --path "${testDir}"`, { stdio: 'ignore' });
  assert(isAsarPatched(asarPath), '版本 B 重复安装保持有效');

  // 执行 restore，必须 100% 还原为官方版本 B（绝不能退回历史旧版本 A！）
  execSync(`node "${cliPath}" restore --path "${testDir}"`, { stdio: 'ignore' });
  assert(!isAsarPatched(asarPath), '版本 B restore 后恢复为未修改状态');

  const unpackDirB = path.join(testDir, 'unpack_B');
  execSync(`npx -y @electron/asar@3.2.14 extract "${asarPath}" "${unpackDirB}"`, { stdio: 'ignore' });
  const restoredPreloadB = fs.readFileSync(path.join(unpackDirB, 'dist', 'preload.js'), 'utf-8');
  assert(restoredPreloadB === origPreloadB, '【P0 验证通过】版本 B 上打补丁并 restore 后 100% 等于新版本 B (绝未回退老版本 A)');

} finally {
  // 清理测试临时目录
  if (fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
}

console.log('\n============================================================');
console.log(`📊 ASAR 真实注入与上游升级演进测试完成: 共 ${passed + failed} 项, 通过 ${passed} 项, 失败 ${failed} 项`);
console.log('============================================================\n');

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
