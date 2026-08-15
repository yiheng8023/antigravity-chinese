const fs = require('fs');
const path = require('path');

const bundlePath = path.join(__dirname, 'main.js');
const content = fs.readFileSync(bundlePath, 'utf-8');

console.log('Analyzing bundle of size:', content.length);

// Extract string literals
const stringRegex = /"([^"\\]*(?:\\.[^"\\]*)*)"|'([^'\\]*(?:\\.[^'\\]*)*)'|`([^`\\]*(?:\\.[^`\\]*)*)`/g;

const foundStrings = new Set();
let match;

while ((match = stringRegex.exec(content)) !== null) {
  const str = match[1] || match[2] || match[3] || '';
  const clean = str.trim();
  
  // Filter candidates: length between 3 and 120, has spaces or capital words, not code/url/css
  if (
    clean.length >= 3 &&
    clean.length <= 120 &&
    !clean.startsWith('http') &&
    !clean.startsWith('/') &&
    !clean.startsWith('data:') &&
    !clean.includes('{') &&
    !clean.includes('}') &&
    !clean.includes(';') &&
    !clean.includes('===') &&
    !clean.includes('!==') &&
    /^[A-Z][a-zA-Z0-9\s,\.\?\!'\(\)\-:]+$/.test(clean) // Looks like UI Title or Sentence
  ) {
    foundStrings.add(clean);
  }
}

console.log(`Found ${foundStrings.size} potential UI strings.`);

const outputList = Array.from(foundStrings).sort();
fs.writeFileSync(path.join(__dirname, 'extracted_ui_strings.json'), JSON.stringify(outputList, null, 2));

console.log('Saved to extracted_ui_strings.json');
