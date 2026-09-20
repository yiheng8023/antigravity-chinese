#!/usr/bin/env node

/**
 * Antigravity Chinese Dictionary Compiler & Security Gate
 * 词典三层分层构建管线与质量守卫门禁
 *
 * 门禁机制：
 * 1. 【ASCII Key Barrier】严格拦截 exact 字典中混入汉字 Key（防止中英混排中间态残片死灰复燃）
 * 2. 【Duplicate Key Guard】跨文件键名唯一性冲突检查
 * 3. 【Capture-Group Invariant Guard】捕获组守恒检查（语法合规、捕获数对齐、杜绝双斜杠转义残废）
 * 4. 【Dual Output】编译生成 dist/zh-CN.bundle.json 并无缝同步覆盖 dict/zh-CN.json（向后兼容）
 */

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const SRC_DIR = path.join(PROJECT_ROOT, 'dict', 'src');
const CORE_DIR = path.join(SRC_DIR, 'core');
const CTX_DIR = path.join(SRC_DIR, 'ctx');
const RULES_DIR = path.join(SRC_DIR, 'rules');
const DIST_DIR = path.join(PROJECT_ROOT, 'dist');
const BUNDLE_PATH = path.join(DIST_DIR, 'zh-CN.bundle.json');
const COMPAT_DICT_PATH = path.join(PROJECT_ROOT, 'dict', 'zh-CN.json');

console.log('🏗️  === 开始编译 Antigravity 汉化三层词库管线 ===\n');

let errorCount = 0;
function logError(msg) {
  console.error(`❌ [编译阻断] ${msg}`);
  errorCount++;
}

// 辅助：统计正则中的真实捕获组数量（忽略 (?:...), (?=...), (?!...), (?<=...), (?<!...) 以及转义括号 \(）
function countCaptureGroups(regexStr) {
  let count = 0;
  let inCharClass = false;
  for (let i = 0; i < regexStr.length; i++) {
    const ch = regexStr[i];
    const prev = i > 0 ? regexStr[i - 1] : '';
    if (ch === '\\') {
      i++; // 跳过转义字符
      continue;
    }
    if (ch === '[' && prev !== '\\') {
      inCharClass = true;
      continue;
    }
    if (ch === ']' && prev !== '\\' && inCharClass) {
      inCharClass = false;
      continue;
    }
    if (!inCharClass && ch === '(' && prev !== '\\') {
      const lookahead = regexStr.slice(i, i + 4);
      // 检查非捕获或断言
      if (lookahead.startsWith('(?:') ||
          lookahead.startsWith('(?=') ||
          lookahead.startsWith('(?!') ||
          lookahead.startsWith('(?<=') ||
          lookahead.startsWith('(?<!') ||
          lookahead.startsWith('(?=')) {
        continue;
      }
      count++;
    }
  }
  return count;
}

// 辅助：提取 replacement 中的捕获变量最大索引
function getReferencedGroups(replacementStr) {
  const matches = replacementStr.match(/\$(\d+)/g) || [];
  const indices = matches.map(m => parseInt(m.slice(1), 10));
  return {
    indices,
    max: indices.length > 0 ? Math.max(...indices) : 0
  };
}

// 1. 加载并校验 exact 词典
const exactDict = {};
const exactSources = [
  ...fs.readdirSync(CORE_DIR).map(f => path.join(CORE_DIR, f)),
  ...fs.readdirSync(CTX_DIR).map(f => path.join(CTX_DIR, f))
].filter(f => f.endsWith('.json'));

console.log(`📂 发现 exact 词典源文件: ${exactSources.length} 个`);
for (const file of exactSources) {
  const relativeName = path.relative(SRC_DIR, file);
  const content = JSON.parse(fs.readFileSync(file, 'utf8'));
  for (const [key, value] of Object.entries(content)) {
    // 门禁 A: 重复 Key 检查
    if (exactDict.hasOwnProperty(key)) {
      logError(`重复定义的精确词条 "${key}" (文件: ${relativeName})`);
    }

    // 门禁 B: ASCII Key 门禁 (严禁包含中文 Key)
    if (/[\u4e00-\u9fa5]/.test(key)) {
      logError(`禁止在 exact 词库中录入包含汉字的 Key: "${key}" (文件: ${relativeName})`);
    }

    // 门禁 C: 非空值检查
    if (!value || typeof value !== 'string' || value.trim() === '') {
      logError(`词条 "${key}" 的翻译值为空 (文件: ${relativeName})`);
    }

    exactDict[key] = value;
  }
}

// 2. 加载并校验 patterns 规则
const allPatterns = [];
const ruleSources = fs.readdirSync(RULES_DIR).filter(f => f.endsWith('.json')).map(f => path.join(RULES_DIR, f));
console.log(`📂 发现 rules 规则源文件: ${ruleSources.length} 个`);

for (const file of ruleSources) {
  const relativeName = path.relative(SRC_DIR, file);
  const patternsList = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!Array.isArray(patternsList)) {
    logError(`规则文件 ${relativeName} 必须是数组结构！`);
    continue;
  }

  for (let i = 0; i < patternsList.length; i++) {
    const item = patternsList[i];
    const loc = `${relativeName}[${i}]`;

    if (!item.regex || typeof item.regex !== 'string') {
      logError(`${loc}: regex 字段缺失或不是字符串`);
      continue;
    }
    if (typeof item.replacement !== 'string') {
      logError(`${loc}: replacement 字段缺失或不是字符串`);
      continue;
    }

    // 门禁 D: 语法编译测试
    try {
      new RegExp(item.regex);
    } catch (err) {
      logError(`${loc}: 正则表达式语法非法: /${item.regex}/ - ${err.message}`);
      continue;
    }

    // 门禁 E: 双重转义拦截 (\\\\s, \\\\b, \\\\d 等)
    if (item.regex.includes('\\\\s') || item.regex.includes('\\\\b') || item.regex.includes('\\\\d') || item.regex.includes('\\\\w')) {
      logError(`${loc}: 检测到非法的双重转义斜杠残片: "${item.regex}"`);
    }

    // 门禁 F: 捕获组守恒门禁
    const captureCount = countCaptureGroups(item.regex);
    const referenced = getReferencedGroups(item.replacement);

    // 越界引用：replacement 引用了超出 regex 捕获组总数的变量
    if (referenced.max > captureCount) {
      logError(`${loc}: replacement 中引用了 $${referenced.max}，但 regex 仅有 ${captureCount} 个捕获组！`);
    }

    // 意外丢弃警示：存在捕获组却未在 replacement 中被消费
    if (captureCount > 0 && referenced.indices.length === 0 && !item.allowDiscard) {
      logError(`${loc}: regex 定义了 ${captureCount} 个捕获组，但 replacement 完全未引用任何 $ 变量！若确需丢弃请显式标注 allowDiscard: true`);
    }

    allPatterns.push(item);
  }
}

console.log(`\n📊 统计汇总:`);
console.log(`  - 精确词条 (exact): ${Object.keys(exactDict).length} 条`);
console.log(`  - 级联规则 (patterns): ${allPatterns.length} 组`);

if (errorCount > 0) {
  console.error(`\n🚨 编译失败: 共发现 ${errorCount} 处严重违规，已阻断产物生成！请立即修复。`);
  process.exit(1);
}

// 3. 构建单一交付物 bundle
const bundleData = {
  version: require('../package.json').version,
  buildTime: new Date().toISOString(),
  exact: exactDict,
  patterns: allPatterns
};

if (!fs.existsSync(DIST_DIR)) {
  fs.mkdirSync(DIST_DIR, { recursive: true });
}

fs.writeFileSync(BUNDLE_PATH, JSON.stringify(bundleData, null, 2) + '\n', 'utf8');
console.log(`✅ 成功输出分层编译交付包: ${path.relative(PROJECT_ROOT, BUNDLE_PATH)}`);

// 4. 同步更新向后兼容 dict/zh-CN.json
const compatData = {
  exact: exactDict,
  patterns: allPatterns
};
fs.writeFileSync(COMPAT_DICT_PATH, JSON.stringify(compatData, null, 2) + '\n', 'utf8');
console.log(`✅ 成功同步向后兼容基线: ${path.relative(PROJECT_ROOT, COMPAT_DICT_PATH)}`);

console.log('\n🎉 [词库构建管线] 编译成功且 100% 通过全部质量门禁！\n');
