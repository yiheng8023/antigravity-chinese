const fs = require('fs');
const path = require('path');
const os = require('os');
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
const homedir = os.homedir();

let targetDummyAsar = null;
let createdDirs = [];

try {
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

  const alreadyExisted = fs.existsSync(targetDummyAsar);
  const targetDir = path.dirname(targetDummyAsar);

  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
    createdDirs.push(targetDir);
  }

  if (!alreadyExisted) {
    fs.writeFileSync(targetDummyAsar, 'DUMMY_ASAR_FOR_DETECTOR_TEST', 'utf-8');
  }

  // 执行真正的无参自动探测！(必须在真实 process.platform 下无参找到)
  const detected = findAsarPath();

  console.log(`🔍 自动探测结果: ${detected}`);

  assert(detected !== null, `在 ${platform} 真实平台成功无参探测到 app.asar`);
  assert(
    detected && path.resolve(detected) === path.resolve(targetDummyAsar),
    `探测结果 "${detected}" 精确匹配系统默认安装路径 "${targetDummyAsar}"`
  );

  // 清理临时测试文件
  if (!alreadyExisted && fs.existsSync(targetDummyAsar)) {
    fs.unlinkSync(targetDummyAsar);
    console.log('🧹 已清理测试临时 dummy asar 文件');
  }

  // 逆向清理创建的临时目录（避免留下垃圾）
  for (const dir of createdDirs) {
    try {
      if (fs.existsSync(dir) && fs.readdirSync(dir).length === 0) {
        fs.rmdirSync(dir);
      }
    } catch (e) {}
  }
} catch (err) {
  console.error('❌ 测试运行异常:', err);
  failed++;
}

console.log('\n============================================================');
console.log(`📊 路径探测测试完成: 共 ${passed + failed} 项, 通过 ${passed} 项, 失败 ${failed} 项`);
console.log('============================================================\n');

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
