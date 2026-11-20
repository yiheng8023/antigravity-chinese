const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');
const { findAsarPath } = require('../cli');

console.log('🧪 ============================================================');
console.log(`🧪 开始执行真实宿主系统 (${process.platform}) 无参路径探测器实测`);
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

const platform = os.platform();
const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agy-detector-'));
const homedir = path.join(testDir, 'home');
const originalHome = os.homedir;
const originalExists = fs.existsSync;
const originalLocalAppData = process.env.LOCALAPPDATA;
const originalProgramFiles = process.env.ProgramFiles;
let targetDummyAsar = null;

try {
  // 保留真实平台和无参调用，将所有候选路径隔离到测试目录。
  os.homedir = () => homedir;
  process.env.LOCALAPPDATA = path.join(testDir, 'local-app-data');
  process.env.ProgramFiles = path.join(testDir, 'program-files');
  if (platform === 'win32') {
    const localAppData = process.env.LOCALAPPDATA || path.join(homedir, 'AppData', 'Local');
    targetDummyAsar = path.join(localAppData, 'Programs', 'antigravity', 'resources', 'app.asar');
  } else if (platform === 'darwin') {
    targetDummyAsar = path.join(homedir, 'Applications', 'Antigravity.app', 'Contents', 'Resources', 'app.asar');
  } else {
    // Linux
    targetDummyAsar = path.join(homedir, '.local', 'share', 'antigravity', 'resources', 'app.asar');
  }

  console.log(`📍 目标测试候选路径: ${targetDummyAsar}`);

  const targetDir = path.dirname(targetDummyAsar);
  fs.mkdirSync(targetDir, { recursive: true });
  fs.writeFileSync(targetDummyAsar, 'DUMMY_ASAR_FOR_DETECTOR_TEST', 'utf-8');
  // 系统级候选目录即使已安装客户端，也不能抢占本用例或触发冷启动恢复。
  fs.existsSync = candidate => {
    const resolved = path.resolve(candidate);
    return resolved.startsWith(testDir + path.sep) && originalExists(candidate);
  };

  // 执行真正的无参自动探测！(必须在真实 process.platform 下无参找到)
  const detected = findAsarPath();

  console.log(`🔍 自动探测结果: ${detected}`);

  assert(detected !== null, `在 ${platform} 真实平台成功无参探测到 app.asar`);
  assert(
    detected && path.resolve(detected) === path.resolve(targetDummyAsar),
    `探测结果 "${detected}" 精确匹配系统默认安装路径 "${targetDummyAsar}"`
  );

  if (platform === 'linux') {
    const portableDir = path.join(homedir, 'Applications', 'Portable', 'Antigravity');
    const portableAsar = path.join(portableDir, 'resources', 'app.asar');
    fs.mkdirSync(path.dirname(portableAsar), { recursive: true });
    fs.writeFileSync(portableAsar, 'DUMMY_PORTABLE_ASAR', 'utf8');
    assert(findAsarPath() === targetDummyAsar, 'Linux 默认安装与便携版共存时沿用默认路径');
    assert(findAsarPath(portableDir) === portableAsar, '显式安装目录优先于 Linux 默认安装');
    fs.unlinkSync(targetDummyAsar);
    fs.mkdirSync(targetDummyAsar);
    assert(findAsarPath() === portableAsar, '默认位置只有同名目录时，Linux 继续探测便携版');
  }

  if (platform !== 'win32') {
    const projectDir = path.join(__dirname, '..');
    const cliArgs = ['--path', path.join(homedir, 'Portable Apps', 'Antigravity'), '--force'];
    for (const [file, commandArgs] of [
      ['install.sh', ['install', '--with-plugin']],
      ['uninstall.sh', ['restore']],
    ]) {
      const result = spawnSync('bash', [
        '-c', 'node() { printf "%s\\0" "$@"; }; source "$@"',
        'test-wrapper', path.join(projectDir, file), ...cliArgs,
      ], { encoding: 'utf8' });
      const expected = [path.join(projectDir, 'cli.js'), ...commandArgs, ...cliArgs].join('\0') + '\0';
      assert(result.status === 0 && result.stdout === expected, `${file} 按原顺序透传含空格的路径和选项`);
    }
  }

} catch (err) {
  console.error('❌ 测试运行异常:', err);
  failed++;
} finally {
  fs.existsSync = originalExists;
  os.homedir = originalHome;
  if (originalLocalAppData === undefined) delete process.env.LOCALAPPDATA;
  else process.env.LOCALAPPDATA = originalLocalAppData;
  if (originalProgramFiles === undefined) delete process.env.ProgramFiles;
  else process.env.ProgramFiles = originalProgramFiles;
  if (path.dirname(testDir) === path.resolve(os.tmpdir()) && path.basename(testDir).startsWith('agy-detector-')) {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
}

console.log('\n============================================================');
console.log(`📊 路径探测测试完成: 共 ${passed + failed} 项, 通过 ${passed} 项, 失败 ${failed} 项`);
console.log('============================================================\n');

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
