const fs = require('node:fs');
const dictionary = require('../dict/scoped/official-plugin-descriptions.json');

const official = 'antigravity-plugins-official';
const publicCatalogs = new Set([official, 'antigravity-plugins-partners']);

function comparePluginCatalog(rows, entries = dictionary) {
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error('快照应包含至少一条公开插件短介绍。');
  }
  const known = new Map();
  for (const [source, entry] of Object.entries(entries)) {
    if (entry.builtin) continue;
    const id = (entry.marketplace || official) + '/plugin/' + entry.plugin;
    if (!known.has(id)) known.set(id, new Map());
    known.get(id).set(source, entry.translation);
  }

  const current = new Map();
  for (const [i, row] of rows.entries()) {
    if (!publicCatalogs.has(row?.marketplace) || typeof row.plugin !== 'string' ||
        !/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(row.plugin) ||
        typeof row.description !== 'string' || !row.description.trim()) {
      throw new Error(`第 ${i + 1} 条缺少有效的公开目录、插件 ID 或完整短介绍。`);
    }
    const id = row.marketplace + '/plugin/' + row.plugin;
    if (!current.has(id)) current.set(id, new Set());
    current.get(id).add(row.description);
  }

  const report = { observed: current.size, matched: 0, rewritten: [], unlisted: [], conflicting: [] };
  for (const id of [...current.keys()].sort()) {
    const descriptions = [...current.get(id)].sort();
    const [description] = descriptions;
    const previous = known.get(id);
    if (descriptions.length > 1) {
      report.conflicting.push({ id, descriptions });
    } else if (!previous) {
      report.unlisted.push({ id, description });
    } else if (!previous.has(description)) {
      report.rewritten.push({ id, description, previous: Object.fromEntries(previous) });
    } else {
      report.matched++;
    }
  }
  return report;
}

if (require.main === module) {
  try {
    if (process.argv.length !== 3) throw new Error('用法：node tools/compare-plugin-catalog.js <snapshot.json>');
    const snapshot = JSON.parse(fs.readFileSync(process.argv[2], 'utf8').replace(/^\uFEFF/, ''));
    console.log(JSON.stringify(comparePluginCatalog(snapshot.rows), null, 2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = { comparePluginCatalog };
