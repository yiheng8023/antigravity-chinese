/**
 * 智能分类：哪些 UI 文本需要翻译，哪些应该保留英文
 * 输出三类：TRANSLATE / KEEP_EN / SKIP（非 UI 文本/内部标识）
 */
const fs = require('fs');
const path = require('path');

const all = require('./all_normalized_strings.json');
const dict = require('../dict/zh-CN.json');
const exactKeys = new Set(Object.keys(dict.exact));

// 应保留英文的类别
const KEEP_EN_PATTERNS = [
  // 品牌/产品名
  /^(Google|Gemini|Antigravity|Chrome|Firefox|Safari|Chromium|Webkit|Android|Linux|Windows|Macintosh|MCP|JJ|Git|GitHub|Jujutsu|SF Mono)$/i,
  // 键盘按键名
  /^(Ctrl|Shift|Alt|Meta|Enter|Escape|Space|Backspace|Backquote|Backslash|Tab|Delete|Home|End|Insert|PageUp|PageDown|ArrowUp|ArrowDown|ArrowLeft|ArrowRight|Digit\d|Period|Comma|Semicolon|Slash|Minus|Equal|Quote)$/i,
  // 技术术语（开发者日常用英文的）
  /^(API|SDK|CLI|IDE|MCP|JSON|HTML|CSS|SVG|URL|URI|HTTP|HTTPS|SSH|DNS|TCP|UDP|IP|OAuth|JWT|CORS|MIME|ASCII|UTF|YAML|TOML|XML|SQL|DOM|PDF|CDN|NPM|WASM|REST|GRPC|WebSocket|GraphQL|Markdown|Regex|Mermaid|LaTeX)$/i,
  // 编程概念（通常不翻译）
  /^(Promise|Fragment|Suspense|Profiler|Annotation|Transition|Offscreen|Declaration|Infinity|Unimplemented)$/,
  // HTML 标签列表
  /^(AREA|BR|COL|COMMAND|HR|IMG|INPUT|LINK|META|OBJECT|SCRIPT|STYLE|SVG|TEMPLATE|EMBED|IFRAME|FORM|BASE|APPLET|KEYGEN|PARAM|SOURCE|TRACK|WBR)/,
  // 浏览器/系统内部
  /^(Dead|Hyper|Super|Mobi|Cider|Piper|Jetbox|Jetski|Concierge|Steward|Launchpad)$/,
  // 字体名
  /^SF Mono$/,
  // 纯技术状态词（常见于开发者 UI，无需翻译）
  /^(Props|Object|Value|Type|Label|Header|Input|Fragment|Scope|Root|Cache|Count|Metric)$/,
];

// 明确需要翻译的 UI 文本模式
const TRANSLATE_PATTERNS = [
  // 用户可见的操作按钮
  /^(Copy|Paste|Delete|Cancel|Submit|Save|Close|Open|Accept|Reject|Allow|Deny|Dismiss|Resume|Abort|Stop|Continue|Retry|Confirm|Proceed|Undo|Redo|Clear|Remove|Create|Export|Import|Rename|Share|Download|Upload|Install|Unpin|Pin|Expand|Collapse|Enable|Disable|Select|Find|Filter|Search|Sort|Show|Hide|Preview|Refresh|Restore|Archive|Verify|Approve|Revoke|Grant)/i,
  // 用户可见的状态信息
  /^(Loading|Running|Waiting|Stopped|Completed|Failed|Canceled|Paused|Idle|Active|Enabled|Disabled|Modified|Created|Deleted|Archived|Approved|Rejected|Aborted|Skipped|Errored|Installed|Processing|Analyzing|Building|Searching|Recording|Exploring|Planning|Editing|Reading|Testing|Capturing|Working)/,
  // 设置与配置
  /(Setting|Config|Permission|Preference|Option|Rule|Policy|Behavior|Workspace|Project|Conversation|Message|Notification|Theme|Display|Agent|Subagent|Terminal|Command|Browser|Sandbox|Session)/i,
  // 包含完整句子的文本
  /[A-Z].*\s(to|the|a|an|for|with|from|into|your|this|that|and|or|not|is|are|was|were|has|have|can|will|may|should|could|would|does|did)\s/i,
];

function shouldKeepEnglish(s) {
  for (const p of KEEP_EN_PATTERNS) {
    if (p.test(s)) return true;
  }
  return false;
}

function shouldTranslate(s) {
  // 已在词典中的不再处理
  if (exactKeys.has(s)) return false;
  // 保留英文的不翻译
  if (shouldKeepEnglish(s)) return false;
  // 明确需要翻译的
  for (const p of TRANSLATE_PATTERNS) {
    if (p.test(s)) return true;
  }
  // 包含多个单词的英文句子/短语通常需要翻译
  if (s.split(' ').length >= 2 && /^[A-Z]/.test(s)) return true;
  return false;
}

// 过滤出 UI 文本
const uiStrings = all.filter(s => {
  if (s.length < 3 || s.length > 200) return false;
  if (!/^[A-Z]/.test(s)) return false;
  if (/[{}();=<>|&!~^%$@#+*\\]/.test(s)) return false;
  if (s.includes('__')) return false;
  if (/^#[0-9A-Fa-f]+/.test(s)) return false;
  if (/^[A-Z_]{3,}$/.test(s)) return false;
  if (s.startsWith(',')) return false;
  if (/^\w+\.\w+/.test(s)) return false;
  if (/^[A-Z][a-z]+[A-Z][a-z]/.test(s) && !s.includes(' ')) return false;
  return true;
});

const toTranslate = uiStrings.filter(s => shouldTranslate(s));
const keepEn = uiStrings.filter(s => shouldKeepEnglish(s));
const alreadyCovered = uiStrings.filter(s => exactKeys.has(s));

console.log(`=== 分析结果 ===`);
console.log(`总 UI 文本: ${uiStrings.length}`);
console.log(`已有翻译: ${alreadyCovered.length}`);
console.log(`需要翻译: ${toTranslate.length}`);
console.log(`应保留英文: ${keepEn.length}`);
console.log('');

// 输出需要翻译的，按重要性/类别分组
console.log('=== 需要翻译的 UI 文本 ===');
toTranslate.sort((a, b) => a.length - b.length);
toTranslate.forEach(s => console.log(s));

// 保存结果
fs.writeFileSync(path.join(__dirname, 'to-translate.json'), JSON.stringify(toTranslate, null, 2));
console.log(`\n已保存到 tools/to-translate.json`);
