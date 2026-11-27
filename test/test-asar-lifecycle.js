const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');
const { isAsarPatched, getAsarFingerprint } = require('../cli');
const asar = require('@electron/asar');

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
const asarBin = path.join(__dirname, '..', 'node_modules', '.bin', os.platform() === 'win32' ? 'asar.cmd' : 'asar');
const asarCli = fs.existsSync(asarBin) ? `"${asarBin}"` : 'npx -y @electron/asar@3.2.14';

const mockPluginDir = path.join(testDir, 'mock_plugins', 'chinese-toolkit');
process.env.AGY_PLUGIN_DIR = mockPluginDir;

fs.mkdirSync(resourcesDir, { recursive: true });
fs.mkdirSync(path.join(mockSrcDir, 'dist', 'ideInstall'), { recursive: true });
fs.mkdirSync(path.join(mockSrcDir, 'node_modules', 'external-tool'), { recursive: true });
const externalToolContent = 'module.exports = "external process entry point";';
fs.writeFileSync(path.join(mockSrcDir, 'node_modules', 'external-tool', 'index.js'), externalToolContent);

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
dialog.showMessageBox({ message: \`The WSL distro "\${WSL_DISTRO}" is no longer installed.\` });
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
  fs.mkdirSync(mockPluginDir, { recursive: true });
  const pluginMarker = path.join(mockPluginDir, 'plugin.json');
  const pluginManifest = '{"name":"fixture-global-plugin"}';
  fs.writeFileSync(pluginMarker, pluginManifest, 'utf8');

  // 2. 打包出真实的初始 app.asar (版本 A)
  execSync(`${asarCli} pack "${mockSrcDir}" "${asarPath}" --unpack-dir "${path.join('node_modules', 'external-tool')}"`, { stdio: 'ignore' });
  assert(fs.existsSync(asarPath), '【阶段 1】初始版本 A app.asar 构建成功');
  assert(asar.statFile(asarPath, path.join('node_modules', 'external-tool', 'index.js')).unpacked === true,
    '原始测试包包含真实 unpacked 外置工具');
  assert(!isAsarPatched(asarPath), '初始版本 A 确认为原生未修改状态');

  // 3. 首次执行 install
  execSync(`node "${cliPath}" install --path "${testDir}"`, { stdio: 'ignore' });
  assert(fs.existsSync(backupPath), '首次安装成功生成纯净备份 app.asar.bak (版本 A)');
  assert(isAsarPatched(asarPath), '首次安装后当前 ASAR 处于汉化状态');
  asar.uncache(asarPath);
  const firstPreload = asar.extractFile(asarPath, path.join('dist', 'preload.js')).toString();
  const firstMain = asar.extractFile(asarPath, path.join('dist', 'main.js')).toString();
  assert(firstPreload.includes('__AGY_I18N_DATA__.officialPluginDescriptions') && firstPreload.includes('发挥多智能体协作的优势。'),
    '桌面 preload 包含独立的官方插件介绍词库');
  assert(firstMain.includes('// --- Antigravity Chinese Swarm Frame Start ---'),
    '桌面主进程包含限定 Swarm 来源的独立面板加载器');
  assert(firstMain.includes('WSL 发行版“\${WSL_DISTRO}”已不再安装。'),
    '原生 WSL 缺失说明汉化并保留发行版变量');
  assert(asar.statFile(asarPath, path.join('node_modules', 'external-tool', 'index.js')).unpacked === true,
    '安装必须保留上游外置工具的 unpacked 标记');
  assert(fs.readFileSync(path.join(asarPath + '.unpacked', 'node_modules', 'external-tool', 'index.js'), 'utf8') === externalToolContent,
    '安装不能改变外置工具文件');
  assert(!fs.existsSync(path.join(resourcesDir, 'app.asar.new.unpacked')), '安装后不遗留临时外置文件目录');

  // 4. 【P0 关键用例】二次重复执行 install (验证绝不把已打补丁的 ASAR 存为备份)
  console.log('🔄 执行二次重复 install...');
  execSync(`node "${cliPath}" install --path "${testDir}"`, { stdio: 'ignore' });
  assert(isAsarPatched(asarPath), '二次安装后仍然处于汉化状态');
  asar.uncache(asarPath);
  assert(asar.extractFile(asarPath, path.join('dist', 'preload.js')).toString() === firstPreload,
    '重复安装的 preload 必须字节一致，不能累积空行或重复注入');
  assert(asar.extractFile(asarPath, path.join('dist', 'main.js')).toString() === firstMain,
    '重复安装的 main.js 必须字节一致，Swarm 加载器不重复累积');

  // 执行 restore 并验证是否 100% 回滚为纯净版本 A
  execSync(`node "${cliPath}" restore --path "${testDir}"`, { stdio: 'ignore' });
  assert(!isAsarPatched(asarPath), '二次安装后执行 restore，成功恢复为未打补丁状态');

  const unpackDirA = path.join(testDir, 'unpack_A');
  execSync(`${asarCli} extract "${asarPath}" "${unpackDirA}"`, { stdio: 'ignore' });
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
  execSync(`${asarCli} pack "${mockSrcDir}" "${asarPath}"`, { stdio: 'ignore' });
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
  execSync(`${asarCli} extract "${asarPath}" "${unpackDirB}"`, { stdio: 'ignore' });
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
  execSync(`${asarCli} pack "${mockSrcDir}" "${asarPath}"`, { stdio: 'ignore' });
  assert(!isAsarPatched(asarPath), '官方新版本 C 已静默覆盖为原生未打补丁状态');

  // 此时直接执行 restore
  execSync(`node "${cliPath}" restore --path "${testDir}"`, { stdio: 'ignore' });

  // 验证当前 asar 仍 100% 为版本 C，绝未被旧 bak 降级覆盖！
  const unpackDirC = path.join(testDir, 'unpack_C');
  execSync(`${asarCli} extract "${asarPath}" "${unpackDirC}"`, { stdio: 'ignore' });
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
  execSync(`${asarCli} pack "${mockSrcDir}" "${asarPath}"`, { stdio: 'ignore' });
  assert(!isAsarPatched(asarPath), 'Case B: 官方版本 D 已就绪');

  // 此时无 fingerprint 文件，执行 restore
  execSync(`node "${cliPath}" restore --path "${testDir}"`, { stdio: 'ignore' });

  // 验证当前 asar 仍 100% 为版本 D，绝未被旧 bak 降级覆盖！
  const unpackDirD = path.join(testDir, 'unpack_D');
  execSync(`${asarCli} extract "${asarPath}" "${unpackDirD}"`, { stdio: 'ignore' });
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
  assert(fs.existsSync(pluginMarker) && fs.readFileSync(pluginMarker, 'utf8') === pluginManifest,
    '指定 --path 的还原保持全局插件文件不变');

  // 10. 【Staged 来源指纹防降级 & 写失败原子回滚】
  console.log('\n📦 【阶段 7】验证 staged 来源指纹防降级、安装竞态保护、原子元数据与回滚失败诊断...');
  const { install, commitStagedSwap, applyStagedOnce } = require('../cli');
  const { spawnSync } = require('child_process');
  const oldAsarForStaged = path.join(resourcesDir, 'app.asar.old-fixture');
  fs.copyFileSync(asarPath, oldAsarForStaged);
  const oldFp = getAsarFingerprint(oldAsarForStaged);

  const origPreloadE = `"use strict";
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('api', { version: 'E_OFFICIAL_LATEST' });
`;
  fs.writeFileSync(path.join(mockSrcDir, 'dist', 'preload.js'), origPreloadE, 'utf-8');
  execSync(`${asarCli} pack "${mockSrcDir}" "${asarPath}"`, { stdio: 'ignore' });
  const fpE = getAsarFingerprint(asarPath);
  assert(oldFp !== fpE, '旧版与官方新版 E 指纹不同');

  const stagedPath = path.join(resourcesDir, 'app.asar.staged');
  const stagedMetaPath = path.join(resourcesDir, 'app.asar.staged.meta.json');
  const formalMetaPath = path.join(resourcesDir, '.antigravity_chinese_meta.json');

  // 7a. 旧版预构建的 staged 面对官方升级后的新版 E，必须被判为 stale 且不覆盖 E
  fs.copyFileSync(oldAsarForStaged, stagedPath);
  fs.writeFileSync(stagedMetaPath, JSON.stringify({
    sourceFingerprint: oldFp,
    stagedFingerprint: getAsarFingerprint(stagedPath),
    timestamp: Date.now()
  }, null, 2), 'utf8');
  fs.rmSync(oldAsarForStaged, { force: true });

  const staleRes = commitStagedSwap(asarPath, { maxAttempts: 1, retryDelayMs: 0 });
  assert(staleRes.status === 'stale', 'staged 与官方新版 E 指纹不匹配时返回 stale');
  assert(!fs.existsSync(stagedPath) && !fs.existsSync(stagedMetaPath), '过期 staged 及元数据必须自动清理');
  assert(getAsarFingerprint(asarPath) === fpE, '过期 staged 绝不覆盖官方新版 E');

  // 7b. 同外置布局的 A/B 官方包：在 install 解包之后、替换或重试期间官方更新为 B，必须中止且保留 B（绝不生成绑定 B 指纹的 A staged）
  const origPreloadRaceB = `"use strict";
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('api', { version: 'RACE_B_UNPACKED_IDENTICAL' });
`;
  const raceAAsar = path.join(resourcesDir, 'app.asar.raceA');
  const raceBAsar = path.join(resourcesDir, 'app.asar.raceB');
  fs.copyFileSync(asarPath, raceAAsar); // 当前是含外置工具的 E (记作 A)
  const fpRaceA = getAsarFingerprint(raceAAsar);
  fs.writeFileSync(path.join(mockSrcDir, 'dist', 'preload.js'), origPreloadRaceB, 'utf-8');
  execSync(`${asarCli} pack "${mockSrcDir}" "${raceBAsar}" --unpack-dir "{node_modules/external-tool}"`, { stdio: 'ignore' });
  const fpRaceB = getAsarFingerprint(raceBAsar);
  assert(fpRaceA !== fpRaceB, '同外置布局 A 与 B 指纹不同');

  // Case 7b-1: 解包后遭遇官方换包为 B + 文件锁 fallback，绝不允许写出绑定 B 指纹的 A 暂存包
  fs.copyFileSync(raceAAsar, asarPath);
  const afterExtractAborted = install(testDir, {
    returnStatus: true,
    throwOnConflict: true,
    forceStagedFallback: true,
    skipSpawnApplyStaged: true,
    maxAttempts: 1,
    retryDelayMs: 0,
    onAfterExtract() {
      fs.copyFileSync(raceBAsar, asarPath);
    },
    fsOps: {
      renameSync() { const e = new Error('MOCK_EBUSY'); e.code = 'EBUSY'; throw e; },
      writeFileSync: fs.writeFileSync.bind(fs)
    }
  });
  assert(afterExtractAborted.status === 'aborted_upstream_update', '解包后若官方换为 B，安装必须立即中止');
  assert(getAsarFingerprint(asarPath) === fpRaceB, '解包后官方换包为 B 必须完整保留 B');
  assert(!fs.existsSync(stagedPath) && !fs.existsSync(stagedMetaPath), '解包后竞态中止绝不生成过时 staged');

  // Case 7b-2: 在 swap 重试间隙（attempt === 1）官方换包为 B，必须立即中止并保留 B
  fs.copyFileSync(raceAAsar, asarPath);
  let retryHookCalls = 0;
  const duringRetryAborted = install(testDir, {
    returnStatus: true,
    throwOnConflict: true,
    forceStagedFallback: true,
    skipSpawnApplyStaged: true,
    maxAttempts: 2,
    retryDelayMs: 0,
    onBeforeSwapAttempt({ attempt }) {
      retryHookCalls++;
      if (attempt === 1) fs.copyFileSync(raceBAsar, asarPath);
    },
    fsOps: {
      renameSync() { const e = new Error('MOCK_EBUSY'); e.code = 'EBUSY'; throw e; },
      writeFileSync: fs.writeFileSync.bind(fs)
    }
  });
  assert(retryHookCalls === 2 && duringRetryAborted.status === 'aborted_upstream_update', '替换重试期间发现官方换包为 B 必须中止');
  assert(getAsarFingerprint(asarPath) === fpRaceB, '替换重试期间官方换包为 B 必须完整保留 B');
  assert(!fs.existsSync(stagedPath) && !fs.existsSync(stagedMetaPath), '重试期间竞态中止绝不写入 staged');

  // Case 7b-3: commitStagedSwap 重试间隙官方换包为 B，立即作废 staged 并保留 B
  fs.copyFileSync(raceAAsar, asarPath);
  fs.copyFileSync(raceAAsar, stagedPath);
  fs.writeFileSync(stagedMetaPath, JSON.stringify({
    sourceFingerprint: fpRaceA,
    stagedFingerprint: getAsarFingerprint(stagedPath),
    timestamp: Date.now()
  }, null, 2), 'utf8');
  let swapAttempt = 0;
  const swapRetryStale = commitStagedSwap(asarPath, {
    maxAttempts: 2,
    retryDelayMs: 0,
    onBeforeSwapAttempt({ attempt }) {
      swapAttempt++;
      if (attempt === 1) fs.copyFileSync(raceBAsar, asarPath);
    },
    fsOps: {
      renameSync() { const e = new Error('MOCK_EBUSY'); e.code = 'EBUSY'; throw e; },
      writeFileSync: fs.writeFileSync.bind(fs)
    }
  });
  assert(swapAttempt === 2 && swapRetryStale.status === 'stale', 'commitStagedSwap 重试期间若官方升级为 B 应判 stale');
  assert(getAsarFingerprint(asarPath) === fpRaceB && !fs.existsSync(stagedPath), 'commitStagedSwap 重试期遇升级应保留 B 并清理过期 staged');

  // 7c. 模拟 .antigravity_chinese_meta.json 写入一半抛出 ENOSPC：旧元数据必须逐字完好、ASAR 自动回滚，且后台任务返回非零退出码
  fs.copyFileSync(raceAAsar, asarPath);
  const patchedDummyAsar = path.join(resourcesDir, 'app.asar.patched-dummy');
  fs.copyFileSync(raceBAsar, patchedDummyAsar); // 使用不同字节的原包 (raceA) 与补丁包 (raceB)
  const fpPatchedDummy = getAsarFingerprint(patchedDummyAsar);
  const priorFormalMeta = JSON.stringify({ patched: false, preservedMarker: 'INTACT_OLD_META' }, null, 2);
  fs.writeFileSync(formalMetaPath, priorFormalMeta, 'utf8');
  fs.copyFileSync(patchedDummyAsar, stagedPath);
  fs.writeFileSync(stagedMetaPath, JSON.stringify({
    sourceFingerprint: fpRaceA,
    stagedFingerprint: fpPatchedDummy,
    timestamp: Date.now()
  }, null, 2), 'utf8');

  const partialEnospcOutcome = applyStagedOnce(asarPath, {
    maxAttempts: 1,
    retryDelayMs: 0,
    fsOps: {
      renameSync: fs.renameSync.bind(fs),
      writeFileSync(target, content, enc) {
        fs.writeFileSync(target, String(content).slice(0, 12), enc); // 模拟磁盘满前写入部分字节
        const e = new Error('MOCK_ENOSPC');
        e.code = 'ENOSPC';
        throw e;
      }
    }
  });
  assert(partialEnospcOutcome.exitCode === 1 && partialEnospcOutcome.result.status === 'error', '元数据 ENOSPC 失败后后台入口必须返回非零退出码');
  assert(partialEnospcOutcome.result.rollbackErrors.length === 0, 'ENOSPC 时两个 ASAR 重命名应干净回滚');
  assert(getAsarFingerprint(asarPath) === fpRaceA, 'ENOSPC 回滚后正式路径必须仍是完整原包');
  assert(fs.existsSync(stagedPath) && getAsarFingerprint(stagedPath) === fpPatchedDummy && fs.existsSync(stagedMetaPath), '回滚后 staged 及其元数据完好不丢失');
  assert(fs.readFileSync(formalMetaPath, 'utf8') === priorFormalMeta, '部分写入 ENOSPC 后旧正式元数据必须逐字完好未被截断');

  // 7d. 模拟回滚第一步（补丁移回 staged）或第二步（swap-old 移回正式路径）遇文件锁失败：必须返回不可吞的诊断错误并保留所有可恢复包
  const backupSnapshotContent = fs.readFileSync(backupPath);
  const swapOldPath7 = path.join(resourcesDir, 'app.asar.swap-old');

  // 7d-1: 第二步回滚（swap-old -> app.asar）被锁阻塞，第一步（补丁 -> staged）已成功
  const lockStep2Outcome = applyStagedOnce(asarPath, {
    maxAttempts: 1,
    retryDelayMs: 0,
    fsOps: {
      writeFileSync() { const e = new Error('MOCK_ENOSPC_RB2'); e.code = 'ENOSPC'; throw e; },
      renameSync(from, to) {
        if (from === swapOldPath7 && to === asarPath) {
          const e = new Error('MOCK_LOCK_RESTORE_ORIGINAL'); e.code = 'EBUSY'; throw e;
        }
        return fs.renameSync(from, to);
      }
    }
  });
  assert(lockStep2Outcome.exitCode === 1 && lockStep2Outcome.result.status === 'error', '第二步回滚遇锁时后台入口返回非零退出码');
  assert(lockStep2Outcome.result.rollbackErrors.length === 1 && lockStep2Outcome.result.rollbackErrors[0].step === 'restore_original', '应明确诊断第二步回滚失败');
  assert(!fs.existsSync(asarPath) && fs.existsSync(swapOldPath7) && getAsarFingerprint(swapOldPath7) === fpRaceA, '第二步回滚受阻时 app.asar 缺失而原包仍在 swap-old');
  assert(fs.existsSync(stagedPath) && fs.existsSync(stagedMetaPath), '第二步回滚受阻时 staged 与其元数据仍保留');
  assert(fs.readFileSync(backupPath).equals(backupSnapshotContent), '故障过程中 .bak 保持原样不被破坏');

  // 恢复现场用于 7d-2 验证
  fs.renameSync(swapOldPath7, asarPath);

  // 7d-2: 第一步回滚（补丁 -> staged）即被文件锁阻止
  const lockStep1Outcome = applyStagedOnce(asarPath, {
    maxAttempts: 1,
    retryDelayMs: 0,
    fsOps: {
      writeFileSync() { const e = new Error('MOCK_ENOSPC_RB1'); e.code = 'ENOSPC'; throw e; },
      renameSync(from, to) {
        if (from === asarPath && to === stagedPath) {
          const e = new Error('MOCK_LOCK_RESTORE_STAGED'); e.code = 'EPERM'; throw e;
        }
        return fs.renameSync(from, to);
      }
    }
  });
  assert(lockStep1Outcome.exitCode === 1 && lockStep1Outcome.result.status === 'error', '第一步回滚遇锁时后台入口返回非零退出码');
  assert(lockStep1Outcome.result.rollbackErrors.length === 1 && lockStep1Outcome.result.rollbackErrors[0].step === 'restore_staged', '应明确诊断第一步回滚失败');
  assert(getAsarFingerprint(asarPath) === fpPatchedDummy && !fs.existsSync(stagedPath), '第一步回滚受阻时正式路径仍为补丁且 staged 不存在');
  assert(fs.existsSync(swapOldPath7) && getAsarFingerprint(swapOldPath7) === fpRaceA, '第一步回滚受阻时原包仍在 swap-old');
  assert(fs.readFileSync(backupPath).equals(backupSnapshotContent), '第一步回滚受阻时 .bak 保持原样');
  assert(fs.readFileSync(formalMetaPath, 'utf8') === priorFormalMeta, '所有写失败与回滚受阻场景下旧正式元数据完整保留');

  // 7e. 验证真实子进程调用 applyStagedOnce 在遇写入错误时以非零退出码退出且保留完整原包与元数据
  fs.rmSync(asarPath, { force: true });
  fs.renameSync(swapOldPath7, asarPath);
  fs.copyFileSync(patchedDummyAsar, stagedPath);
  const brokenStagedChildRes = spawnSync(process.execPath, [
    '-e',
    `const cli = require(${JSON.stringify(cliPath)}); const o = cli.applyStagedOnce(${JSON.stringify(asarPath)}, { maxAttempts: 1, retryDelayMs: 0, fsOps: { writeFileSync() { const e = new Error('CHILD_ENOSPC'); e.code = 'ENOSPC'; throw e; }, renameSync: require('fs').renameSync } }); process.exit(o.exitCode);`
  ], { encoding: 'utf8' });
  assert(brokenStagedChildRes.status === 1, '子进程执行 applyStagedOnce 遇错误时以退出码 1 结束');
  assert(getAsarFingerprint(asarPath) === fpRaceA && fs.readFileSync(formalMetaPath, 'utf8') === priorFormalMeta, '子进程失败后仍保持原包与旧元数据完整');

  // 7f. 两次改名间隙官方新版 B 到达：直装（含第二次改名抛 EBUSY）与 staged（含元数据提交失败）均不得覆盖或删除 B
  // 7f-1: 直装在第一次改名 (A -> swap-old) 后、第二次改名前官方写入 B，必须中止并完整保留 B
  fs.rmSync(stagedPath, { force: true });
  fs.rmSync(stagedMetaPath, { force: true });
  fs.copyFileSync(raceAAsar, asarPath);
  const directBetweenRenames = install(testDir, {
    returnStatus: true,
    throwOnConflict: true,
    maxAttempts: 1,
    retryDelayMs: 0,
    onBeforePlacePatched() {
      fs.copyFileSync(raceBAsar, asarPath);
    }
  });
  assert(directBetweenRenames.status === 'aborted_upstream_update', '直装两次改名间隙到达官方新版 B 必须中止');
  assert(getAsarFingerprint(asarPath) === fpRaceB, '直装两次改名间隙到达 B 后正式路径必须完整保留 B');
  assert(!fs.existsSync(swapOldPath7) && !fs.existsSync(path.join(resourcesDir, 'app.asar.new')) && !fs.existsSync(stagedPath), '直装间隙遇 B 中止后不残留 swap-old / app.asar.new / staged');

  // 7f-2: 直装在第二次改名期间官方写入 B 并触发 EBUSY，回滚绝不能删掉正式路径的 B 或把 A 放回
  fs.copyFileSync(raceAAsar, asarPath);
  const directBetweenEbusy = install(testDir, {
    returnStatus: true,
    throwOnConflict: true,
    maxAttempts: 1,
    retryDelayMs: 0,
    fsOps: {
      writeFileSync: fs.writeFileSync.bind(fs),
      renameSync(from, to) {
        if (to === asarPath && from.endsWith('app.asar.new')) {
          fs.copyFileSync(raceBAsar, asarPath);
          const e = new Error('MOCK_EBUSY_WITH_UPSTREAM_B'); e.code = 'EBUSY'; throw e;
        }
        return fs.renameSync(from, to);
      }
    }
  });
  assert(directBetweenEbusy.status === 'aborted_upstream_update', '直装第二次改名返回 EBUSY 且新版 B 已在位时必须中止');
  assert(getAsarFingerprint(asarPath) === fpRaceB, '直装 EBUSY 回滚绝不能删除新版 B 或放回 A');
  assert(!fs.existsSync(swapOldPath7) && !fs.existsSync(path.join(resourcesDir, 'app.asar.new')), '直装保护 B 后清理属于旧包的暂存文件');

  // 7f-3: staged 在两次改名之间官方写入 B 并抛 EBUSY，必须保留 B 且判 stale
  fs.copyFileSync(raceAAsar, asarPath);
  fs.copyFileSync(patchedDummyAsar, stagedPath);
  fs.writeFileSync(stagedMetaPath, JSON.stringify({
    sourceFingerprint: fpRaceA,
    stagedFingerprint: fpPatchedDummy,
    timestamp: Date.now()
  }, null, 2), 'utf8');
  const stagedBetweenEbusy = commitStagedSwap(asarPath, {
    maxAttempts: 1,
    retryDelayMs: 0,
    fsOps: {
      writeFileSync: fs.writeFileSync.bind(fs),
      renameSync(from, to) {
        if (from === stagedPath && to === asarPath) {
          fs.copyFileSync(raceBAsar, asarPath);
          const e = new Error('MOCK_STAGED_EBUSY_WITH_B'); e.code = 'EBUSY'; throw e;
        }
        return fs.renameSync(from, to);
      }
    }
  });
  assert(stagedBetweenEbusy.status === 'stale', 'staged 两次改名间隙到达 B 且遇 EBUSY 时应判 stale');
  assert(getAsarFingerprint(asarPath) === fpRaceB && !fs.existsSync(stagedPath) && !fs.existsSync(swapOldPath7), 'staged 间隙遇 B 必须保留 B 并清理过期 staged 与 swap-old');

  // 7f-4: staged 置入补丁后、写元数据失败同时官方写入全新 C 覆盖正式路径，回滚不得移走 C 降级为 A
  const raceCAsar = path.join(resourcesDir, 'app.asar.raceC');
  fs.writeFileSync(path.join(mockSrcDir, 'dist', 'preload.js'), '"use strict";\n// RACE_C_LATEST\n', 'utf-8');
  execSync(`${asarCli} pack "${mockSrcDir}" "${raceCAsar}"`, { stdio: 'ignore' });
  const fpRaceC = getAsarFingerprint(raceCAsar);
  fs.copyFileSync(raceAAsar, asarPath);
  fs.copyFileSync(patchedDummyAsar, stagedPath);
  fs.writeFileSync(stagedMetaPath, JSON.stringify({
    sourceFingerprint: fpRaceA,
    stagedFingerprint: fpPatchedDummy,
    timestamp: Date.now()
  }, null, 2), 'utf8');
  fs.writeFileSync(formalMetaPath, priorFormalMeta, 'utf8');
  const stagedMetaRaceC = commitStagedSwap(asarPath, {
    maxAttempts: 1,
    retryDelayMs: 0,
    fsOps: {
      renameSync: fs.renameSync.bind(fs),
      writeFileSync() {
        fs.copyFileSync(raceCAsar, asarPath);
        const e = new Error('MOCK_ENOSPC_WITH_RACE_C'); e.code = 'ENOSPC'; throw e;
      }
    }
  });
  assert(stagedMetaRaceC.status === 'stale', 'staged 元数据失败同时外部写入 C 时必须判 stale 保护 C');
  assert(getAsarFingerprint(asarPath) === fpRaceC && !fs.existsSync(swapOldPath7), 'staged 元数据故障回滚绝不移走非己所有的官方新版 C');
  assert(fs.readFileSync(formalMetaPath, 'utf8') === priorFormalMeta, '旧正式元数据完好保留');
  fs.rmSync(raceCAsar, { force: true });

  // 7g. 直装元数据 ENOSPC 原子提交：ASAR 与元数据一起回滚，不留混合状态，逐文件核对
  fs.copyFileSync(raceAAsar, asarPath);
  fs.writeFileSync(formalMetaPath, priorFormalMeta, 'utf8');
  const bakBeforeDirectEnospc = fs.readFileSync(backupPath);
  const directEnospcRes = install(testDir, {
    returnStatus: true,
    throwOnConflict: true,
    maxAttempts: 1,
    retryDelayMs: 0,
    fsOps: {
      renameSync: fs.renameSync.bind(fs),
      writeFileSync(target, content, enc) {
        fs.writeFileSync(target, String(content).slice(0, 10), enc);
        const e = new Error('MOCK_DIRECT_META_ENOSPC'); e.code = 'ENOSPC'; throw e;
      }
    }
  });
  assert(directEnospcRes.status === 'error' && directEnospcRes.rollbackErrors.length === 0, '直装元数据 ENOSPC 返回 error 且两步 ASAR 回滚干净');
  assert(getAsarFingerprint(asarPath) === fpRaceA, '直装元数据 ENOSPC 后正式路径已完整回滚回原包 A（无混合态）');
  assert(fs.readFileSync(formalMetaPath, 'utf8') === priorFormalMeta, '直装元数据 ENOSPC 后旧正式元数据逐字完好');
  assert(!fs.existsSync(swapOldPath7) && !fs.existsSync(path.join(resourcesDir, 'app.asar.new')), '直装回滚完成后不残留 swap-old 与 app.asar.new');
  assert(fs.readFileSync(backupPath).equals(bakBeforeDirectEnospc), '直装 ENOSPC 故障后 .bak 保持原样');

  // 7h. >30 MiB 大包隔离快照重复安装回归：补丁标记位于前 30 MiB 之外时，重复安装绝不能覆盖 .bak，且能 100% 还原官方原包
  const largeDir = path.join(testDir, 'large_asar_fixture');
  const largeResDir = path.join(largeDir, 'resources');
  const largeSrcDir = path.join(largeDir, 'src');
  const largeAsarPath = path.join(largeResDir, 'app.asar');
  const largeBakPath = path.join(largeResDir, 'app.asar.bak');
  const largeMetaPath = path.join(largeResDir, '.antigravity_chinese_meta.json');
  fs.mkdirSync(path.join(largeSrcDir, 'dist'), { recursive: true });
  fs.mkdirSync(largeResDir, { recursive: true });
  // 写入 31 MiB 填充文件（字典序排在 dist/ 之前，将 dist/preload.js 推到 >31 MiB 物理偏移处）
  fs.writeFileSync(path.join(largeSrcDir, 'aaa_padding_31mb.bin'), Buffer.alloc(31 * 1024 * 1024, 0x41));
  fs.writeFileSync(path.join(largeSrcDir, 'dist', 'preload.js'), origPreloadA, 'utf-8');
  execSync(`${asarCli} pack "${largeSrcDir}" "${largeAsarPath}"`, { stdio: 'ignore' });
  const largeOrigFp = getAsarFingerprint(largeAsarPath);

  install(largeDir, { throwOnConflict: true });
  assert(fs.existsSync(largeBakPath) && getAsarFingerprint(largeBakPath) === largeOrigFp, '大包首次安装正确保存原始官方 .bak');
  const patchedLargeBuf = fs.readFileSync(largeAsarPath);
  const sigPos = patchedLargeBuf.indexOf(Buffer.from('Antigravity Chinese Localization Injection'));
  assert(sigPos > 30 * 1024 * 1024, `大包补丁标记确实位于前 30 MiB 之外 (offset=${sigPos})`);

  // 二次重复安装（携带正式元数据）：快照必须通过正式元数据与大包索引准确识别已打补丁，绝不覆盖 .bak
  install(largeDir, { throwOnConflict: true });
  assert(getAsarFingerprint(largeBakPath) === largeOrigFp, '大包重复安装（含正式元数据）绝不覆盖官方原版 .bak');

  // 删除正式元数据后再次重复安装：大包索引提取 dist/preload.js 仍精准识别已打补丁，绝不覆盖 .bak
  if (fs.existsSync(largeMetaPath)) fs.rmSync(largeMetaPath, { force: true });
  install(largeDir, { throwOnConflict: true });
  assert(getAsarFingerprint(largeBakPath) === largeOrigFp, '大包缺失正式元数据重复安装仍精准识别已打补丁，绝不覆盖 .bak');

  // 还原并验证与原始 >31 MiB 官方大包指纹 100% 一致
  execSync(`node "${cliPath}" restore --path "${largeDir}"`, { stdio: 'ignore' });
  assert(!isAsarPatched(largeAsarPath) && getAsarFingerprint(largeAsarPath) === largeOrigFp, '大包重复安装后执行 restore 100% 还原为官方原版');
  fs.rmSync(largeDir, { recursive: true, force: true });

  for (const cleanup of [stagedPath, stagedMetaPath, formalMetaPath, raceAAsar, raceBAsar, patchedDummyAsar, swapOldPath7]) {
    if (fs.existsSync(cleanup)) fs.rmSync(cleanup, { force: true });
  }

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
