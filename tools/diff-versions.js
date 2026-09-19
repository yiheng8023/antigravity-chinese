const fs = require('fs');
const path = require('path');

const oldPath = path.join(__dirname, 'main.js');
const newPath = path.join(__dirname, 'upstream_2.15', 'main.js');

if (!fs.existsSync(oldPath) || !fs.existsSync(newPath)) {
  console.error('Missing main.js files for comparison');
  process.exit(1);
}

const oldContent = fs.readFileSync(oldPath, 'utf8');
const newContent = fs.readFileSync(newPath, 'utf8');

function extractStrings(content) {
  const strRegex = /"([^"\r\n\\]*(?:\\.[^"\r\n\\]*)*)"|'([^'\r\n\\]*(?:\\.[^'\r\n\\]*)*)'|`([^`\\]*(?:\\.[^`\\]*)*)`/g;
  const set = new Set();
  let m;
  while ((m = strRegex.exec(content)) !== null) {
    const s = m[1] || m[2] || m[3];
    if (!s) continue;
    const clean = s.replace(/\\"/g, '"').replace(/\\'/g, "'").replace(/\\n/g, ' ').replace(/\s+/g, ' ').trim();
    if (clean.length >= 2 && clean.length <= 120 && /[a-zA-Z]{2,}/.test(clean) && !/[{}();=<>|&!~^%$@#*\\]/.test(clean)) {
      set.add(clean);
    }
  }
  return set;
}

const oldStrings = extractStrings(oldContent);
const newStrings = extractStrings(newContent);

console.log('Old strings count:', oldStrings.size);
console.log('New strings count:', newStrings.size);

const addedStrings = [];
for (const s of newStrings) {
  if (!oldStrings.has(s)) {
    addedStrings.push(s);
  }
}

console.log('Newly added strings count in 2.15.0:', addedStrings.length);

const dict = require('../dict/zh-CN.json');
const exact = dict.exact || {};

// Filter out those already in dict
const missingNew = addedStrings.filter(s => !exact[s]);
console.log('Newly added strings NOT in dict:', missingNew.length);

fs.writeFileSync(path.join(__dirname, 'v2.15_new_strings.json'), JSON.stringify(missingNew, null, 2));
console.log('Wrote v2.15_new_strings.json');
