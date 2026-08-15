const fs = require('fs');
const path = require('path');

const dict = require('../dict/zh-CN.json');
const exactDict = dict.exact;
const patterns = (dict.patterns || []).map(p => ({
  regex: new RegExp(p.regex),
  replacement: p.replacement
}));

const sortedExactKeys = Object.keys(exactDict).sort((a, b) => b.length - a.length);

const translatedValues = {};
for (const k in exactDict) {
  translatedValues[exactDict[k]] = true;
}

function normalizeWhitespace(str) {
  return str.replace(/\s+/g, ' ').trim();
}

function translateSingleUnit(rawStr) {
  if (!rawStr || typeof rawStr !== 'string') return null;
  const normalized = normalizeWhitespace(rawStr);
  if (!normalized) return null;

  if (translatedValues[normalized]) return null;

  // 1. Direct exact match
  if (exactDict[normalized]) {
    return exactDict[normalized];
  }

  // 2. Pattern match
  for (let i = 0; i < patterns.length; i++) {
    const p = patterns[i];
    if (p.regex.test(normalized)) {
      let result = normalized.replace(p.regex, p.replacement);
      // If result contains nested dynamic time patterns (e.g. "6 days, 6 hours"), replace them
      for (let j = 0; j < patterns.length; j++) {
        if (patterns[j].regex.test(result)) {
          result = result.replace(patterns[j].regex, patterns[j].replacement);
        }
      }
      p.regex.lastIndex = 0;
      return result;
    }
  }

  // 3. Trailing punctuation tolerance
  const punctuationMatch = normalized.match(/^([\w\s\-\/]+)([:：…\.？\?!！]+)$/);
  if (punctuationMatch) {
    const base = punctuationMatch[1].trim();
    const punc = punctuationMatch[2];
    if (exactDict[base]) {
      return exactDict[base] + (punc === ':' ? '：' : punc);
    }
  }

  // 4. Multi-sentence translation (split by period / question mark / exclamation mark)
  if (normalized.includes('. ') || normalized.includes('! ') || normalized.includes('? ')) {
    const sentences = normalized.split(/([.!?]\s+)/);
    let anyTranslated = false;
    const translatedParts = sentences.map(part => {
      const trimmed = part.trim();
      if (!trimmed) return part;
      const t = exactDict[trimmed] || (punctuationMatch && exactDict[trimmed.replace(/[:：…\.？\?!！]+$/, '')]);
      if (t) {
        anyTranslated = true;
        return t;
      }
      return part;
    });
    if (anyTranslated) {
      return translatedParts.join(' ');
    }
  }

  // 5. Sub-phrase greedy replacement for composite text
  let processed = normalized;
  let modified = false;
  for (let j = 0; j < sortedExactKeys.length; j++) {
    const key = sortedExactKeys[j];
    if (key.length >= 4 && processed.indexOf(key) !== -1) {
      processed = processed.split(key).join(exactDict[key]);
      modified = true;
    }
  }

  if (modified) return processed;

  return null;
}

// Test cases from all 5 screenshots
const testCases = [
  // Screenshot 1: App Settings
  "App Settings",
  "Manage application settings.",
  "Prevent Sleep",
  "Prevent the computer from sleeping while the app is running.",
  "Keep In Menu Bar",
  "Keep the app accessible from the menu bar and running in the background when all windows are closed.",
  "Notification Settings",
  "To modify notification settings, open your operating system's system preferences.",
  "Open System Preferences",
  "Ask anything, @ to mention, / for actions",

  // Screenshot 2: Browser Settings
  "Browser Settings",
  "Configure the browser subagent. It requires Google Chrome to be installed.",
  "Browser Javascript Execution Policy",
  "Controls whether the agent can run custom JavaScript to automate complex browser actions.",
  "Request Review",
  "Actuation Permissions",
  "Browser Actuation Rules",
  "Configure allowed and denied URLs for browser actuation.",

  // Screenshot 3: Customizations
  "Configure default behaviors, skills, and MCP servers.",
  "Token Usage",
  "The breakdown below shows token usage from customizations like skills, rules, and MCP. If the budget is exceeded, large customizations will be truncated automatically.",
  "96.8% of the customization budget is available.",
  "Show 2 breakdowns",
  "Installed MCP Servers",
  "Open MCP Config",
  "No MCP Servers",
  "You currently don't have any MCP Servers installed.",

  // Screenshot 4: Models & Usage
  "Models & Usage",
  "Manage your model quota and credits.",
  "Model Credits",
  "Enable AI Credit Overages",
  "When toggled on, Antigravity will use your AI credits to fulfill model requests once you're out of model quota. Antigravity will always use your model quota first before using AI credits.",
  "Gemini Models",
  "Weekly Limit Remaining",
  "Five Hour Limit Remaining",
  "You have used some of your weekly limit, it will fully refresh in 6 days, 6 hours.",
  "You have used some of your 5 hour limit, it will fully refresh in 3 hours, 21 minutes.",
  "Claude and GPT models",
  "You have hit your 5-hour limit, so the weekly limit does not currently apply. Your 5-hour limit will refresh in 3 hours, 51 minutes.",
  "You have hit your 5-hour limit, it will refresh in 3 hours, 51 minutes. If on a supported paid plan, you can use AI credits in the interim.",

  // Screenshot 5: Appearance
  "Chat Settings",
  "Verbose Agent Chat",
  "Display and preserve intermediate thinking steps.",
  "Conversation Width",
  "Configure the maximum width of the conversation panel.",
  "Narrow",
  "Wide",
  "Select light, dark, or inherit system settings.",
  "Preset",
  "Default Light",
  "Default Dark",
  "Background",
  "Foreground",
  "Accent"
];

console.log('Testing', testCases.length, 'cases from screenshots:');
let failed = 0;
for (const tc of testCases) {
  const res = translateSingleUnit(tc);
  if (!res || res === tc) {
    console.error('❌ FAILED:', tc);
    failed++;
  } else {
    console.log('✅', tc, '->', res);
  }
}

console.log(`\nResults: ${testCases.length - failed}/${testCases.length} passed.`);
if (failed > 0) process.exit(1);
