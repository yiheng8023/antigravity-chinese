const fs = require('fs');
const path = require('path');

const extractedPath = path.join(__dirname, 'extracted_ui_strings.json');
const rawStrings = JSON.parse(fs.readFileSync(extractedPath, 'utf-8'));

// Filter out noise, keeping real UI strings
const uiStrings = rawStrings.filter(s => {
  if (s.length < 3) return false;
  if (/^[A-Z0-9_]+$/.test(s) && !s.includes(' ')) return false; // ALL_CAPS constants
  if (/^[a-z]/.test(s)) return false; // starts with lowercase (mostly identifiers)
  if (s.startsWith('Google') || s.startsWith('Electron') || s.startsWith('Node')) return false;
  return true;
});

console.log(`Filtered to ${uiStrings.length} high-quality UI strings.`);

// Generate category mapping
const categories = {
  settings: [],
  navigation: [],
  agent: [],
  editor: [],
  general: []
};

uiStrings.forEach(s => {
  const lower = s.toLowerCase();
  if (lower.includes('setting') || lower.includes('permission') || lower.includes('config') || lower.includes('preset') || lower.includes('mode') || lower.includes('account') || lower.includes('theme') || lower.includes('browser') || lower.includes('model') || lower.includes('customiz') || lower.includes('shortcut') || lower.includes('rule') || lower.includes('keybinding')) {
    categories.settings.push(s);
  } else if (lower.includes('chat') || lower.includes('agent') || lower.includes('prompt') || lower.includes('artifact') || lower.includes('conversation') || lower.includes('task') || lower.includes('plan') || lower.includes('walkthrough') || lower.includes('message') || lower.includes('subagent')) {
    categories.agent.push(s);
  } else if (lower.includes('file') || lower.includes('edit') || lower.includes('view') || lower.includes('window') || lower.includes('history') || lower.includes('project') || lower.includes('workspace') || lower.includes('explorer') || lower.includes('search')) {
    categories.navigation.push(s);
  } else {
    categories.general.push(s);
  }
});

console.log('Settings related:', categories.settings.length);
console.log('Agent related:', categories.agent.length);
console.log('Navigation related:', categories.navigation.length);
console.log('General related:', categories.general.length);

fs.writeFileSync(path.join(__dirname, 'categorized_ui.json'), JSON.stringify(categories, null, 2));
