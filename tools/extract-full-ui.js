const fs = require('fs');
const path = require('path');

const mainJsPath = path.join(__dirname, 'main.js');
const content = fs.readFileSync(mainJsPath, 'utf-8');

console.log('Read main.js, size:', (content.length / 1024 / 1024).toFixed(2), 'MB');

// Match double quoted, single quoted, and backtick strings
const strRegex = /"([^"\r\n\\]*(?:\\.[^"\r\n\\]*)*)"|'([^'\r\n\\]*(?:\\.[^'\r\n\\]*)*)'|`([^`\\]*(?:\\.[^`\\]*)*)`/g;

const found = new Set();
let match;
while ((match = strRegex.exec(content)) !== null) {
  const str = match[1] || match[2] || match[3];
  if (!str) continue;
  const clean = str.replace(/\\"/g, '"').replace(/\\'/g, "'").replace(/\\n/g, ' ').replace(/\s+/g, ' ').trim();
  if (clean.length >= 2 && clean.length <= 200) {
    found.add(clean);
  }
}

console.log('Total extracted raw strings:', found.size);

// Load existing dictionary
const dict = require('../dict/zh-CN.json');
const exactKeys = new Set(Object.keys(dict.exact));

// Filter criteria for natural UI strings
const uiCandidates = [];
for (const s of found) {
  // Exclude code / css / tech noise
  if (/^[\d\.\,\;\:\!\?\-\_\/\\]+$/.test(s)) continue;
  if (/^(http|https|data:|file:|ws:|wss:|blob:)/.test(s)) continue;
  if (/^[a-z0-9_\-\.]+$/.test(s)) continue; // snake_case, kebab-case, ids
  if (/^[A-Z0-9_]+$/.test(s) && !s.includes(' ')) continue; // CONSTANTS
  if (/[{}();=<>|&!~^%$@#*]/.test(s)) continue; // code chars
  if (s.includes('__') || s.includes('0x') || s.startsWith('.')) continue;
  if (s.includes('margin') || s.includes('padding') || s.includes('display:') || s.includes('px') && s.length < 10) continue;
  if (/^[A-Z][a-z0-9]+[A-Z][a-z0-9]+$/.test(s)) continue; // CamelCase class/func name without space
  
  // Must contain letters
  if (!/[a-zA-Z]/.test(s)) continue;

  uiCandidates.push(s);
}

console.log('UI Candidate count:', uiCandidates.length);
fs.writeFileSync(path.join(__dirname, 'all_ui_candidates.json'), JSON.stringify(uiCandidates.sort(), null, 2));

// Specifically filter strings related to Settings, Appearance, Models, Customizations, Browser, App, Shortcuts, Workspace, Rules, Skills, Sidecars
const settingsKeywords = [
  'Appearance', 'Theme', 'Font', 'Color', 'Model', 'Temperature', 'Token',
  'Customization', 'Rule', 'Skill', 'MCP', 'Sidecar', 'Hook', 'Plugin',
  'Browser', 'Proxy', 'Sandbox', 'Permission', 'Security', 'Policy', 'Review',
  'Shortcut', 'Keybinding', 'Execution', 'Queue', 'Telemetry', 'Analytics',
  'Update', 'Account', 'Profile', 'Subscription', 'Quota', 'Rate', 'Billing',
  'Storage', 'History', 'Log', 'Terminal', 'Directory', 'File', 'Workspace',
  'Experimental', 'Feature', 'Notification', 'Sound', 'Language', 'Behavior',
  'Assistant', 'Agent', 'Companion', 'Remote', 'Debug', 'Port', 'Server'
];

const relevantToSettings = uiCandidates.filter(s => {
  return settingsKeywords.some(kw => new RegExp('\\b' + kw + '\\b', 'i').test(s));
});

console.log('Settings relevant candidates:', relevantToSettings.length);
fs.writeFileSync(path.join(__dirname, 'settings_candidates.json'), JSON.stringify(relevantToSettings.sort(), null, 2));
