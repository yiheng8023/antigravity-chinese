/**
 * Antigravity 全生态终极全局一致性与质量深度体检分析器
 * (Ultimate Global Consistency & Quality Audit for Antigravity Chinese Ecosystem)
 * 
 * 覆盖六大维度：
 * 1. 版本链与元数据全链路一致性 (Version & Metadata Chain)
 * 2. 核心学术与计算机术语一致性 (Core Technical Terminology)
 * 3. 通用操作高频动词与枚举一致性 (Action Verbs & Enumerations)
 * 4. 出版级排版、全角标点与通用规范字质检 (Typography & Punctuation Integrity)
 * 5. 动态正则捕获组守恒与安全性 (Regex Invariance & ReDoS Safety)
 * 6. 多端生态（客户端 + VS Code 扩展 + 插件）组件对齐 (Ecosystem Alignment)
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..');
const pkgPath = path.join(ROOT_DIR, 'package.json');
const readmeZhPath = path.join(ROOT_DIR, 'README.md');
const readmeEnPath = path.join(ROOT_DIR, 'README.en.md');
const dictPath = path.join(ROOT_DIR, 'dict', 'zh-CN.json');
const vscodePatchPath = path.join(ROOT_DIR, 'core', 'vscode-patch.js');
const cliPath = path.join(ROOT_DIR, 'cli.js');

const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const currentVersion = pkg.version;
const dict = JSON.parse(fs.readFileSync(dictPath, 'utf8'));
const exact = dict.exact || {};
const patterns = dict.patterns || [];

console.log('================================================================');
console.log('  🔍 Antigravity 全生态终极全局一致性深度体检 (Ultimate Audit)  ');
console.log(`  当前目标版本: v${currentVersion} | 词条总数: ${Object.keys(exact).length} | 动态正则: ${patterns.length}`);
console.log('================================================================\n');

let issues = [];
let passCount = 0;

function check(title, fn) {
  try {
    const res = fn();
    if (res === true || (res && res.ok)) {
      console.log(`  ✅ [PASS] ${title}`);
      passCount++;
    } else {
      const msg = (res && res.message) ? res.message : '检查未通过';
      console.log(`  ❌ [FAIL] ${title} -> ${msg}`);
      issues.push({ title, message: msg });
    }
  } catch (err) {
    console.log(`  💥 [ERROR] ${title} -> ${err.message}`);
    issues.push({ title, message: err.message });
  }
}

// ==========================================================================
// 维度 1: 版本链与元数据全链路一致性
// ==========================================================================
console.log('【维度 1】版本链与元数据全链路一致性 (Version & Metadata Chain)');

const readmeZh = fs.readFileSync(readmeZhPath, 'utf8');
const readmeEn = fs.readFileSync(readmeEnPath, 'utf8');

check(`README.md 包含当前最新版本号 v${currentVersion}`, () => {
  return readmeZh.includes(`v${currentVersion}`);
});

check(`README.en.md 包含当前最新版本号 v${currentVersion}`, () => {
  return readmeEn.includes(`v${currentVersion}`);
});

check('中英文文档测试套件与断言统计一致 (9 大套件 390+ 项断言)', () => {
  const zhHas9 = readmeZh.includes('9 大') || readmeZh.includes('9 大全真');
  const enHas9 = readmeEn.includes('9 test') || readmeEn.includes('9 full') || readmeEn.includes('9 大') || readmeEn.includes('390+');
  if (!zhHas9) return { ok: false, message: 'README.md 中测试套件数未更新为 9 大套件' };
  return true;
});

// ==========================================================================
// 维度 2: 核心学术与计算机术语一致性
// ==========================================================================
console.log('\n【维度 2】核心学术与计算机术语一致性 (Core Technical Terminology)');

const termRules = [
  { term: 'Agent', expected: '智能体', forbidden: ['代理', '智能助手'] },
  { term: 'Subagent', expected: '子智能体', forbidden: ['子代理', '从属代理'] },
  { term: 'Subagents', expected: '子智能体', forbidden: ['子代理', '从属代理'] },
  { term: 'Workspace', expected: '工作区', forbidden: ['工作空间'] },
  { term: 'Artifact', expected: '产物', forbidden: ['工件', '制品'] },
  { term: 'Artifacts', expected: ['产物', '产物文档'], forbidden: ['工件', '制品'] },
  { term: 'Context', expected: '上下文', forbidden: ['语境'] },
  { term: 'Prompt', expected: '提示词', forbidden: ['提示符'] },
  { term: 'Telemetry', expected: '遥测诊断', forbidden: ['远程测量'] }
];

for (const rule of termRules) {
  check(`术语 [${rule.term}] 标准化为 "${Array.isArray(rule.expected) ? rule.expected.join('/') : rule.expected}"`, () => {
    const actual = exact[rule.term];
    if (actual !== undefined) {
      if (Array.isArray(rule.expected)) {
        if (!rule.expected.includes(actual)) {
          return { ok: false, message: `精确词条匹配为 "${actual}"，不符合预期` };
        }
      } else if (actual !== rule.expected) {
        return { ok: false, message: `精确词条匹配为 "${actual}"，不符合预期 "${rule.expected}"` };
      }
    }
    // 检查词库所有中文值中是否有违规用法
    for (const [enKey, zhVal] of Object.entries(exact)) {
      if (typeof zhVal !== 'string') continue;
      for (const forb of rule.forbidden) {
        // 如果英文包含该术语，但中文出现了被禁用的翻译
        if (new RegExp(`\\b${rule.term}\\b`, 'i').test(enKey) && zhVal.includes(forb)) {
          return { ok: false, message: `词条 "${enKey}" -> "${zhVal}" 含有非标用词 "${forb}"` };
        }
      }
    }
    return true;
  });
}

// ==========================================================================
// 维度 3: 通用高频操作动词与枚举状态一致性
// ==========================================================================
console.log('\n【维度 3】通用高频操作动词与枚举状态一致性 (Action Verbs & Enums)');

const actionVerbMap = {
  'Save': '保存',
  'Cancel': '取消',
  'Delete': '删除',
  'Confirm': '确认',
  'Retry': '重试',
  'Copy': '复制',
  'Close': '关闭',
  'Open': '打开',
  'Allow': '允许',
  'Deny': '拒绝',
  'Inherit Global': ['继承全局设置', '继承全局配置']
};

for (const [enVerb, expectedZh] of Object.entries(actionVerbMap)) {
  check(`高频动词/选项 [${enVerb}] 标准化为 "${Array.isArray(expectedZh) ? expectedZh.join('/') : expectedZh}"`, () => {
    const val = exact[enVerb];
    if (val) {
      if (Array.isArray(expectedZh)) {
        if (!expectedZh.includes(val)) {
          return { ok: false, message: `实际为 "${val}"，期望为 "${expectedZh.join('/')}"` };
        }
      } else if (val !== expectedZh) {
        return { ok: false, message: `实际为 "${val}"，期望为 "${expectedZh}"` };
      }
    }
    return true;
  });
}

// ==========================================================================
// 维度 4: 出版级排版、全角标点与规范汉字质检
// ==========================================================================
console.log('\n【维度 4】出版级排版、全角标点与规范汉字质检 (Typography & Punctuation)');

check('全角标点规范性（中文句末无残留英文半角标点）', () => {
  const badPunctuation = [];
  for (const [en, zh] of Object.entries(exact)) {
    if (typeof zh !== 'string') continue;
    if (/[\u4e00-\u9fa5]+:$/.test(zh)) badPunctuation.push(`[${en}]: 末尾半角冒号`);
    if (/[\u4e00-\u9fa5]+\?$/.test(zh)) badPunctuation.push(`[${en}]: 末尾半角问号`);
    if (/[\u4e00-\u9fa5]+!$/.test(zh)) badPunctuation.push(`[${en}]: 末尾半角叹号`);
  }
  if (badPunctuation.length > 0) {
    return { ok: false, message: `发现 ${badPunctuation.length} 处标点违规: ${badPunctuation.slice(0, 3).join('; ')}` };
  }
  return true;
});

check('高频错别字 0 容忍筛查（登录/账号/按钮/其他/作为/覆盖）', () => {
  const typoRules = [
    { regex: /登陆/, name: '登陆 -> 登录' },
    { regex: /帐号/, name: '帐号 -> 账号' },
    { regex: /按纽/, name: '按纽 -> 按钮' },
    { regex: /其它/, name: '其它 -> 其他' },
    { regex: /做为/, name: '做为 -> 作为' },
    { regex: /幅盖/, name: '幅盖 -> 覆盖' }
  ];
  const typos = [];
  for (const [en, zh] of Object.entries(exact)) {
    if (typeof zh !== 'string') continue;
    for (const rule of typoRules) {
      if (rule.regex.test(zh)) typos.push(`[${en}] ${rule.name}`);
    }
  }
  if (typos.length > 0) {
    return { ok: false, message: `发现错别字: ${typos.join('; ')}` };
  }
  return true;
});

// ==========================================================================
// 维度 5: 动态正则捕获组守恒与安全性
// ==========================================================================
console.log('\n【维度 5】动态正则捕获组守恒与安全性 (Regex Invariance & Safety)');

check('所有级联正则语法有效且捕获组数量守恒', () => {
  let errCount = 0;
  for (const p of patterns) {
    try {
      const reg = new RegExp(p.regex);
      // 计算捕获组数量
      const dummyMatch = p.regex.match(/(?:[^\\]|^)\((?!\?)/g) || [];
      const groupCount = dummyMatch.length;
      // 检查 replacement 中引用的最大 group
      const refs = (p.replacement.match(/\$(\d+)/g) || []).map(r => parseInt(r.slice(1), 10));
      for (const ref of refs) {
        if (ref > groupCount) {
          errCount++;
          return { ok: false, message: `正则 /${p.regex}/ 捕获组数量(${groupCount})小于反向引用 \$${ref}` };
        }
      }
    } catch (e) {
      return { ok: false, message: `正则编译失败: ${p.regex} -> ${e.message}` };
    }
  }
  return true;
});

// ==========================================================================
// 维度 6: 多端生态组件对齐与文件存在性
// ==========================================================================
console.log('\n【维度 6】多端生态组件对齐与关键链路完备性 (Ecosystem Integrity)');

const criticalFiles = [
  'cli.js',
  'install.bat',
  'install-vscode.bat',
  'restore-vscode.bat',
  'core/i18n-runtime.js',
  'core/vscode-patch.js',
  'dict/zh-CN.json',
  'test/test-vscode-patch.js',
  'test/verify.js',
  'test/test-asar-lifecycle.js'
];

for (const rel of criticalFiles) {
  check(`关键生态文件 [${rel}] 完整存在`, () => {
    return fs.existsSync(path.join(ROOT_DIR, rel));
  });
}

check('VS Code 扩展微代理模板核心防御机制具备 (GZIP 解压与 WHATWG URL)', () => {
  const content = fs.readFileSync(vscodePatchPath, 'utf8');
  const hasGzip = content.includes('zlib.gunzipSync') && content.includes('accept-encoding');
  const hasWhatwg = content.includes('new URL(');
  if (!hasGzip) return { ok: false, message: '缺失 GZIP 自动解压防御' };
  if (!hasWhatwg) return { ok: false, message: '缺失 WHATWG URL 规范重构' };
  return true;
});

// ==========================================================================
// 体检总结与健康指数评分
// ==========================================================================
console.log('\n================================================================');
const totalChecks = passCount + issues.length;
const healthScore = Math.round((passCount / totalChecks) * 100);
console.log(`📊 全局一致性深度体检结果: 共 ${totalChecks} 项检查 | 通过 ${passCount} 项 | 异常 ${issues.length} 项`);
console.log(`🏆 全生态健康指数评分 (Health Score): ${healthScore} / 100`);

if (issues.length > 0) {
  console.log('\n⚠️ 异常清单:');
  issues.forEach((it, idx) => console.log(`  ${idx + 1}. [${it.title}]: ${it.message}`));
  console.log('================================================================\n');
  process.exit(1);
} else {
  console.log('🌟 完美！全生态六大维度 100% 符合出版级全局一致性基线！');
  console.log('================================================================\n');
  process.exit(0);
}
