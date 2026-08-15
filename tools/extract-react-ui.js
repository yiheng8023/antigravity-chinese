/**
 * 从 Antigravity 前端 bundle 中精准提取 UI 文本
 * 
 * React 组件中 UI 文本的典型模式：
 * - children:"Some text"   （React children 属性）
 * - label:"Some text"      （表单标签）
 * - title:"Some text"      （标题）
 * - placeholder:"..."      （输入占位符）
 * - description:"..."      （描述文本）
 * - "text" 直接作为 JSX 子元素
 * 
 * 同时提取独立的英文短语/句子常量
 */
const fs = require('fs');
const path = require('path');

const bundlePath = path.join(__dirname, 'main.js');
const content = fs.readFileSync(bundlePath, 'utf-8');
const dict = require('../dict/zh-CN.json');
const existingKeys = new Set(Object.keys(dict.exact));

console.log('Bundle size:', (content.length / 1024 / 1024).toFixed(1), 'MB');

// 1. 提取 React 属性中的 UI 文本
const propPatterns = [
  // children:"text", children: "text"
  /children\s*:\s*"([^"]{2,120})"/g,
  // label:"text"
  /label\s*:\s*"([^"]{2,120})"/g,
  // title:"text" 
  /title\s*:\s*"([^"]{2,120})"/g,
  // placeholder:"text"
  /placeholder\s*:\s*"([^"]{2,120})"/g,
  // description:"text"
  /description\s*:\s*"([^"]{2,120})"/g,
  // tooltip:"text"
  /tooltip\s*:\s*"([^"]{2,120})"/g,
  // header:"text"
  /header\s*:\s*"([^"]{2,120})"/g,
  // heading:"text"
  /heading\s*:\s*"([^"]{2,120})"/g,
  // text:"text"  
  /(?:text|message|hint|caption|subtitle)\s*:\s*"([^"]{2,150})"/g,
  // aria-label="text"
  /aria-label\s*[:=]\s*"([^"]{2,80})"/g,
  // confirmText/cancelText/submitText etc.
  /(?:confirm|cancel|submit|action|button|error|success|warning|info)(?:Text|Label|Message|Title)\s*:\s*"([^"]{2,120})"/g,
];

const reactStrings = new Map(); // value -> source pattern

for (const regex of propPatterns) {
  let m;
  while ((m = regex.exec(content)) !== null) {
    const val = m[1].trim();
    if (isUIText(val) && !existingKeys.has(val)) {
      const src = regex.source.split('\\s')[0].replace(/[\\(]/g, '');
      if (!reactStrings.has(val)) {
        reactStrings.set(val, src);
      }
    }
  }
}

// 2. 提取独立的英文句子/短语（更精准的过滤）
const sentenceRegex = /"([A-Z][^"]{3,150})"/g;
let sm;
while ((sm = sentenceRegex.exec(content)) !== null) {
  const val = sm[1].trim();
  if (isUIText(val) && !existingKeys.has(val) && !reactStrings.has(val)) {
    // 额外要求：必须包含空格（多词短语）或是已知 UI 单词
    if (val.includes(' ') || isKnownUIWord(val)) {
      reactStrings.set(val, 'sentence');
    }
  }
}

function isUIText(s) {
  if (!s || s.length < 2) return false;
  // 排除代码/CSS/内部标识
  if (/[{}();=<>|&!~^%$@#+*\\]/.test(s)) return false;
  if (s.includes('__')) return false;
  if (s.includes('0x')) return false;
  if (/^[a-z]/.test(s) && !s.includes(' ')) return false; // camelCase start
  if (/^[A-Z_]{4,}$/.test(s)) return false; // ALL_CAPS
  if (/^\w+\.\w+/.test(s)) return false; // module.prop
  if (s.startsWith(',') || s.startsWith('.')) return false;
  if (/^#[0-9A-Fa-f]/.test(s)) return false; // colors
  if (/^[A-Z][a-z]+[A-Z][a-z]/.test(s) && !s.includes(' ')) return false; // CamelCase
  // 排除 HTML 标签名列表
  if (/^[A-Z]{2,6}\s[A-Z]{2,6}/.test(s) && !s.includes(' a ') && !/[a-z]{3}/.test(s)) return false;
  // 排除纯路径
  if (s.includes('/') && !s.includes(' ')) return false;
  // 排除版本号
  if (/^\d+\.\d+/.test(s)) return false;
  // 必须有英文字母
  if (!/[a-zA-Z]{2}/.test(s)) return false;
  // 排除纯数字+单位
  if (/^\d+\s*(px|em|rem|vh|vw|%)$/.test(s)) return false;
  return true;
}

function isKnownUIWord(s) {
  const uiWords = new Set([
    'Settings', 'Account', 'General', 'Appearance', 'Models', 'Browser', 'Shortcuts',
    'Workspace', 'Project', 'Terminal', 'Agent', 'Notifications', 'History',
    'Loading', 'Running', 'Stopped', 'Completed', 'Failed', 'Error', 'Warning',
    'Save', 'Cancel', 'Delete', 'Create', 'Open', 'Close', 'Submit', 'Apply',
    'Enable', 'Disable', 'Install', 'Remove', 'Search', 'Filter', 'Export',
    'Download', 'Upload', 'Preview', 'Details', 'Options', 'Configure',
    'Dismiss', 'Approve', 'Reject', 'Confirm', 'Continue', 'Proceed',
    'Archive', 'Restore', 'Resume', 'Suspend', 'Rename', 'Share',
  ]);
  return uiWords.has(s);
}

// 按类别分组输出
const results = Array.from(reactStrings.entries())
  .sort((a, b) => a[0].localeCompare(b[0]));

console.log(`\n提取到 ${results.length} 条未覆盖的 UI 文本\n`);

// 保存为 JSON 供后续处理
const output = {};
for (const [text, src] of results) {
  output[text] = { source: src, translation: '' };
}
fs.writeFileSync(path.join(__dirname, 'uncovered-ui-strings.json'), JSON.stringify(output, null, 2));

// 打印所有
for (const [text, src] of results) {
  console.log(`[${src}] ${text}`);
}
