#!/usr/bin/env node

/**
 * Antigravity 文本漂移与版本演进分析器 (Text & DOM Drift Detector v3.3.7)
 * 
 * 核心指标体系与三大盲区防御：
 * 1. [Observed UI Candidates] 放宽长度上限至 800 字符（根治 >150 字符长段落漏扫盲区）
 * 2. [Exact Match Coverage]   词典直接精确命中的覆盖率 (exact mapping)
 * 3. [Rule-Assisted Coverage] 经正则 patterns + 全句拆分 + 快捷键组合处理后的有效翻译覆盖率
 * 4. [False-Positive Guard]   严格拦截“半英半中”假阳性残片，严禁将半截翻译计入有效覆盖
 * 5. [Author Content]        作者内容不读取、不计入漏译，遵循运行时内容保护边界
 * 6. [Decayed / Stale Rules]  反向检测词典中在当前版本未被观测到的历史词条
 */

const fs = require('fs');
const path = require('path');

const dictPath = path.join(__dirname, '..', 'dict', 'zh-CN.json');
const dict = require(dictPath);
const exactDict = dict.exact || {};
const exactKeys = Object.keys(exactDict);
const exactKeySet = new Set(exactKeys);
const patterns = dict.patterns || [];
const { createI18nEngine } = require('../core/i18n-runtime.js');
const engine = createI18nEngine(dict);

// 允许在中文译文中保留的技术专有名词白名单
const ALLOWED_EN_IN_ZH = new Set([
  'google', 'antigravity', 'gemini', 'claude', 'anthropic', 'openai', 'gpt', 'codex',
  'mcp', 'cli', 'ide', 'dom', 'json', 'jsonl', 'yaml', 'yml', 'xml', 'csv', 'tsv', 'pdf', 'md', 'markdown',
  'asar', 'ast', 'ipc', 'rpc', 'grpc', 'http', 'https', 'url', 'urls', 'uri', 'uris', 'ssh', 'ssl', 'tls', 'dns', 'ip', 'tcp', 'udp',
  'git', 'github', 'gitlab', 'bitbucket', 'svn', 'hg', 'mercurial', 'worktree', 'worktrees',
  'wsl', 'ubuntu', 'windows', 'macos', 'linux', 'debian', 'fedora', 'arch', 'unix', 'posix',
  'chrome', 'chromium', 'firefox', 'safari', 'edge', 'webview', 'electron', 'devtools',
  'html', 'css', 'js', 'javascript', 'ts', 'typescript', 'jsx', 'tsx', 'python', 'py', 'go', 'golang', 'rust', 'java', 'kotlin', 'swift', 'csharp', 'dotnet', 'php', 'ruby', 'bash', 'sh', 'zsh', 'powershell', 'pwsh', 'cmd', 'bat', 'vbs', 'sql',
  'react', 'vue', 'angular', 'svelte', 'nextjs', 'nodejs', 'node', 'npm', 'npx', 'pnpm', 'yarn', 'bun', 'deno', 'pip', 'conda', 'uv', 'cargo', 'maven', 'gradle', 'docker', 'kubernetes', 'k8s',
  'api', 'apis', 'sdk', 'sdks', 'rest', 'graphql', 'websocket', 'websockets', 'sse', 'oauth', 'jwt', 'sso', 'saml', 'oidc', 'rbac',
  'ui', 'ux', 'gui', 'tui', 'hud', 'svg', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'ico', 'mp4', 'mp3', 'wav', 'ogg', 'webm',
  'ctrl', 'shift', 'alt', 'cmd', 'opt', 'option', 'meta', 'win', 'super', 'esc', 'enter', 'tab', 'space', 'backspace', 'del', 'delete', 'ins', 'insert', 'home', 'end', 'pgup', 'pgdn',
  'token', 'tokens', 'id', 'ids', 'uuid', 'guid', 'pid', 'uid', 'gid', 'env', 'eof', 'eol', 'crlf', 'lf', 'utf', 'ascii', 'unicode', 'hex', 'base64', 'sha', 'sha256', 'md5',
  'cpu', 'gpu', 'npu', 'ram', 'vram', 'rom', 'ssd', 'hdd', 'nvme', 'usb', 'webusb', 'bluetooth', 'wifi', 'lan', 'wan', 'vpn',
  'lcp', 'inp', 'cls', 'cwv', 'fcp', 'ttfb', 'fps', 'hz', 'ms', 'sec', 'min', 'hr', 'kb', 'mb', 'gb', 'tb', 'pb', 'px', 'rem', 'em', 'vh', 'vw',
  'aria', 'a11y', 'wcag', 'i18n', 'l10n', 'rtl', 'ltr',
  'ag', 'agy', 'pro', 'flash', 'ultra', 'nano', 'lite', 'omni', 'live', 'veo', 'imagen', 'gemma', 'vertex', 'cloud', 'firebase', 'colab', 'kaggle',
  'pr', 'prs', 'mr', 'ci', 'cd', 'cicd', 'devops', 'qa', 'mvp', 'poc', 'sla', 'slo', 'kpi', 'roi', 'okr',
  'monaco', 'xterm', 'vscode', 'cursor', 'windsurf', 'zed', 'vim', 'neovim', 'emacs', 'jetbrains', 'intellij',
  'slack', 'discord', 'telegram', 'teams', 'zoom', 'jira', 'linear', 'notion', 'figma', 'sentry', 'datadog', 'grafana', 'prometheus', 'stripe', 'twilio', 'aws', 'azure', 'gcp', 'cloudflare', 'vercel', 'netlify', 'supabase', 'redis', 'postgres', 'postgresql', 'mysql', 'sqlite', 'mongodb', 'dynamodb', 'bigquery', 'snowflake',
  'ffmpeg', 'imagemagick', 'pandoc', 'graphviz', 'mermaid', 'katex', 'latex', 'mathjax', 'webgl', 'webgpu', 'wasm', 'webassembly',
  'manifest', 'v2', 'v3', 'mv3', 'crx', 'cws',
  'ok', 'vs', 'beta', 'alpha', 'rc', 'lts', 'ga', 'agcis', 'byom', 'turbo', 'vetted', 'cowork', 'ion', 'workos', 'okta', 'scim',
  'memlab', 'heapsnapshot', 'heapsnapshots', 'oom', 'vad', 'tts', 'stt', 'asr', 'ocr', 'llm', 'llms', 'rag', 'codegraph', 'marvis', 'web', 'genai', 'google-genai', 'generatecontent', 'jetbox', 'sidecar', 'sidecars', 'worktree', 'worktrees', 'flash-lite'
]);

function getUntranslatedResidue(zhStr) {
  if (!zhStr) return [];
  const cleaned = zhStr
    .replace(/`[^`]+`/g, '')
    .replace(/--[a-z0-9\-]+/gi, '')
    .replace(/\b[a-z0-9_]+\.[a-z0-9_*]+/gi, '')
    .replace(/\/[a-z0-9_\-\/]+/gi, '');
  const words = cleaned.match(/\b[a-zA-Z]{3,}\b/g) || [];
  return words.filter(w => !ALLOWED_EN_IN_ZH.has(w.toLowerCase()));
}

// 彻底单源解耦：直接接入核心运行时引擎，并区分 exact 与 rule 辅助及假阳性
function emulateTranslation(rawStr) {
  if (!rawStr || typeof rawStr !== 'string') return null;
  const norm = engine.normalizeWhitespace(rawStr);
  if (exactKeySet.has(norm)) {
    return { type: 'exact', result: exactDict[norm] };
  }
  const res = engine.translate(norm);
  if (!res) return null;
  const residue = getUntranslatedResidue(res);
  if (residue.length > 0) {
    return { type: 'false_positive', result: res, residue };
  }
  return { type: 'rule', result: res };
}

// 判定是否为面向用户的真实 UI 文本（放宽上限至 800 字符，过滤纯代码语法、SVG 路径与类名噪声）
function isLikelyUIText(s) {
  if (s.length < 2 || s.length > 800) return false;
  if (/^[a-z0-9_\-\.\/\\:]+$/.test(s)) return false; // 纯小写标识符/路径
  if (/^[A-Z0-9_]+$/.test(s) && !s.includes(' ')) return false; // 全大写枚举/常量
  if (/[{}();=<>|&!~^%$@#*\\]/.test(s)) return false; // 代码符号
  if (s.includes('__') || s.includes('0x') || s.startsWith('.')) return false;
  if (/^(http|https|data:|file:|ws:|wss:|blob:)/.test(s)) return false;
  if (/^M\d/.test(s)) return false; // SVG path 数据
  if (s.includes('margin') || s.includes('padding') || s.includes('display:') || (s.includes('px') && s.length < 8)) return false;
  if (/^[A-Z][a-z0-9]+[A-Z][a-z0-9]+$/.test(s)) return false; // CamelCase 无空格类名
  if (/^\d+\.\d+/.test(s) && !s.includes(' ')) return false; // 版本号
  return /[a-zA-Z]{2}/.test(s);
}

const args = process.argv.slice(2);
const targetBundlePath = args[0];
const reportIndex = args.indexOf('--report');
if (!targetBundlePath || targetBundlePath.startsWith('--') || !fs.existsSync(targetBundlePath) ||
    !fs.statSync(targetBundlePath).isFile() ||
    (reportIndex !== -1 && (!args[reportIndex + 1] || args[reportIndex + 1].startsWith('--')))) {
  console.error('未提供有效的上游 bundle 文件或报告路径，本次未完成漂移分析。');
  console.log('用法: node tools/drift-detector.js <frontend-bundle.js> [--report <report.json>]');
  process.exit(2);
}
const reportPath = reportIndex === -1 ? path.join(__dirname, 'drift-report.json') : path.resolve(args[reportIndex + 1]);

console.log('🔍 [Drift Detector] 启动 Antigravity 文本漂移与版本演进分析器...');
console.log(`📖 当前词典收录条目数: ${exactKeys.length} 项精确规则, ${patterns.length} 组正则规则\n`);

console.log('[Author Content] 作者内容保留原文；本机技能和插件清单不参与扫描。前端字符串候选仍需按上下文复核。');

const content = fs.readFileSync(targetBundlePath, 'utf-8');
console.log(`📦 正在分析目标文件: ${targetBundlePath} (${(content.length / 1024 / 1024).toFixed(2)} MB)`);

// 提取所有字符串字面量（支持最高 800 字符长段落）
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

// 四层分类统计（含假阳性拦截）
let exactMatchedCount = 0;
let ruleAssistedCount = 0;
const falsePositiveList = [];
const uncoveredList = [];
const ruleAssistedDetails = [];
const observedSet = new Set(observedCandidates);

for (const text of observedCandidates) {
  const trans = emulateTranslation(text);
  if (trans) {
    if (trans.type === 'exact') {
      exactMatchedCount++;
    } else if (trans.type === 'false_positive') {
      falsePositiveList.push({ original: text, translated: trans.result, residue: trans.residue });
      uncoveredList.push(text);
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
const exactCoveragePct = totalObserved ? ((exactMatchedCount / totalObserved) * 100).toFixed(2) + '%' : null;
const totalEffectiveCoveragePct = totalObserved ? ((totalCovered / totalObserved) * 100).toFixed(2) + '%' : null;

console.log(`\n============================================================`);
console.log(`📊 科学分级覆盖率与漂移检测报告 (Drift Analysis Summary)`);
console.log(`============================================================`);
console.log(`1. [Observed UI Candidates] 观察到的 UI 候选总量 (2~800字符): ${totalObserved} 条`);
console.log(`2. [Exact Match Coverage]   精确匹配覆盖 (Exact):             ${exactMatchedCount} 条 (${exactCoveragePct || 'N/A'})`);
console.log(`3. [Rule-Assisted Coverage] 综合规则有效翻译覆盖率:           ${totalCovered} 条 (${totalEffectiveCoveragePct || 'N/A'})`);
console.log(`   └─ 其中正则/多句/快捷键规则额外覆盖:                       ${ruleAssistedCount} 条`);
console.log(`4. [False-Positive Guard]   半英半中假阳性残片拦截数:         ${falsePositiveList.length} 条`);
console.log(`5. [Uncovered Candidates]   未覆盖待处理候选数:               ${uncoveredList.length} 条`);
console.log(`6. [Decayed / Stale Rules]  当前版本未观测到的历史词条:       ${staleEntries.length} 条`);

const report = {
  timestamp: new Date().toISOString(),
  targetFile: targetBundlePath,
  scope: { frontend: 'static-string-candidates-only', authorContent: 'preserve-source; not scanned', runtimeCoverage: 'not-measured' },
  metrics: {
    observedCandidatesCount: totalObserved,
    exactMatchesCount: exactMatchedCount,
    exactCoveragePercentage: exactCoveragePct,
    ruleAssistedCount: ruleAssistedCount,
    falsePositiveCount: falsePositiveList.length,
    totalCoveredCount: totalCovered,
    effectiveTranslationCoverage: totalEffectiveCoveragePct,
    uncoveredCount: uncoveredList.length,
    staleEntriesCount: staleEntries.length
  },
  falsePositivesSample: falsePositiveList.slice(0, 50),
  decayedRulesSample: staleEntries.slice(0, 50),
  uncoveredCandidatesSample: uncoveredList.slice(0, 50)
};

fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
console.log(`\n📄 结构化摘要与候选样本已输出至: ${reportPath}`);
