const fs = require('fs');
const path = require('path');

const content = fs.readFileSync(path.join(__dirname, 'main.js'), 'utf-8');

// Find all occurrences of JSX/React texts, labels, tooltips, descriptions, headers
const patterns = [
  /(?:label|title|header|heading|subtitle|description|text|placeholder|tooltip|aria-label)\s*[:=]\s*["'`]([^"'`]{2,150})["'`]/g,
  />\s*([A-Z][A-Za-z0-9\s\,\.\?\!\:\-\_]{2,120})\s*</g,
  /["'`]([A-Z][A-Za-z0-9\s\,\.\?\!\:\-\_]{3,120})["'`]/g
];

const stringSet = new Set();

for (const p of patterns) {
  let m;
  while ((m = p.exec(content)) !== null) {
    const s = m[1].replace(/\\n/g, ' ').replace(/\s+/g, ' ').trim();
    if (s.length >= 2 && s.length <= 150) {
      if (!s.includes('__') && !s.includes('0x') && !s.startsWith('.') && !s.startsWith('#')) {
        if (!/^[A-Z_]+$/.test(s) && !/^[a-z0-9_\-]+$/.test(s)) {
          if (/[a-zA-Z]/.test(s)) {
            stringSet.add(s);
          }
        }
      }
    }
  }
}

console.log('Total extracted UI candidates:', stringSet.size);

const currentDict = require('../dict/zh-CN.json');
const exact = currentDict.exact;

const missing = [];
for (const s of stringSet) {
  if (!exact[s]) {
    missing.push(s);
  }
}

console.log('Missing strings count:', missing.length);
fs.writeFileSync(path.join(__dirname, 'missing_ui_strings.json'), JSON.stringify(missing.sort(), null, 2));
