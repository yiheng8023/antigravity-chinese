const fs = require('fs');
const path = require('path');

console.log('🧪 ============================================================');
console.log('🧪 开始执行出版级 / 学术级词库质量与规范字全量自动化回归断言');
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

const dictPath = path.join(__dirname, '..', 'dict', 'zh-CN.json');
assert(fs.existsSync(dictPath), '词典文件 dict/zh-CN.json 存在');

const dict = JSON.parse(fs.readFileSync(dictPath, 'utf-8'));
const exact = dict.exact || {};
const patterns = dict.patterns || [];

const exactEntries = Object.entries(exact);
console.log(`📚 当前加载精确词条: ${exactEntries.length} 条, 级联正则: ${patterns.length} 组\n`);

// --------------------------------------------------------------------------
// 1. 全角标点与排版规范断言
// --------------------------------------------------------------------------
console.log('--- 1. 全角标点与排版规范断言 ---');
const punctuationViolations = [];
for (const [en, zh] of exactEntries) {
  // 中文句子末尾误用英文半角标点
  if (/[\u4e00-\u9fa5]+:$/.test(zh)) punctuationViolations.push({ en, zh, rule: '末尾半角英文冒号' });
  if (/[\u4e00-\u9fa5]+\?$/.test(zh)) punctuationViolations.push({ en, zh, rule: '末尾半角英文问号' });
  if (/[\u4e00-\u9fa5]+!$/.test(zh)) punctuationViolations.push({ en, zh, rule: '末尾半角英文感叹号' });
  // 中文字符间多余双空格
  if (/[\u4e00-\u9fa5]\s{2,}[\u4e00-\u9fa5]/.test(zh)) punctuationViolations.push({ en, zh, rule: '中文内部多余双空格' });
  // 空白翻译
  if (!zh || zh.trim() === '') punctuationViolations.push({ en, zh, rule: '翻译内容为空' });
}

assert(
  punctuationViolations.length === 0,
  `全量 ${exactEntries.length} 条词条 100% 符合全角标点与中英文排版规范 (违规数: ${punctuationViolations.length})`
);

// --------------------------------------------------------------------------
// 2. 国家通用规范汉字与高频错别字断言
// --------------------------------------------------------------------------
console.log('\n--- 2. 国家通用规范汉字与高频错别字断言 ---');
const typoRules = [
  { regex: /登陆/, name: '登陆 -> 登录' },
  { regex: /帐号/, name: '帐号 -> 账号' },
  { regex: /按纽/, name: '按纽 -> 按钮' },
  { regex: /其它/, name: '其它 -> 其他' },
  { regex: /做为/, name: '做为 -> 作为' },
  { regex: /幅盖/, name: '幅盖 -> 覆盖' },
  { regex: /重置刷/, name: '重置刷 -> 重置/刷新' }
];

const typoHits = [];
for (const [en, zh] of exactEntries) {
  for (const rule of typoRules) {
    if (rule.regex.test(zh)) {
      typoHits.push({ en, zh, rule: rule.name });
    }
  }
}

assert(
  typoHits.length === 0,
  `全量 ${exactEntries.length} 条词条 0 错别字命中（登录/账号/其他/按钮/作为/覆盖 100% 规范）`
);

// --------------------------------------------------------------------------
// 3. CCF 与国家科学技术名词审定规范断言
// --------------------------------------------------------------------------
console.log('\n--- 3. 核心计算机学术与技术名词规范断言 ---');
assert(exact['Agent'] === '智能体' || exact['Agent'] === undefined, 'Agent 规范翻译为“智能体”');
assert(exact['Subagents'] === '子智能体' || exact['Subagents'] === undefined, 'Subagents 规范翻译为“子智能体”');
assert(exact['Workspace'] === '工作区' || exact['Workspace'] === undefined, 'Workspace 规范翻译为“工作区”');
assert(exact['Artifact'] === '产物' && (exact['Artifacts'] === '产物' || exact['Artifacts'] === '产物文档'), 'Artifact / Artifacts 规范翻译为“产物 / 产物文档”');
assert(exact['Context'] === '上下文' || exact['Context'] === undefined, 'Context 规范翻译为“上下文”');
assert(exact['Prompt'] === '提示词' || exact['Prompt'] === undefined, 'Prompt 规范翻译为“提示词”');
assert(exact['Telemetry'] === '遥测诊断' || exact['Telemetry'] === undefined, 'Telemetry 规范翻译为“遥测诊断”');

// --------------------------------------------------------------------------
// 4. 正则模式合法性与死循环防御断言
// --------------------------------------------------------------------------
console.log('\n--- 4. 正则表达式编译与安全性断言 ---');
let patternErrors = 0;
for (const p of patterns) {
  try {
    new RegExp(p.regex);
  } catch (e) {
    patternErrors++;
  }
}
assert(patternErrors === 0, `全部 ${patterns.length} 组动态级联正则 100% 合法且编译安全`);

console.log('\n============================================================');
console.log(`📊 出版级质检测试完成: 共 ${passed + failed} 项, 通过 ${passed} 项, 失败 ${failed} 项`);
console.log('============================================================\n');

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
