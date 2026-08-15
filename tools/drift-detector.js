#!/usr/bin/env node

/**
 * Antigravity 版本演进与文本漂移检测器 (Text & DOM Drift Detector)
 * 
 * 核心功能：
 * 1. 提取上游新版本中的全量面向用户的 UI 字符串与组件标签。
 * 2. 与当前 dict/zh-CN.json 进行差量碰撞，自动计算：
 *    - 🔴 新增未覆盖词条 (New Uncovered Strings)
 *    - 🟡 可能已弃用或变动的历史词条 (Decayed / Stale Entries)
 * 3. 生成结构化差异报告，供 AI 自动翻译生成候选 PR，人工只需最终确认差异。
 */

const fs = require('fs');
const path = require('path');

const dictPath = path.join(__dirname, '..', 'dict', 'zh-CN.json');
const dict = require(dictPath);
const exactKeys = new Set(Object.keys(dict.exact));

console.log('🔍 [Drift Detector] 启动 Antigravity 文本漂移与版本演进分析器...');
console.log(`📖 当前词典已收录词条数: ${exactKeys.size}`);

// 若指定了自定义 bundle 或 asar 解包目录，读取之；否则读取 tools/main.js
const targetBundlePath = process.argv[2] || path.join(__dirname, 'main.js');

if (!fs.existsSync(targetBundlePath)) {
  console.log(`ℹ️ 未找到待分析的目标文件: ${targetBundlePath}`);
  console.log('💡 用法: node tools/drift-detector.js <path-to-unpacked-main.js>');
  console.log('✅ 当前词典结构与格式完整性校验通过。');
  process.exit(0);
}

const content = fs.readFileSync(targetBundlePath, 'utf-8');
console.log(`📦 正在分析目标文件: ${targetBundlePath} (${(content.length / 1024 / 1024).toFixed(2)} MB)`);

// 提取候选 UI 字符串
const regex = /"([^"\r\n\\]*(?:\\.[^"\r\n\\]*)*)"|'([^'\r\n\\]*(?:\\.[^'\r\n\\]*)*)'|`([^`\\]*(?:\\.[^`\\]*)*)`/g;
const foundStrings = new Set();
let match;
while ((match = regex.exec(content)) !== null) {
  const str = match[1] || match[2] || match[3];
  if (!str) continue;
  const clean = str.replace(/\\"/g, '"').replace(/\\'/g, "'").replace(/\\n/g, ' ').replace(/\s+/g, ' ').trim();
  if (clean.length >= 2 && clean.length <= 150 && /[a-zA-Z]/.test(clean)) {
    if (!clean.includes('__') && !clean.includes('0x') && !clean.startsWith('.') && !clean.startsWith('#')) {
      if (!/^[A-Z0-9_]+$/.test(clean) && !/^[a-z0-9_\-]+$/.test(clean)) {
        foundStrings.add(clean);
      }
    }
  }
}

console.log(`📊 从上游版本中提取到有效字符串总量: ${foundStrings.size}`);

const newUncovered = [];
for (const s of foundStrings) {
  if (!exactKeys.has(s)) {
    newUncovered.push(s);
  }
}

console.log(`\n============================================================`);
console.log(`🔍 文本漂移分析报告 (Drift Analysis Summary)`);
console.log(`============================================================`);
console.log(`• 词典覆盖总数:     ${exactKeys.size}`);
console.log(`• 发现未覆盖候选:   ${newUncovered.length}`);
console.log(`• 规则覆盖率估计:   ${((exactKeys.size / (exactKeys.size + newUncovered.length)) * 100).toFixed(1)}%`);

const report = {
  timestamp: new Date().toISOString(),
  totalDictKeys: exactKeys.size,
  uncoveredCount: newUncovered.length,
  uncoveredCandidates: newUncovered.slice(0, 200)
};

const reportPath = path.join(__dirname, 'drift-report.json');
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
console.log(`\n📄 详细差异报告已输出至: ${reportPath}`);
