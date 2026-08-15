/**
 * 全面分析词典覆盖缺口
 * 从 8.9MB 前端 bundle 中提取真正的 UI 文本，与现有词典对比
 */
const fs = require('fs');
const path = require('path');

const all = require('./all_normalized_strings.json');
const dict = require('../dict/zh-CN.json');
const exactKeys = new Set(Object.keys(dict.exact));

const uiStrings = [];

for (const s of all) {
  // 基础长度
  if (s.length < 3 || s.length > 150) continue;
  
  // 必须以大写字母开头
  if (!/^[A-Z]/.test(s)) continue;
  
  // 排除代码/变量/CSS/内部标识
  if (/[{}();=<>|&!~^%$@#+*\\]/.test(s)) continue;
  if (s.includes('__')) continue;
  if (s.includes('0x')) continue;
  if (/^#[0-9A-Fa-f]+/.test(s)) continue;
  if (/^[A-Z_]{3,}$/.test(s)) continue; // ALL_CAPS constants
  if (s.startsWith(',')) continue;
  if (/^\w+\.\w+/.test(s)) continue; // object.property
  if (/^[A-Z][a-z]+[A-Z][a-z]/.test(s) && !s.includes(' ')) continue; // CamelCase no space
  
  // 必须包含至少一个空格（多词短语）或是已知的有意义单词
  const hasSpace = s.includes(' ');
  if (!hasSpace) {
    // 单词：只保留常见 UI 词
    if (s.length >= 4 && /^[A-Z][a-z]+$/.test(s)) {
      uiStrings.push(s);
    }
    continue;
  }
  
  // 多词：排除代码式组合
  if (/[a-z][A-Z]/.test(s.replace(/\s/g, ''))) continue; // embedded camelCase
  
  uiStrings.push(s);
}

const covered = uiStrings.filter(s => exactKeys.has(s));
const uncovered = uiStrings.filter(s => !exactKeys.has(s));

console.log(`精确 UI 文本: ${uiStrings.length} 条`);
console.log(`词典已覆盖: ${covered.length} 条`);
console.log(`未覆盖: ${uncovered.length} 条`);
console.log(`覆盖率: ${(covered.length / uiStrings.length * 100).toFixed(1)}%`);
console.log('\n--- 未覆盖的 UI 文本 (按长度排序) ---');

uncovered.sort((a, b) => a.length - b.length);
uncovered.forEach(s => console.log(s));
