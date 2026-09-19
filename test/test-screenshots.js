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
  "Accent",

  // Screenshot 6: New Application & Remote Control & Sandbox Settings
  "Application",
  "Manage Antigravity app settings.",
  "Work with local agents from another device.",
  "Device Name",
  "Scan the code to open this device in Remote Control, or copy link.",
  "Configure allowed commands outside the sandbox.",
  "Configure external tools via Model Context Protocol.",
  "No MCP servers installed",
  "Build With Google Plugins",
  "Browse and enable plugins from the Build With Google catalog.",

  // Screenshot 7: Project Settings & Global Permissions (media_1789624999478.png)
  "Inherit Global",
  "Global Permissions",
  "Project Permissions",
  "Proceed in Sandbox",
  "Require Review",
  "Vetted (Preview)",
  "Turbo",
  "Always Proceed",
  "Warning: \"Always Proceed\" is enabled without sandbox protection. This is very dangerous and we do not recommend doing this.",

  // Screenshot 8: Right Drawer Panel & Media Time & Status Machine (media_1789625187011.png)
  "Files Changed",
  "Skills Used",
  "See all (79)",
  "(2 subagents)",
  "Thought for 12.5s",
  "Jan 15 - Feb 3",
  "Sep 17, 2:25 PM",
  "5 minutes ago",
  "Just now",

  // Battle Mode & Winner Survey
  "Battle Mode",
  "Best-of-N",
  "Select Winner",
  "Winner Survey",
  "Both are good",
  "Tie",

  // Screenshot 9: Security Preset Tooltip & Local Permissions (media_1789756124531.png)
  "Inherits your Global Permissions when working in this project.",
  "Inherits your Global Permissions 在此项目中工作时。",
  "Inherits your Global Permissions 在此项目中工作时",
  "Inherits your Global Permissions",
  "Also includes Global Permissions when working in this project.",
  "也包含 全局权限 在此项目中工作时。",
  "也包含 全局权限 在此项目中工作时",
  "也包含 全局权限 在此项目中工作时。 了解更多。",

  // Screenshot 10: Model Quota Tooltip & Relative Reset Time (media_1789756522985.png)
  "Resets in 4d 13h",
  "Resets in 2h 35m",
  "Resets in 4d 13h.",
  "Resets in 2h 35m.",
  "Resets in 5m 20s",
  "Resets in 4d",
  "Resets in 2h",
  "Resets in 35m",
  "Resets in 10s",
  "Resets in less than a minute",
  "Resets soon",
  "Refreshes in 4d 13h",
  "Refreshes in 2h 35m",

  // Screenshot 11: Contrast in Appearance (media_1789789564305.png)
  "Contrast",
  "Strong",
  "High Contrast",

  // Screenshot 12: Scheduled Tasks modal & page (media_1789790849888.png & media_1789792208851.png)
  "+ New",
  "New",
  "Search tasks...",
  "No scheduled tasks configured.",
  "New Scheduled Task",
  "scheduled task",
  "s run as Flash.",
  "Name",
  "Enter scheduled task name...",
  "Schedule",
  "Daily",
  "around",
  "Prompt",
  "Enter a prompt for the agent to run...",
  "全部 scheduled tasks run as Flash.",
  "All scheduled tasks run as Flash.",
  "Add Scheduled Task",

  // Screenshot 13: Search conversations (media_1789790888612.png)
  "Search conversations...",

  // Screenshot 14: Display menu (media_1789790931048.png)
  "Display",
  "Project + Worktree",

  // Screenshot 15: Filter menu Only Unread (media_1789790951393.png)
  "Only Unread",

  // v2.15.0 Core Features: Conversation Actions, Skins, CL Status, Plugins
  "Copy Conversation Markdown",
  "Archive This Conversation",
  "Find in Conversation",
  "Pin This Conversation",
  "Unpin This Conversation",
  "Rename This Conversation",
  "Move to New Group",
  "Product Skin",
  "Non-technical",
  "Simplified interface without developer tooling.",
  "The full developer experience.",
  "Workspace CL Status",
  "CL details unavailable",
  "Create a Plugin with the Agent",
  "This skill came from the marketplace, so you can add it again whenever you need it.",
  "Undo restores your entire workspace to its state at this point."
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
