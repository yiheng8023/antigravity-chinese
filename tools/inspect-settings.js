const fs = require('fs');
const path = require('path');

const candidates = require('./settings_candidates.json');
const currentDict = require('../dict/zh-CN.json');
const existingExact = currentDict.exact || {};

console.log('Total settings candidates:', candidates.length);
console.log('Current exact dictionary size:', Object.keys(existingExact).length);

// Let's filter out things that are already in exact dictionary
const unmapped = candidates.filter(s => !existingExact[s]);
console.log('Unmapped settings candidates:', unmapped.length);

// Sample unmapped items
console.log('\n--- Sample unmapped (first 100) ---');
console.log(unmapped.slice(0, 100).join('\n'));

fs.writeFileSync(path.join(__dirname, 'unmapped_settings.json'), JSON.stringify(unmapped, null, 2));
