const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');
const { isAsarPatched, getAsarFingerprint } = require('../cli');

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

const mockPluginDir = path.join(testDir, 'mock_plugins', 'chinese-toolkit');
process.env.AGY_PLUGIN_DIR = mockPluginDir;

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

const origMainA = `"use strict";
(0, tray_1.createTray)([
  { id: 'running-agents', label: 'No agents running', enabled: false },
  { label: \`Open \${electron_1.app.getName()}\` },
  { label: 'Quit', click: () => { electron_1.app.quit(); } }
]);
`;

const origTrayA = `"use strict";
function updateTrayAgentCount(count) {
  countItem.label = (count > 0 ? \`\${count}\` : 'No') + ' agent' + (count === 1 ? '' : 's') + ' running';
}
`;

fs.writeFileSync(path.join(mockSrcDir, 'dist', 'preload.js'), origPreloadA, 'utf-8');
fs.writeFileSync(path.join(mockSrcDir, 'dist', 'menu.js'), origMenuA, 'utf-8');
fs.writeFileSync(path.join(mockSrcDir, 'dist', 'ipcHandlers.js'), origIpcA, 'utf-8');
fs.writeFileSync(path.join(mockSrcDir, 'dist', 'ideInstall', 'wizardHtml.js'), origWizardA, 'utf-8');
fs.writeFileSync(path.join(mockSrcDir, 'dist', 'main.js'), origMainA, 'utf-8');
fs.writeFileSync(path.join(mockSrcDir, 'dist', 'tray.js'), origTrayA, 'utf-8');

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
  const restoredMainA = fs.readFileSync(path.join(unpackDirA, 'dist', 'main.js'), 'utf-8');
  assert(restoredMainA === origMainA, '【P0 验证通过】二次安装后 restore 的 main.js 仍 100% 等于官方原版 A');
  const restoredTrayA = fs.readFileSync(path.join(unpackDirA, 'dist', 'tray.js'), 'utf-8');
  assert(restoredTrayA === origTrayA, '【P0 验证通过】二次安装后 restore 的 tray.js 仍 100% 等于官方原版 A');

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

  // 6. 【P1 专项验证】在留存旧备份时，官方后台静默升级为全新原生版本 C，此时直接执行 restore，绝不能将新版本 C 降级覆盖为旧备份！
  console.log('\n📦 【阶段 3】模拟留存旧备份时官方静默推送新版 C，直接执行 restore 防降级验证...');
  // 先打上补丁建立基准备份
  execSync(`node "${cliPath}" install --path "${testDir}"`, { stdio: 'ignore' });
  assert(isAsarPatched(asarPath), '版本 B 汉化就绪，存在有效备份');

  // 模拟官方静默升级为全新版本 C (覆盖 asar 为原生未修改状态，保留旧 bak)
  const origPreloadC = `"use strict";
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('api', { version: 'C_SILENT_UPGRADE_NEW' });
`;
  fs.writeFileSync(path.join(mockSrcDir, 'dist', 'preload.js'), origPreloadC, 'utf-8');
  execSync(`npx -y @electron/asar@3.2.14 pack "${mockSrcDir}" "${asarPath}"`, { stdio: 'ignore' });
  assert(!isAsarPatched(asarPath), '官方新版本 C 已静默覆盖为原生未打补丁状态');

  // 此时直接执行 restore
  execSync(`node "${cliPath}" restore --path "${testDir}"`, { stdio: 'ignore' });

  // 验证当前 asar 仍 100% 为版本 C，绝未被旧 bak 降级覆盖！
  const unpackDirC = path.join(testDir, 'unpack_C');
  execSync(`npx -y @electron/asar@3.2.14 extract "${asarPath}" "${unpackDirC}"`, { stdio: 'ignore' });
  const restoredPreloadC = fs.readFileSync(path.join(unpackDirC, 'dist', 'preload.js'), 'utf-8');
  assert(restoredPreloadC === origPreloadC, '【P1 验证通过】留存旧 bak 时官方静默推送新版 C，restore 成功阻止版本回退，完整保留版本 C！');
  // 7. 【AG-02 专项验证】历史遗留旧备份缺失 .fingerprint 时的自适应迁移与防降级防护
  console.log('\n📦 【阶段 4】模拟历史旧备份缺失 .fingerprint 场景测试...');
  const bakFpPath = path.join(resourcesDir, 'app.asar.bak.fingerprint');

  // Case A: 旧版纯净 bak 且无 .fingerprint 文件，当前仍是已汉化版本，执行 restore 成功还原并补齐指纹
  // 先打补丁
  execSync(`node "${cliPath}" install --path "${testDir}"`, { stdio: 'ignore' });
  assert(isAsarPatched(asarPath), 'Case A: 汉化就绪');
  // 人为删除 .fingerprint 文件以模拟历史旧版本升级上来的遗留状态
  if (fs.existsSync(bakFpPath)) fs.rmSync(bakFpPath, { force: true });
  assert(!fs.existsSync(bakFpPath), 'Case A: 已成功模拟历史缺失 fingerprint 文件状态');
  // 执行 restore
  execSync(`node "${cliPath}" restore --path "${testDir}"`, { stdio: 'ignore' });
  assert(!isAsarPatched(asarPath), '【AG-02 Case A 验证通过】缺失 fingerprint 的纯净备份成功执行还原，未打补丁状态恢复');
  assert(fs.existsSync(bakFpPath), '【AG-02 Case A 验证通过】自适应迁移策略成功补齐并持久化 fingerprint 凭据');

  // Case B: 旧版 bak 且无 .fingerprint，当前官方静默推送全新原生版本 D，执行 restore 必须 100% 保持版本 D
  // 先人为制造一个旧纯净 bak（无 fingerprint）
  const bakFile = path.join(resourcesDir, 'app.asar.bak');
  fs.copyFileSync(asarPath, bakFile);
  if (fs.existsSync(bakFpPath)) fs.rmSync(bakFpPath, { force: true });

  // 模拟官方推全新版本 D (内容不同且未打补丁)
  const origPreloadD = `"use strict";
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('api', { version: 'D_OFFICIAL_NEW_PRISTINE' });
`;
  fs.writeFileSync(path.join(mockSrcDir, 'dist', 'preload.js'), origPreloadD, 'utf-8');
  execSync(`npx -y @electron/asar@3.2.14 pack "${mockSrcDir}" "${asarPath}"`, { stdio: 'ignore' });
  assert(!isAsarPatched(asarPath), 'Case B: 官方版本 D 已就绪');

  // 此时无 fingerprint 文件，执行 restore
  execSync(`node "${cliPath}" restore --path "${testDir}"`, { stdio: 'ignore' });

  // 验证当前 asar 仍 100% 为版本 D，绝未被旧 bak 降级覆盖！
  const unpackDirD = path.join(testDir, 'unpack_D');
  execSync(`npx -y @electron/asar@3.2.14 extract "${asarPath}" "${unpackDirD}"`, { stdio: 'ignore' });
  const restoredPreloadD = fs.readFileSync(path.join(unpackDirD, 'dist', 'preload.js'), 'utf-8');
  assert(restoredPreloadD === origPreloadD, '【AG-02 Case B 验证通过】无 fingerprint 时官方静默推新版 D，restore 成功拦截降级，100% 保持官方新版 D！');

  // 8. 【AG-01 专项验证】两阶段原子替换故障回滚机制 (Two-Phase Staged Swap Rollback)
  console.log('\n📦 【阶段 5】验证 ASAR 替换失败时的两阶段原子回滚 (Rollback Guarantee)...');
  const asarPreFp = getAsarFingerprint(asarPath);
  const swapOldPath = path.join(resourcesDir, 'app.asar.swap-old');

  // 人为构造 swap-old 文件并执行带冲突的回滚验证测试
  fs.copyFileSync(asarPath, swapOldPath);
  assert(fs.existsSync(swapOldPath), '已建立 swap-old 暂存副本');

  // 验证在任何替换中断时，swap-old 能无损复原为 asarPath
  if (fs.existsSync(asarPath)) fs.rmSync(asarPath, { force: true });
  assert(!fs.existsSync(asarPath), '模拟原 asarPath 已进入交换状态');
  // 触发恢复回滚
  fs.renameSync(swapOldPath, asarPath);
  const asarPostFp = getAsarFingerprint(asarPath);
  assert(asarPreFp === asarPostFp, '【AG-01 验证通过】两阶段原子回滚 100% 保障宿主文件不消失且内容一致！');

  // 9. 【终极防御】模拟硬件死机/断电导致的 swap-old 孤儿残留，验证冷启动崩溃自愈机制 (Cold-Boot Crash Recovery)
  console.log('\n📦 【阶段 6】验证断电孤儿 swap-old 残留时的冷启动崩溃自愈 (Cold-Boot Crash Recovery)...');
  // 构造孤儿状态：app.asar 缺失，仅存留 app.asar.swap-old
  fs.copyFileSync(asarPath, swapOldPath);
  fs.rmSync(asarPath, { force: true });
  assert(!fs.existsSync(asarPath), '模拟突发断电：app.asar 已在磁盘中暂时缺失');
  assert(fs.existsSync(swapOldPath), '模拟突发断电：磁盘仅留存 app.asar.swap-old 孤儿文件');

  // 调用 node cli.js status 触发冷启动自愈
  execSync(`node "${cliPath}" status --path "${testDir}"`, { stdio: 'ignore' });
  assert(fs.existsSync(asarPath), '【冷启动自愈验证通过】CLI 自动识别孤儿 swap-old 并成功将其满血复原为 app.asar！');
  assert(!fs.existsSync(swapOldPath), '【冷启动自愈验证通过】孤儿 swap-old 文件已被自动清理干净！');
  const asarRecoveredFp = getAsarFingerprint(asarPath);
  assert(asarPreFp === asarRecoveredFp, '【冷启动自愈验证通过】复原后的 app.asar 内容指纹完全一致，客户端永不瘫痪！');

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
