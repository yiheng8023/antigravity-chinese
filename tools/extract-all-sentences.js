const fs = require('fs');
const path = require('path');

const bundlePath = path.join(__dirname, '..', 'tools', 'main.js');
let content = '';

if (fs.existsSync(bundlePath)) {
  content = fs.readFileSync(bundlePath, 'utf-8');
} else {
  console.log('Tools main.js not found, checking scripts...');
  const altPath = path.join(__dirname, 'main.js');
  if (fs.existsSync(altPath)) content = fs.readFileSync(altPath, 'utf-8');
}

console.log('Bundle length:', content.length);

// Extract all natural language strings (both single line and multiline)
const stringRegex = /"([^"\\]*(?:\\.[^"\\]*)*)"|'([^'\\]*(?:\\.[^'\\]*)*)'|`([^`\\]*(?:\\.[^`\\]*)*)`/g;

const allSentences = new Set();
let match;

while ((match = stringRegex.exec(content)) !== null) {
  const raw = match[1] || match[2] || match[3] || '';
  // Normalize whitespace
  const normalized = raw.replace(/\s+/g, ' ').trim();
  
  // Filter natural sentences
  if (
    normalized.length >= 2 &&
    normalized.length <= 300 &&
    !normalized.startsWith('http') &&
    !normalized.startsWith('data:') &&
    !normalized.startsWith('/') &&
    !normalized.includes('padding') &&
    !normalized.includes('margin') &&
    !normalized.includes('border') &&
    !normalized.includes('flex') &&
    !normalized.includes('color:') &&
    !normalized.includes('background') &&
    /[a-zA-Z]{2,}/.test(normalized) && // contains English words
    !/^[a-z0-9_\-\.]+$/.test(normalized) // not pure slug/identifier
  ) {
    allSentences.add(normalized);
  }
}

console.log(`Extracted ${allSentences.size} normalized UI sentences & phrases.`);
fs.writeFileSync(path.join(__dirname, 'all_normalized_strings.json'), JSON.stringify(Array.from(allSentences).sort(), null, 2));
