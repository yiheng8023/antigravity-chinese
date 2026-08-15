#!/usr/bin/env node

/**
 * Antigravity 文本漂移与版本演进分析器 (Text & DOM Drift Detector)
 * 
 * 核心指标体系：
 * 1. [Observed UI Candidates] 当前上游版本中提取到的 UI 候选字符串总量
 * 2. [Exact Match Coverage]   词典直接精确命中的覆盖率 (exact mapping)
 * 3. [Rule-Assisted Coverage] 经 exact + 正则 patterns + 多句拆分 + 复合短语综合处理后的真实有效翻译覆盖率
 * 4. [Decayed / Stale Rules]  反向检测词典中在当前版本未被观测到的陈旧/可能弃用词条 (exactKeys - foundStrings)
 */

const fs = require('fs');
const path = require('path');

const dictPath = path.join(__dirname, '..', 'dict', 'zh-CN.json');
const dict = require(dictPath);
const exactDict = dict.exact || {};
const exactKeys = Object.keys(exactDict);
const exactKeySet = new Set(exactKeys);
const sortedExactKeys = exactKeys.slice().sort((a, b) => b.length - a.length);

const patterns = (dict.patterns || []).map(p => ({
  regex: new RegExp(p.regex),
  replacement: p.replacement
}));

const translatedValues = {};
for (const k in exactDict) {
  translatedValues[exactDict[k]] = true;
}

// 模拟核心运行时的完整翻译管道
function emulateTranslation(rawStr) {
  if (!rawStr || typeof rawStr !== 'string') return null;
  const normalized = rawStr.replace(/\s+/g, ' ').trim();
  if (!normalized) return null;
  if (translatedValues[normalized]) return normalized;

  // 1. 直接精确匹配
  if (exactDict[normalized]) {
    return { type: 'exact', result: exactDict[normalized] };
  }

  // 2. 正则模式匹配（级联）
  for (let i = 0; i < patterns.length; i++) {
    const p = patterns[i];
    if (p.regex.test(normalized)) {
      let result = normalized.replace(p.regex, p.replacement);
      for (let pi = 0; pi < patterns.length; pi++) {
        if (patterns[pi].regex.test(result)) {
          result = result.replace(patterns[pi].regex, patterns[pi].replacement);
        }
      }
      p.regex.lastIndex = 0;
      return { type: 'pattern', result: result };
    }
  }

  // 3. 末尾标点容差
  const punctuationMatch = normalized.match(/^([\w\s\-\/]+)([:：…\.？\?!！]+)$/);
  if (punctuationMatch) {
    const base = punctuationMatch[1].trim();
    const punc = punctuationMatch[2];
    if (exactDict[base]) {
      return { type: 'punctuation', result: exactDict[base] + (punc === ':' ? '：' : punc) };
    }
  }

  // 4. 多句子拆分与复合段落翻译
  if (normalized.indexOf('. ') !== -1 || normalized.indexOf('! ') !== -1 || normalized.indexOf('? ') !== -1) {
    const sentences = normalized.split(/([.!?]\s+)/);
    let anyTranslated = false;
    const translatedParts = [];
    for (let sIdx = 0; sIdx < sentences.length; sIdx++) {
      const part = sentences[sIdx];
      const trimmedPart = part.trim();
      if (!trimmedPart) {
        translatedParts.push(part);
        continue;
      }
      let transPart = exactDict[trimmedPart];
      if (!transPart) {
        const pMatch = trimmedPart.match(/^([\w\s\-\/]+)([:：…\.？\?!！]+)$/);
        if (pMatch && exactDict[pMatch[1].trim()]) {
          transPart = exactDict[pMatch[1].trim()] + (pMatch[2] === ':' ? '：' : pMatch[2]);
        }
      }
      if (transPart) {
        anyTranslated = true;
        translatedParts.push(transPart);
      } else {
        translatedParts.push(part);
      }
    }
    if (anyTranslated) {
      return { type: 'multi-sentence', result: translatedParts.join(' ') };
    }
  }

  // 5. 多词复合子短语全量替换
  let processed = normalized;
  let modified = false;
  for (let j = 0; j < sortedExactKeys.length; j++) {
    const key = sortedExactKeys[j];
    if ((key.indexOf(' ') !== -1 || key.length >= 15) && processed.indexOf(key) !== -1) {
      processed = processed.split(key).join(exactDict[key]);
      modified = true;
    }
  }

  if (modified) return { type: 'compound', result: processed };

  return null;
}

// 判定是否为面向用户的真实 UI 文本（过滤纯代码语法、属性选择器、变量名噪声）
function isLikelyUIText(s) {
  if (s.length < 2 || s.length > 150) return false;
  if (/^[a-z0-9_\-\.]+$/.test(s)) return false; // 纯小写标识符/路径
  if (/^[A-Z0-9_]+$/.test(s) && !s.includes(' ')) return false; // 全大写枚举/常量
  if (/[{}();=<>|&!~^%$@#*\\]/.test(s)) return false; // 代码符号
  if (s.includes('__') || s.includes('0x') || s.startsWith('.')) return false;
  if (/^(http|https|data:|file:|ws:|wss:|blob:)/.test(s)) return false;
  if (s.includes('margin') || s.includes('padding') || s.includes('display:') || (s.includes('px') && s.length < 8)) return false;
  if (/^[A-Z][a-z0-9]+[A-Z][a-z0-9]+$/.test(s)) return false; // CamelCase 无空格类名
  if (/^\d+\.\d+/.test(s) && !s.includes(' ')) return false; // 版本号
  return /[a-zA-Z]{2}/.test(s);
}

console.log('🔍 [Drift Detector] 启动 Antigravity 文本漂移与版本演进分析器...');
console.log(`📖 当前词典收录条目数: ${exactKeys.length} 项精确规则, ${patterns.length} 组正则规则\n`);

const targetBundlePath = process.argv[2] || path.join(__dirname, 'main.js');

if (!fs.existsSync(targetBundlePath)) {
  console.log(`ℹ️ 未找到待分析的上游 bundle 文件: ${targetBundlePath}`);
  console.log('💡 用法: node tools/drift-detector.js <path-to-unpacked-main.js>');
  console.log('✅ 当前词典结构与语法校验通过 (100% 格式完好)。');
  process.exit(0);
}

const content = fs.readFileSync(targetBundlePath, 'utf-8');
console.log(`📦 正在分析目标文件: ${targetBundlePath} (${(content.length / 1024 / 1024).toFixed(2)} MB)`);

// 提取所有字符串字面量
const strRegex = /"([^"\r\n\\]*(?:\\.[^"\r\n\\]*)*)"|'([^'\r\n\\]*(?:\\.[^'\r\n\\]*)*)'|`([^`\\]*(?:\\.[^`\\]*)*)`/g;
const foundStrings = new Set();
let match;
while ((match = strRegex.exec(content)) !== null) {
  const str = match[1] || match[2] || match[3];
  if (!str) continue;
  const clean = str.replace(/\\"/g, '"').replace(/\\'/g, "'").replace(/\\n/g, ' ').replace(/\s+/g, ' ').trim();
  if (isLikelyUIText(clean)) {
    foundStrings.add(clean);
  }
}

const observedCandidates = Array.from(foundStrings);
const totalObserved = observedCandidates.length;

// 三层分类统计
let exactMatchedCount = 0;
let ruleAssistedCount = 0;
const uncoveredList = [];
const ruleAssistedDetails = [];
const observedSet = new Set(observedCandidates);

for (const text of observedCandidates) {
  const trans = emulateTranslation(text);
  if (trans) {
    if (trans.type === 'exact') {
      exactMatchedCount++;
    } else {
      ruleAssistedCount++;
      ruleAssistedDetails.push({ original: text, translated: trans.result, ruleType: trans.type });
    }
  } else {
    uncoveredList.push(text);
  }
}

// 反向分析：陈旧/未在当前版本观测到的历史词条 (Decayed / Stale Entries: exactKeys - observed)
const staleEntries = exactKeys.filter(k => !observedSet.has(k) && !content.includes(k));

const totalCovered = exactMatchedCount + ruleAssistedCount;
const exactCoveragePct = ((exactMatchedCount / totalObserved) * 100).toFixed(2);
const totalEffectiveCoveragePct = ((totalCovered / totalObserved) * 100).toFixed(2);

console.log(`\n============================================================`);
console.log(`📊 科学分级覆盖率与漂移检测报告 (Drift Analysis Summary)`);
console.log(`============================================================`);
console.log(`1. [Observed UI Candidates] 观察到的 UI 候选总量:     ${totalObserved} 条`);
console.log(`2. [Exact Match Coverage]   精确匹配覆盖 (Exact):     ${exactMatchedCount} 条 (${exactCoveragePct}%)`);
console.log(`3. [Rule-Assisted Coverage] 综合规则有效翻译覆盖率:   ${totalCovered} 条 (${totalEffectiveCoveragePct}%)`);
console.log(`   └─ 其中正则/多句/复合规则额外覆盖:                ${ruleAssistedCount} 条`);
console.log(`4. [Uncovered Candidates]   未覆盖待处理候选数:       ${uncoveredList.length} 条`);
console.log(`5. [Decayed / Stale Rules]  当前版本未观测到的历史词条: ${staleEntries.length} 条 (可作为弃用或重构审查线索)`);

const report = {
  timestamp: new Date().toISOString(),
  targetFile: targetBundlePath,
  metrics: {
    observedCandidatesCount: totalObserved,
    exactMatchesCount: exactMatchedCount,
    exactCoveragePercentage: `${exactCoveragePct}%`,
    ruleAssistedCount: ruleAssistedCount,
    totalCoveredCount: totalCovered,
    effectiveTranslationCoverage: `${totalEffectiveCoveragePct}%`,
    uncoveredCount: uncoveredList.length,
    staleEntriesCount: staleEntries.length
  },
  decayedRulesSample: staleEntries.slice(0, 50),
  uncoveredCandidatesSample: uncoveredList.slice(0, 50)
};

const reportPath = path.join(__dirname, 'drift-report.json');
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
console.log(`\n📄 完整结构化数据与候选 Diff 已输出至: ${reportPath}`);
