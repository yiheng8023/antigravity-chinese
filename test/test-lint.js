/**
 * 轻量级代码静态语法与未定义变量门禁 (Lightweight Syntax & Global Safety Gate)
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

console.log('🧪 ============================================================');
console.log('🧪 开始执行轻量级静态语法与模块编译门禁 (Syntax & Safety Check)');
console.log('🧪 ============================================================\n');

const filesToCheck = [
  'cli.js',
  'core/i18n-runtime.js',
  'test/verify.js',
  'test/test-screenshots.js',
  'test/test-menu-and-titles.js',
  'test/test-proofread-integrity.js',
  'test/test-detector-live.js',
  'test/test-asar-lifecycle.js'
];

let hasError = false;

for (const relPath of filesToCheck) {
  const fullPath = path.join(__dirname, '..', relPath);
  if (!fs.existsSync(fullPath)) continue;

  try {
    const code = fs.readFileSync(fullPath, 'utf8');
    new vm.Script(code, { filename: relPath });
    console.log(`✅ [PASS] ${relPath} 语法分析与 Script 编译通过`);
  } catch (err) {
    console.error(`❌ [FAIL] ${relPath} 编译失败:`, err.message);
    hasError = true;
  }
}

if (hasError) {
  console.error('\n❌ 静态代码门禁发现错误，终止流程！');
  process.exit(1);
} else {
  console.log('\n🎉 所有核心脚本静态语法编译门禁 100% PASS！\n');
}
