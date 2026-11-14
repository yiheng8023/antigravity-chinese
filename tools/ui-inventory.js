#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { createI18nEngine } = require('../core/i18n-runtime');

// A reviewed component inventory is a coverage floor, not whole-product coverage.
// A different upstream hash requires a new extraction/review, never a silent rebase.
function checkInventory(dictionary, inventory, source) {
  const engine = createI18nEngine(dictionary);
  const errors = [];
  const all = inventory.ui.concat(inventory.preserve.map(item => item.text));
  if (new Set(all).size !== all.length) errors.push('Duplicate inventory text');
  for (const text of inventory.ui) {
    const translated = engine.translate(text);
    if (!translated || translated === engine.normalizeWhitespace(text)) errors.push('Missing UI translation: ' + text);
  }
  for (const item of inventory.preserve) {
    if (!item.reason || !['technical', 'example', 'grammar', 'composed'].includes(item.kind)) {
      errors.push('Missing source-preservation decision: ' + item.text);
    }
  }
  if (source !== undefined) {
    if (crypto.createHash('sha256').update(source).digest('hex') !== inventory.source.sha256) {
      errors.push('Upstream changed: extract and review the component inventory again');
    } else {
      // Presence corroborates this already reviewed, hash-bound extraction. It is
      // intentionally not a JS parser or a claim to discover all frontend text.
      const content = source.toString('utf8').replace(/\\u([\da-f]{4})/gi,
        (match, hex) => parseInt(hex, 16) >= 0xa0 ? String.fromCharCode(parseInt(hex, 16)) : match);
      for (const text of all) {
        const quoted = JSON.stringify(text);
        const singleQuoted = "'" + quoted.slice(1, -1).replace(/\\"/g, '"').replace(/'/g, "\\'") + "'";
        if (!content.includes(quoted) && !content.includes(singleQuoted)) errors.push('Source text not found: ' + text);
      }
    }
  }
  return { ok: errors.length === 0, uiCount: inventory.ui.length, preservedCount: inventory.preserve.length,
    sourceVerified: source !== undefined && !errors.some(e => /Upstream changed|Source text not found/.test(e)), errors };
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const index = args.indexOf('--bundle');
  try {
    if (args.length && (index !== 0 || args.length !== 2)) throw new Error('Usage: node tools/ui-inventory.js [--bundle <official-main.js>]');
    const inventory = require('../test/fixtures/app-2.32.1-ui.json');
    const source = index === -1 ? undefined : fs.readFileSync(path.resolve(args[1]));
    const result = checkInventory(require('../dict/zh-CN.json'), inventory, source);
    console.log(JSON.stringify(result, null, 2));
    console.log(source === undefined ? 'Saved inventory only; upstream freshness and live UI are not verified.' : 'Explicit upstream bundle and reviewed inventory checked; live UI remains a separate check.');
    process.exitCode = result.ok ? 0 : 1;
  } catch (error) { console.error(error.message); process.exitCode = 2; }
}

module.exports = { checkInventory };
